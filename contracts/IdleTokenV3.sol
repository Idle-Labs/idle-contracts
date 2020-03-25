/**
 * @title: Idle Token main contract
 * @summary: ERC20 that holds pooled user funds together
 *           Each token rapresent a share of the underlying pools
 *           and with each token user have the right to redeem a portion of these pools
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/lifecycle/Pausable.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/iERC20Fulcrum.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IIdleTokenV3.sol";

import "./IdleRebalancerV3.sol";
import "./IdlePriceCalculator.sol";

contract IdleTokenV3 is ERC20, ERC20Detailed, ReentrancyGuard, Ownable, Pausable, IIdleTokenV3 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocolWrappers may be changed/updated/removed do not rely on their
  // addresses to determine where funds are allocated

  // eg. cTokenAddress => IdleCompoundAddress
  mapping(address => address) public protocolWrappers;
  // eg. DAI address
  address public token;
  // eg. 18 for DAI
  uint256 public tokenDecimals;
  // eg. iDAI address
  address public iToken; // used for claimITokens and userClaimITokens
  // Idle rebalancer current implementation address
  address public rebalancer;
  // Idle rebalancer current implementation address
  address public priceCalculator;
  // Last iToken price, used to pause contract in case of a black swan event
  uint256 public lastITokenPrice;
  // Manual trigger for unpausing contract in case of a black swan event that caused the iToken price to not
  // return to the normal level
  bool public manualPlay = false;

  // no one can directly change this
  // Idle pool current investments eg. [cTokenAddress, iTokenAddress]
  address[] public currentTokensUsed;
  // eg. [cTokenAddress, iTokenAddress, ...]
  address[] public allAvailableTokens;
  // eg. [5000, 0, 5000, 0] for 50% in compound, 0% fulcrum, 50% aave, 0 dydx. same order of allAvailableTokens
  uint256[] public lastAllocations;

  struct TokenProtocol {
    address tokenAddr;
    address protocolAddr;
  }

  /**
   * @dev constructor, initialize some variables, mainly addresses of other contracts
   *
   * @param _name : IdleToken name
   * @param _symbol : IdleToken symbol
   * @param _decimals : IdleToken decimals
   * @param _token : underlying token address
   * @param _cToken : cToken address
   * @param _iToken : iToken address
   * @param _rebalancer : Idle Rebalancer address
   * @param _idleCompound : Idle Compound address
   * @param _idleFulcrum : Idle Fulcrum address
   */
  constructor(
    string memory _name, // eg. IdleDAI
    string memory _symbol, // eg. IDLEDAI
    uint8 _decimals, // eg. 18
    address _token,
    address _cToken,
    address _iToken,
    address _rebalancer,
    address _priceCalculator,
    address _idleCompound,
    address _idleFulcrum)
    public
    ERC20Detailed(_name, _symbol, _decimals) {
      token = _token;
      tokenDecimals = ERC20Detailed(_token).decimals();
      iToken = _iToken;
      rebalancer = _rebalancer;
      priceCalculator = _priceCalculator;
      protocolWrappers[_cToken] = _idleCompound;
      protocolWrappers[_iToken] = _idleFulcrum;
      allAvailableTokens = [_cToken, _iToken];
  }

  modifier whenITokenPriceHasNotDecreased() {
    uint256 iTokenPrice = iERC20Fulcrum(iToken).tokenPrice();
    require(
      iTokenPrice >= lastITokenPrice || manualPlay,
      "Paused: iToken price decreased"
    );

    _;

    if (iTokenPrice > lastITokenPrice) {
      lastITokenPrice = iTokenPrice;
    }
  }

  // onlyOwner
  /**
   * It allows owner to set the iToken (Fulcrum) address
   *
   * @param _iToken : iToken address
   */
  function setIToken(address _iToken)
    external onlyOwner {
      iToken = _iToken;
  }
  /**
   * It allows owner to set the IdleRebalancerV3 address
   *
   * @param _rebalancer : new IdleRebalancerV3 address
   */
  function setRebalancer(address _rebalancer)
    external onlyOwner {
      rebalancer = _rebalancer;
  }
  /**
   * It allows owner to set the IdlePriceCalculator address
   *
   * @param _priceCalculator : new IdlePriceCalculator address
   */
  function setPriceCalculator(address _priceCalculator)
    external onlyOwner {
      priceCalculator = _priceCalculator;
  }
  /**
   * It allows owner to set a protocol wrapper address
   *
   * @param _token : underlying token address (eg. DAI)
   * @param _wrapper : Idle protocol wrapper address
   */
  function setProtocolWrapper(address _token, address _wrapper)
    external onlyOwner {
      require(_token != address(0) && _wrapper != address(0), 'some addr is 0');
      // update allAvailableTokens if needed
      if (protocolWrappers[_token] == address(0)) {
        allAvailableTokens.push(_token);
      }
      protocolWrappers[_token] = _wrapper;
  }

  /**
   * It allows owner to unpause the contract when iToken price decreased and didn't return to the expected level
   *
   * @param _manualPlay : new IdleRebalancerV3 address
   */
  function setManualPlay(bool _manualPlay)
    external onlyOwner {
      manualPlay = _manualPlay;
  }

  // view
  /**
   * IdleToken price calculation, in underlying
   *
   * @return : price in underlying token
   */
  function tokenPrice()
    public view
    returns (uint256 price) {
      address[] memory protocolWrappersAddresses = new address[](currentTokensUsed.length);
      for (uint8 i = 0; i < currentTokensUsed.length; i++) {
        protocolWrappersAddresses[i] = protocolWrappers[currentTokensUsed[i]];
      }
      price = IdlePriceCalculator(priceCalculator).tokenPrice(
        totalSupply(), address(this), currentTokensUsed, protocolWrappersAddresses
      );
  }

  /**
   * Get APR of every ILendingProtocol
   *
   * @return addresses: array of token addresses
   * @return aprs: array of aprs (ordered in respect to the `addresses` array)
   */
  function getAPRs()
    public view
    returns (address[] memory addresses, uint256[] memory aprs) {
      address currToken;
      addresses = new address[](allAvailableTokens.length);
      aprs = new uint256[](allAvailableTokens.length);
      for (uint8 i = 0; i < allAvailableTokens.length; i++) {
        currToken = allAvailableTokens[i];
        addresses[i] = currToken;
        aprs[i] = ILendingProtocol(protocolWrappers[currToken]).getAPR();
      }
  }

  /**
   * Get current avg APR of this IdleToken
   *
   * @return avgApr: current weighted avg apr
   */
  function getAvgAPR()
    public view
    returns (uint256 avgApr) {
      (, uint256[] memory amounts, uint256 total) = _getCurrentAllocations();
      uint256 currApr;
      uint256 weight;
      for (uint8 i = 0; i < allAvailableTokens.length; i++) {
        if (amounts[i] == 0) {
          continue;
        }
        currApr = ILendingProtocol(protocolWrappers[allAvailableTokens[i]]).getAPR();
        weight = amounts[i].mul(10**18).div(total);
        avgApr = avgApr.add(currApr.mul(weight).div(10**18));
      }
  }

  // external
  /**
   * Used to mint IdleTokens, given an underlying amount (eg. DAI).
   * This method triggers a rebalance of the pools if needed
   * NOTE: User should 'approve' _amount of tokens before calling mintIdleToken
   * NOTE 2: this method can be paused
   *
   * @param _amount : amount of underlying token to be lended
   * @param : not used
   * @return mintedTokens : amount of IdleTokens minted
   */
  function mintIdleToken(uint256 _amount, uint256[] memory)
    public nonReentrant whenNotPaused whenITokenPriceHasNotDecreased
    returns (uint256 mintedTokens) {
      // Get current IdleToken price
      uint256 idlePrice = tokenPrice();
      // transfer tokens to this contract
      IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

      // Rebalance the current pool if needed and mint new supplyied amount
      rebalance();

      mintedTokens = _amount.mul(10**18).div(idlePrice);
      _mint(msg.sender, mintedTokens);
  }

  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   * This method triggers a rebalance of the pools if needed
   * NOTE: If the contract is paused or iToken price has decreased one can still redeem but no rebalance happens.
   * NOTE 2: If iToken price has decresed one should not redeem (but can do it) otherwise he would capitalize the loss.
   *         Ideally one should wait until the black swan event is terminated
   *
   * @param _amount : amount of IdleTokens to be burned
   * @param _skipRebalance : whether to skip the rebalance process or not
   * @param : not used
   * @return redeemedTokens : amount of underlying tokens redeemed
   */
  function redeemIdleToken(uint256 _amount, bool _skipRebalance, uint256[] memory)
    public nonReentrant
    returns (uint256 redeemedTokens) {
      address currentToken;

      for (uint8 i = 0; i < currentTokensUsed.length; i++) {
        currentToken = currentTokensUsed[i];
        redeemedTokens = redeemedTokens.add(
          _redeemProtocolTokens(
            protocolWrappers[currentToken],
            currentToken,
            // _amount * protocolPoolBalance / idleSupply
            _amount.mul(IERC20(currentToken).balanceOf(address(this))).div(totalSupply()), // amount to redeem
            msg.sender
          )
        );
      }

      _burn(msg.sender, _amount);

      if (this.paused() || iERC20Fulcrum(iToken).tokenPrice() < lastITokenPrice || _skipRebalance) {
        return redeemedTokens;
      }

      rebalance();
  }


  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   * and send interest-bearing tokens (eg. cDAI/iDAI) directly to the user.
   * Underlying (eg. DAI) is not redeemed here.
   *
   * @param _amount : amount of IdleTokens to be burned
   */
  function redeemInterestBearingTokens(uint256 _amount)
    external nonReentrant {
      uint256 idleSupply = totalSupply();
      address currentToken;

      for (uint8 i = 0; i < currentTokensUsed.length; i++) {
        currentToken = currentTokensUsed[i];
        IERC20(currentToken).safeTransfer(
          msg.sender,
          _amount.mul(IERC20(currentToken).balanceOf(address(this))).div(idleSupply) // amount to redeem
        );
      }

      _burn(msg.sender, _amount);
  }

  /**
   * Dynamic allocate all the pool across different lending protocols if needed
   *
   * NOTE: this method can be paused
   *
   * @return : whether has rebalanced or not
   */
  function rebalance()
    public whenNotPaused whenITokenPriceHasNotDecreased
    returns (bool) {
      return rebalance(0, new uint256[](0));
  }
  /**
   * Dynamic allocate all the pool across different lending protocols if needed
   *
   * NOTE: this method can be paused
   *
   * @param : not used
   * @param : not used
   * @return : whether has rebalanced or not
   */
  function rebalance(uint256, uint256[] memory)
    public whenNotPaused whenITokenPriceHasNotDecreased
    returns (bool) {
      // check if we need to rebalance by looking at the allocations in rebalancer contract
      uint256[] memory rebalancerLastAllocations = IdleRebalancerV3(rebalancer).getAllocations();
      bool areAllocationsEqual = rebalancerLastAllocations.length == lastAllocations.length;
      if (areAllocationsEqual) {
        for (uint8 i = 0; i < lastAllocations.length || !areAllocationsEqual; i++) {
          if (lastAllocations[i] != rebalancerLastAllocations[i]) {
            areAllocationsEqual = false;
            break;
          }
        }
      }
      uint256 balance = IERC20(token).balanceOf(address(this));
      if (areAllocationsEqual && balance == 0) {
        return false;
      }

      if (balance > 0) {
        _mintWithAmounts(allAvailableTokens, _amountsFromAllocations(rebalancerLastAllocations, balance));
      }

      if (areAllocationsEqual && balance > 0) {
        return false;
      }
      // Update lastAllocations with rebalancerLastAllocations
      delete lastAllocations;
      lastAllocations = rebalancerLastAllocations;

      // Instead of redeeming everything during rebalance we redeem and mint only what needs
      // to be reallocated
      // get current allocations in underlying
      (address[] memory tokenAddresses, uint256[] memory amounts, uint256 totalInUnderlying) = _getCurrentAllocations();
      // calculate new allocations given the total
      uint256[] memory newAmounts = _amountsFromAllocations(rebalancerLastAllocations, totalInUnderlying);
      (uint256[] memory toMintAllocations, uint256 totalRedeemed, uint256 totalToMint) =
        _redeemAllNeeded(tokenAddresses, amounts, newAmounts);

      if (totalRedeemed > 1 && totalToMint > 1) {
        // Do not mint directly using toMintAllocations check with totalRedeemed
        uint256[] memory tempAllocations = new uint256[](toMintAllocations.length);
        for (uint8 i = 0; i < toMintAllocations.length; i++) {
          // Calc what would have been the correct allocations percentage if all was available
          tempAllocations[i] = toMintAllocations[i].mul(10000).div(totalToMint);
        }

        // calc what to mint based on totalRedeemed
        uint256[] memory partialAmounts = _amountsFromAllocations(tempAllocations, IERC20(token).balanceOf(address(this)));
        _mintWithAmounts(allAvailableTokens, partialAmounts);
      }

      // remove all elements from `currentTokensUsed` even if they are still in use
      delete currentTokensUsed;
      // update current tokens used in IdleToken storage
      for (uint8 i = 0; i < allAvailableTokens.length; i++) {
        if (IERC20(allAvailableTokens[i]).balanceOf(address(this)) > 0) {
          currentTokensUsed.push(allAvailableTokens[i]);
        }
      }

      return true; // hasRebalanced
  }

  /**
   * Get the contract balance of every protocol currently used
   *
   * @return tokenAddresses : array with all token addresses used,
   *                          eg [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   eg [amountCompoundInUnderlying, amountFulcrumInUnderlying]
   * @return total : total aum in underlying
   */
  function getCurrentAllocations() external view
    returns (address[] memory tokenAddresses, uint256[] memory amounts, uint256 total) {
    return _getCurrentAllocations();
  }

  // internal
  function _mintWithAmounts(address[] memory tokenAddresses, uint256[] memory protocolAmounts) internal {
    // mint for each protocol and update currentTokensUsed
    require(tokenAddresses.length == protocolAmounts.length, "All tokens length != allocations length");

    uint256 currAmount;
    address currAddr;

    for (uint8 i = 0; i < protocolAmounts.length; i++) {
      currAmount = protocolAmounts[i];
      if (currAmount == 0) {
        continue;
      }
      currAddr = tokenAddresses[i];
      _mintProtocolTokens(protocolWrappers[currAddr], currAmount);
    }
  }

  function _amountsFromAllocations(uint256[] memory allocations, uint256 total)
    internal pure returns (uint256[] memory) {
    uint256[] memory newAmounts = new uint256[](allocations.length);
    uint256 currBalance = 0;
    uint256 allocatedBalance = 0;

    for (uint8 i = 0; i < allocations.length; i++) {
      if (i == allocations.length - 1) {
        newAmounts[i] = total.sub(allocatedBalance);
      } else {
        currBalance = total.mul(allocations[i]).div(10000);
        allocatedBalance = allocatedBalance.add(currBalance);
        newAmounts[i] = currBalance;
      }
    }
    return newAmounts;
  }

  function _redeemAllNeeded(
    address[] memory tokenAddresses,
    uint256[] memory amounts,
    uint256[] memory newAmounts
    ) internal returns (
      uint256[] memory toMintAllocations,
      uint256 totalRedeemed,
      uint256 totalToMint
    ) {
    require(amounts.length == newAmounts.length, 'Lengths not equal');
    toMintAllocations = new uint256[](amounts.length);
    ILendingProtocol protocol;
    // check the difference between amounts and newAmounts
    for (uint8 i = 0; i < amounts.length; i++) {
      protocol = ILendingProtocol(protocolWrappers[tokenAddresses[i]]);
      if (amounts[i] > newAmounts[i]) {
        toMintAllocations[i] = 0;
        uint256 toRedeem = amounts[i].sub(newAmounts[i]);
        uint256 availableLiquidity = protocol.availableLiquidity();
        if (availableLiquidity < toRedeem) {
          toRedeem = availableLiquidity;
        }
        // redeem the difference
        totalRedeemed = totalRedeemed.add(
          _redeemProtocolTokens(
            protocolWrappers[tokenAddresses[i]],
            tokenAddresses[i],
            // convert amount from underlying to protocol token
            toRedeem.mul(10**18).div(protocol.getPriceInToken()),
            address(this) // tokens are now in this contract
          )
        );
      } else {
        toMintAllocations[i] = newAmounts[i].sub(amounts[i]);
        totalToMint = totalToMint.add(toMintAllocations[i]);
      }
    }
  }

  /**
   * Get the contract balance of every protocol currently used
   *
   * @return tokenAddresses : array with all token addresses used,
   *                          eg [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   eg [amountCompoundInUnderlying, amountFulcrumInUnderlying]
   * @return total : total aum in underlying
   */
  function _getCurrentAllocations() internal view
    returns (address[] memory tokenAddresses, uint256[] memory amounts, uint256 total) {
      // Get balance of every protocol implemented
      tokenAddresses = new address[](allAvailableTokens.length);
      amounts = new uint256[](allAvailableTokens.length);

      address currentToken;
      uint256 currTokenPrice;

      for (uint8 i = 0; i < allAvailableTokens.length; i++) {
        currentToken = allAvailableTokens[i];
        tokenAddresses[i] = currentToken;
        currTokenPrice = ILendingProtocol(protocolWrappers[currentToken]).getPriceInToken();
        amounts[i] = currTokenPrice.mul(
          IERC20(currentToken).balanceOf(address(this))
        ).div(10**18);
        total = total.add(amounts[i]);
      }

      // return addresses and respective amounts in underlying
      return (tokenAddresses, amounts, total);
  }

  /**
   * Get addresses of current tokens and protocol wrappers used
   *
   * @return currentProtocolsUsed : array of `TokenProtocol` (currentToken address, protocolWrapper address)
   */
  function _getCurrentProtocols()
    internal view
    returns (TokenProtocol[] memory currentProtocolsUsed) {
      currentProtocolsUsed = new TokenProtocol[](currentTokensUsed.length);
      for (uint8 i = 0; i < currentTokensUsed.length; i++) {
        currentProtocolsUsed[i] = TokenProtocol(
          currentTokensUsed[i],
          protocolWrappers[currentTokensUsed[i]]
        );
      }
  }

  // ILendingProtocols calls
  /**
   * Get next rate of a lending protocol given an amount to be lended
   *
   * @param _wrapperAddr : address of protocol wrapper
   * @param _amount : amount of underlying to be lended
   * @return apr : new apr one will get after lending `_amount`
   */
  function _getProtocolNextRate(address _wrapperAddr, uint256 _amount)
    internal view
    returns (uint256 apr) {
      ILendingProtocol _wrapper = ILendingProtocol(_wrapperAddr);
      apr = _wrapper.nextSupplyRate(_amount);
  }

  /**
   * Mint protocol tokens through protocol wrapper
   *
   * @param _wrapperAddr : address of protocol wrapper
   * @param _amount : amount of underlying to be lended
   * @return tokens : new tokens minted
   */
  function _mintProtocolTokens(address _wrapperAddr, uint256 _amount)
    internal
    returns (uint256 tokens) {
      if (_amount == 0) {
        return tokens;
      }
      ILendingProtocol _wrapper = ILendingProtocol(_wrapperAddr);
      // Transfer _amount underlying token (eg. DAI) to _wrapperAddr
      IERC20(token).safeTransfer(_wrapperAddr, _amount);
      tokens = _wrapper.mint();
  }

  /**
   * Redeem underlying tokens through protocol wrapper
   *
   * @param _wrapperAddr : address of protocol wrapper
   * @param _amount : amount of `_token` to redeem
   * @param _token : protocol token address
   * @param _account : should be msg.sender when rebalancing and final user when redeeming
   * @return tokens : new tokens minted
   */
  function _redeemProtocolTokens(address _wrapperAddr, address _token, uint256 _amount, address _account)
    internal
    returns (uint256 tokens) {
      if (_amount == 0) {
        return tokens;
      }
      ILendingProtocol _wrapper = ILendingProtocol(_wrapperAddr);
      // Transfer _amount of _protocolToken (eg. cDAI) to _wrapperAddr
      IERC20(_token).safeTransfer(_wrapperAddr, _amount);
      tokens = _wrapper.redeem(_account);
  }
}
