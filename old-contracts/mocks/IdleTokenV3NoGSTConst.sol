/**
 * @title: Idle Token (V3) main contract
 * @summary: ERC20 that holds pooled user funds together
 *           Each token rapresent a share of the underlying pools
 *           and with each token user have the right to redeem a portion of these pools
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/lifecycle/Pausable.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/iERC20Fulcrum.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/IIdleTokenV3.sol";

import "../IdleRebalancerV3.sol";
import "../IdlePriceCalculator.sol";
import "./GST2ConsumerNoConst.sol";

contract IdleTokenV3NoGSTConst is ERC20, ERC20Detailed, ReentrancyGuard, Ownable, Pausable, IIdleTokenV3, GST2ConsumerNoConst {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // Fake methods
  function mockBackInTime(address _wrapper, uint256 _time) external {
    releaseTimes[_wrapper] = _time;
  }

  function createTokens(uint256 amount) external {
    _mint(address(1), amount);
  }
  // eg. cTokenAddress => IdleCompoundAddress
  mapping(address => address) public protocolWrappers;
  // eg. DAI address
  address public token;
  // eg. iDAI address
  address public iToken; // used for claimITokens and userClaimITokens
  // Idle rebalancer current implementation address
  address public rebalancer;
  // Idle price calculator current implementation address
  address public priceCalculator;
  // Address collecting underlying fees
  address public feeAddress;
  // Last iToken price, used to pause contract in case of a black swan event
  uint256 public lastITokenPrice;
  // eg. 18 for DAI
  uint256 public tokenDecimals;
  // Max possible fee on interest gained
  uint256 constant MAX_FEE = 10000; // 100000 == 100% -> 10000 == 10%
  // Min delay for adding a new protocol
  uint256 constant NEW_PROTOCOL_DELAY = 60 * 60 * 24 * 3; // 3 days in seconds
  // Current fee on interest gained
  uint256 public fee;
  // Manual trigger for unpausing contract in case of a black swan event that caused the iToken price to not
  // return to the normal level
  bool public manualPlay;
  // Flag for disabling openRebalance for the risk adjusted variant
  bool public isRiskAdjusted;
  // Flag for disabling instant new protocols additions
  bool public isNewProtocolDelayed;
  // eg. [cTokenAddress, iTokenAddress, ...]
  address[] public allAvailableTokens;
  // eg. [5000, 0, 5000, 0] for 50% in compound, 0% fulcrum, 50% aave, 0 dydx. same order of allAvailableTokens
  uint256[] public lastAllocations;
  // Map that saves avg idleToken price paid for each user
  mapping(address => uint256) public userAvgPrices;
  // Map that saves amount with no fee for each user
  mapping(address => uint256) private userNoFeeQty;
  // timestamp when new protocol wrapper has been queued for change
  // protocol_wrapper_address -> timestamp
  mapping(address => uint256) public releaseTimes;

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

  // During a black swan event is possible that iToken price decreases instead of increasing,
  // with the consequence of lowering the IdleToken price. To mitigate this we implemented a
  // check on the iToken price that prevents users from minting cheap IdleTokens or rebalancing
  // the pool in this specific case. The redeemIdleToken won't be paused but the rebalance process
  // won't be triggered in this case.
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
   * It allows owner to set the IdleRebalancerV3 address
   *
   * @param _rebalancer : new IdleRebalancerV3 address
   */
  function setRebalancer(address _rebalancer)
    external onlyOwner {
      require(_rebalancer != address(0), 'Addr is 0');
      rebalancer = _rebalancer;
  }
  /**
   * It allows owner to set the IdlePriceCalculator address
   *
   * @param _priceCalculator : new IdlePriceCalculator address
   */
  function setPriceCalculator(address _priceCalculator)
    external onlyOwner {
      require(_priceCalculator != address(0), 'Addr is 0');
      if (!isNewProtocolDelayed || (releaseTimes[_priceCalculator] != 0 && now - releaseTimes[_priceCalculator] > NEW_PROTOCOL_DELAY)) {
        priceCalculator = _priceCalculator;
        releaseTimes[_priceCalculator] = 0;
        return;
      }
      releaseTimes[_priceCalculator] = now;
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

      if (!isNewProtocolDelayed || (releaseTimes[_wrapper] != 0 && now - releaseTimes[_wrapper] > NEW_PROTOCOL_DELAY)) {
        // update allAvailableTokens if needed
        if (protocolWrappers[_token] == address(0)) {
          allAvailableTokens.push(_token);
        }
        protocolWrappers[_token] = _wrapper;
        releaseTimes[_wrapper] = 0;
        return;
      }

      releaseTimes[_wrapper] = now;
  }

  /**
   * It allows owner to unpause the contract when iToken price decreased and didn't return to the expected level
   *
   * @param _manualPlay : flag
   */
  function setManualPlay(bool _manualPlay)
    external onlyOwner {
      manualPlay = _manualPlay;
  }

  /**
   * It allows owner to disable openRebalance
   *
   * @param _isRiskAdjusted : flag
   */
  function setIsRiskAdjusted(bool _isRiskAdjusted)
    external onlyOwner {
      isRiskAdjusted = _isRiskAdjusted;
  }

  /**
   * It permanently disable instant new protocols additions
   */
  function delayNewProtocols()
    external onlyOwner {
      isNewProtocolDelayed = true;
  }

  /**
   * It allows owner to set the fee (1000 == 10% of gained interest)
   *
   * @param _fee : fee amount where 100000 is 100%, max settable is MAX_FEE constant
   */
  function setFee(uint256 _fee)
    external onlyOwner {
      require(_fee <= MAX_FEE, "Fee too high");
      fee = _fee;
  }

  /**
   * It allows owner to set the fee address
   *
   * @param _feeAddress : fee address
   */
  function setFeeAddress(address _feeAddress)
    external onlyOwner {
      require(_feeAddress != address(0), 'Addr is 0');
      feeAddress = _feeAddress;
  }

  /**
   * It allows owner to set gas parameters
   *
   * @param _amounts : fee amount where 100000 is 100%, max settable is MAX_FEE constant
   */
  function setGasParams(uint256[] calldata _amounts)
    external onlyOwner {
      gasAmounts = _amounts;
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
      address[] memory protocolWrappersAddresses = new address[](allAvailableTokens.length);
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        protocolWrappersAddresses[i] = protocolWrappers[allAvailableTokens[i]];
      }
      price = IdlePriceCalculator(priceCalculator).tokenPrice(
        totalSupply(), address(this), allAvailableTokens, protocolWrappersAddresses
      );
  }

  /**
   * Get APR of every ILendingProtocol
   *
   * @return addresses: array of token addresses
   * @return aprs: array of aprs (ordered in respect to the `addresses` array)
   */
  function getAPRs()
    external view
    returns (address[] memory addresses, uint256[] memory aprs) {
      address currToken;
      addresses = new address[](allAvailableTokens.length);
      aprs = new uint256[](allAvailableTokens.length);
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
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
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        if (amounts[i] == 0) {
          continue;
        }
        currApr = ILendingProtocol(protocolWrappers[allAvailableTokens[i]]).getAPR();
        weight = amounts[i].mul(10**18).div(total);
        avgApr = avgApr.add(currApr.mul(weight).div(10**18));
      }
  }

  // ##### ERC20 modified transfer and transferFrom that also update the avgPrice paid for the recipient
  function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
    _transfer(sender, recipient, amount);
    _approve(sender, msg.sender, allowance(sender, msg.sender).sub(amount, "ERC20: transfer amount exceeds allowance"));
    _updateAvgPrice(recipient, amount, userAvgPrices[sender]);
    return true;
  }
  function transfer(address recipient, uint256 amount) public returns (bool) {
    _transfer(msg.sender, recipient, amount);
    _updateAvgPrice(recipient, amount, userAvgPrices[msg.sender]);
    return true;
  }
  // #####

  // external
  /**
   * Used to mint IdleTokens, given an underlying amount (eg. DAI).
   * This method triggers a rebalance of the pools if needed and if _skipWholeRebalance is false
   * NOTE: User should 'approve' _amount of tokens before calling mintIdleToken
   * NOTE 2: this method can be paused
   * This method use GasTokens of this contract (if present) to get a gas discount
   *
   * @param _amount : amount of underlying token to be lended
   * @param _skipWholeRebalance : flag to choose whter to do a full rebalance or not
   * @return mintedTokens : amount of IdleTokens minted
   */
  function mintIdleToken(uint256 _amount, bool _skipWholeRebalance)
    external nonReentrant gasDiscountFrom(address(this))
    returns (uint256 mintedTokens) {
    return _mintIdleToken(_amount, new uint256[](0), _skipWholeRebalance);
  }

  /**
   * DEPRECATED: Used to mint IdleTokens, given an underlying amount (eg. DAI).
   * Keep for backward compatibility with IdleV2
   *
   * @param _amount : amount of underlying token to be lended
   * @param : not used, pass empty array
   * @return mintedTokens : amount of IdleTokens minted
   */
  function mintIdleToken(uint256 _amount, uint256[] calldata)
    external nonReentrant gasDiscountFrom(address(this))
    returns (uint256 mintedTokens) {
    return _mintIdleToken(_amount, new uint256[](0), false);
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
  function redeemIdleToken(uint256 _amount, bool _skipRebalance, uint256[] calldata)
    external nonReentrant
    returns (uint256 redeemedTokens) {
      uint256 balance;
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        balance = IERC20(allAvailableTokens[i]).balanceOf(address(this));
        if (balance == 0) {
          continue;
        }
        redeemedTokens = redeemedTokens.add(
          _redeemProtocolTokens(
            protocolWrappers[allAvailableTokens[i]],
            allAvailableTokens[i],
            // _amount * protocolPoolBalance / idleSupply
            _amount.mul(balance).div(totalSupply()), // amount to redeem
            address(this)
          )
        );
      }

      _burn(msg.sender, _amount);
      if (fee > 0 && feeAddress != address(0)) {
        redeemedTokens = _getFee(_amount, redeemedTokens);
      }
      // send underlying minus fee to msg.sender
      IERC20(token).safeTransfer(msg.sender, redeemedTokens);

      if (this.paused() || iERC20Fulcrum(iToken).tokenPrice() < lastITokenPrice || _skipRebalance) {
        return redeemedTokens;
      }

      _rebalance(0, false);
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
      uint256 balance;

      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        currentToken = allAvailableTokens[i];
        balance = IERC20(currentToken).balanceOf(address(this));
        if (balance == 0) {
          continue;
        }
        IERC20(currentToken).safeTransfer(
          msg.sender,
          _amount.mul(balance).div(idleSupply) // amount to redeem
        );
      }

      _burn(msg.sender, _amount);
  }

  /**
   * Allow any users to set new allocations as long as the new allocations
   * give a better avg APR than before
   * Allocations should be in the format [100000, 0, 0, 0, ...] where length is the same
   * as lastAllocations variable and the sum of all value should be == 100000
   *
   * This method is not callble if this instance of IdleToken is a risk adjusted instance
   * NOTE: this method can be paused
   *
   * @param _newAllocations : array with new allocations in percentage
   * @return : whether has rebalanced or not
   * @return avgApr : the new avg apr after rebalance
   */
  function openRebalance(uint256[] calldata _newAllocations)
    external whenNotPaused whenITokenPriceHasNotDecreased
    returns (bool, uint256 avgApr) {
      require(!isRiskAdjusted, "Setting allocations not allowed");
      uint256 initialAPR = getAvgAPR();
      // Validate and update rebalancer allocations
      IdleRebalancerV3(rebalancer).setAllocations(_newAllocations, allAvailableTokens);
      bool hasRebalanced = _rebalance(0, false);
      uint256 newAprAfterRebalance = getAvgAPR();
      require(newAprAfterRebalance > initialAPR, "APR not improved");
      return (hasRebalanced, newAprAfterRebalance);
  }

  /**
   * Dynamic allocate all the pool across different lending protocols if needed, use gas refund from gasToken
   *
   * NOTE: this method can be paused.
   * msg.sender should approve this contract to spend GST2 tokens before calling
   * this method
   *
   * @return : whether has rebalanced or not
   */
  function rebalanceWithGST()
    external gasDiscountFrom(msg.sender)
    returns (bool) {
      return _rebalance(0, false);
  }

  /**
   * DEPRECATED: Dynamic allocate all the pool across different lending protocols if needed,
   * Keep for backward compatibility with IdleV2
   *
   * NOTE: this method can be paused
   *
   * @param : not used
   * @param : not used
   * @return : whether has rebalanced or not
   */
  function rebalance(uint256, uint256[] calldata)
    external returns (bool) {
    return _rebalance(0, false);
  }

  /**
   * Dynamic allocate all the pool across different lending protocols if needed,
   * rebalance without params
   *
   * NOTE: this method can be paused
   *
   * @return : whether has rebalanced or not
   */
  function rebalance() external returns (bool) {
    return _rebalance(0, false);
  }

  /**
   * Get the contract balance of every protocol currently used
   *
   * @return tokenAddresses : array with all token addresses used,
   *                          eg [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   eg [amountCompoundInUnderlying, amountFulcrumInUnderlying]
   * @return total : total AUM in underlying
   */
  function getCurrentAllocations() external view
    returns (address[] memory tokenAddresses, uint256[] memory amounts, uint256 total) {
    return _getCurrentAllocations();
  }

  // internal
  /**
   * Used to mint IdleTokens, given an underlying amount (eg. DAI).
   * This method triggers a rebalance of the pools if needed
   * NOTE: User should 'approve' _amount of tokens before calling mintIdleToken
   * NOTE 2: this method can be paused
   * This method use GasTokens of this contract (if present) to get a gas discount
   *
   * @param _amount : amount of underlying token to be lended
   * @param : not used
   * @param _skipWholeRebalance : flag to decide if doing a simple mint or mint + rebalance
   * @return mintedTokens : amount of IdleTokens minted
   */
  function _mintIdleToken(uint256 _amount, uint256[] memory, bool _skipWholeRebalance)
    internal whenNotPaused whenITokenPriceHasNotDecreased
    returns (uint256 mintedTokens) {
      // Get current IdleToken price
      uint256 idlePrice = tokenPrice();
      // transfer tokens to this contract
      IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

      // Rebalance the current pool if needed and mint new supplied amount
      _rebalance(0, _skipWholeRebalance);

      mintedTokens = _amount.mul(10**18).div(idlePrice);
      _mint(msg.sender, mintedTokens);

      _updateAvgPrice(msg.sender, mintedTokens, idlePrice);
  }

  /**
   * Dynamic allocate all the pool across different lending protocols if needed
   *
   * NOTE: this method can be paused
   *
   * @param : not used
   * @return : whether has rebalanced or not
   */
  function _rebalance(uint256, bool _skipWholeRebalance)
    internal whenNotPaused whenITokenPriceHasNotDecreased
    returns (bool) {
      // check if we need to rebalance by looking at the allocations in rebalancer contract
      uint256[] memory rebalancerLastAllocations = IdleRebalancerV3(rebalancer).getAllocations();
      bool areAllocationsEqual = rebalancerLastAllocations.length == lastAllocations.length;
      if (areAllocationsEqual) {
        for (uint256 i = 0; i < lastAllocations.length || !areAllocationsEqual; i++) {
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
        if (lastAllocations.length == 0 && _skipWholeRebalance) {
          // set in storage
          lastAllocations = rebalancerLastAllocations;
        }
        _mintWithAmounts(allAvailableTokens, _amountsFromAllocations(rebalancerLastAllocations, balance));
      }

      if (_skipWholeRebalance || areAllocationsEqual) {
        return false;
      }

      // Instead of redeeming everything during rebalance we redeem and mint only what needs
      // to be reallocated
      // get current allocations in underlying
      (address[] memory tokenAddresses, uint256[] memory amounts, uint256 totalInUnderlying) = _getCurrentAllocations();
      // calculate new allocations given the total
      uint256[] memory newAmounts = _amountsFromAllocations(rebalancerLastAllocations, totalInUnderlying);
      (uint256[] memory toMintAllocations, uint256 totalToMint, bool lowLiquidity) = _redeemAllNeeded(tokenAddresses, amounts, newAmounts);

      // if some protocol has liquidity that we should redeem, we do not update
      // lastAllocations to force another rebalance next time
      if (!lowLiquidity) {
        // Update lastAllocations with rebalancerLastAllocations
        delete lastAllocations;
        lastAllocations = rebalancerLastAllocations;
      }
      uint256 totalRedeemd = IERC20(token).balanceOf(address(this));
      if (totalRedeemd > 1 && totalToMint > 1) {
        // Do not mint directly using toMintAllocations check with totalRedeemd
        uint256[] memory tempAllocations = new uint256[](toMintAllocations.length);
        for (uint256 i = 0; i < toMintAllocations.length; i++) {
          // Calc what would have been the correct allocations percentage if all was available
          tempAllocations[i] = toMintAllocations[i].mul(100000).div(totalToMint);
        }

        uint256[] memory partialAmounts = _amountsFromAllocations(tempAllocations, totalRedeemd);
        _mintWithAmounts(allAvailableTokens, partialAmounts);
      }

      return true; // hasRebalanced
  }

  /**
   * Update avg price paid for each idle token of a user
   *
   * @param usr : user that should have balance update
   * @param qty : new amount deposited / transferred, in idleToken
   * @param price : curr idleToken price in underlying
   */
  function _updateAvgPrice(address usr, uint256 qty, uint256 price) internal {
    if (fee == 0) {
      userNoFeeQty[usr] = userNoFeeQty[usr].add(qty);
      return;
    }

    uint256 totBalance = balanceOf(usr).sub(userNoFeeQty[usr]);
    uint256 oldAvgPrice = userAvgPrices[usr];
    uint256 oldBalance = totBalance.sub(qty);
    userAvgPrices[usr] = oldAvgPrice.mul(oldBalance).div(totBalance).add(price.mul(qty).div(totBalance));
  }

  /**
   * Calculate fee and send them to feeAddress
   *
   * @param amount : in idleTokens
   * @param redeemed : in underlying
   * @return : net value in underlying
   */
  function _getFee(uint256 amount, uint256 redeemed) internal returns (uint256) {
    uint256 noFeeQty = userNoFeeQty[msg.sender];
    uint256 currPrice = tokenPrice();
    if (noFeeQty > 0 && noFeeQty > amount) {
      noFeeQty = amount;
    }

    uint256 totalValPaid = noFeeQty.mul(currPrice).add(amount.sub(noFeeQty).mul(userAvgPrices[msg.sender])).div(10**18);
    uint256 currVal = amount.mul(currPrice).div(10**18);
    if (currVal < totalValPaid) {
      return redeemed;
    }
    uint256 gain = currVal.sub(totalValPaid);
    uint256 feeDue = gain.mul(fee).div(100000);
    IERC20(token).safeTransfer(feeAddress, feeDue);
    userNoFeeQty[msg.sender] = userNoFeeQty[msg.sender].sub(noFeeQty);
    return currVal.sub(feeDue);
  }

  /**
   * Mint specific amounts of protocols tokens
   *
   * @param tokenAddresses : array of protocol tokens
   * @param protocolAmounts : array of amounts to be minted
   * @return : net value in underlying
   */
  function _mintWithAmounts(address[] memory tokenAddresses, uint256[] memory protocolAmounts) internal {
    // mint for each protocol and update currentTokensUsed
    require(tokenAddresses.length == protocolAmounts.length, "All tokens length != allocations length");

    uint256 currAmount;

    for (uint256 i = 0; i < protocolAmounts.length; i++) {
      currAmount = protocolAmounts[i];
      if (currAmount == 0) {
        continue;
      }
      _mintProtocolTokens(protocolWrappers[tokenAddresses[i]], currAmount);
    }
  }

  /**
   * Calculate amounts from percentage allocations (100000 => 100%)
   *
   * @param allocations : array of protocol allocations in percentage
   * @param total : total amount
   * @return : array with amounts
   */
  function _amountsFromAllocations(uint256[] memory allocations, uint256 total)
    internal pure returns (uint256[] memory) {
    uint256[] memory newAmounts = new uint256[](allocations.length);
    uint256 currBalance = 0;
    uint256 allocatedBalance = 0;

    for (uint256 i = 0; i < allocations.length; i++) {
      if (i == allocations.length - 1) {
        newAmounts[i] = total.sub(allocatedBalance);
      } else {
        currBalance = total.mul(allocations[i]).div(100000);
        allocatedBalance = allocatedBalance.add(currBalance);
        newAmounts[i] = currBalance;
      }
    }
    return newAmounts;
  }

  /**
   * Redeem all underlying needed from each protocol
   *
   * @param tokenAddresses : array of protocol tokens addresses
   * @param amounts : array with current allocations in underlying
   * @param newAmounts : array with new allocations in underlying
   * @return toMintAllocations : array with amounts to be minted
   * @return totalToMint : total amount that needs to be minted
   */
  function _redeemAllNeeded(
    address[] memory tokenAddresses,
    uint256[] memory amounts,
    uint256[] memory newAmounts
    ) internal returns (
      uint256[] memory toMintAllocations,
      uint256 totalToMint,
      bool lowLiquidity
    ) {
    require(amounts.length == newAmounts.length, 'Lengths not equal');
    toMintAllocations = new uint256[](amounts.length);
    ILendingProtocol protocol;
    uint256 currAmount;
    uint256 newAmount;
    address currToken;
    // check the difference between amounts and newAmounts
    for (uint256 i = 0; i < amounts.length; i++) {
      currToken = tokenAddresses[i];
      newAmount = newAmounts[i];
      currAmount = amounts[i];
      protocol = ILendingProtocol(protocolWrappers[currToken]);
      if (currAmount > newAmount) {
        toMintAllocations[i] = 0;
        uint256 toRedeem = currAmount.sub(newAmount);
        uint256 availableLiquidity = protocol.availableLiquidity();
        if (availableLiquidity < toRedeem) {
          lowLiquidity = true;
          toRedeem = availableLiquidity;
        }
        // redeem the difference
        _redeemProtocolTokens(
          protocolWrappers[currToken],
          currToken,
          // convert amount from underlying to protocol token
          toRedeem.mul(10**18).div(protocol.getPriceInToken()),
          address(this) // tokens are now in this contract
        );
      } else {
        toMintAllocations[i] = newAmount.sub(currAmount);
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
   * @return total : total AUM in underlying
   */
  function _getCurrentAllocations() internal view
    returns (address[] memory tokenAddresses, uint256[] memory amounts, uint256 total) {
      // Get balance of every protocol implemented
      tokenAddresses = new address[](allAvailableTokens.length);
      amounts = new uint256[](allAvailableTokens.length);

      address currentToken;
      uint256 currTokenPrice;

      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
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

  // ILendingProtocols calls
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
      // Transfer _amount underlying token (eg. DAI) to _wrapperAddr
      IERC20(token).safeTransfer(_wrapperAddr, _amount);
      tokens = ILendingProtocol(_wrapperAddr).mint();
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
      // Transfer _amount of _protocolToken (eg. cDAI) to _wrapperAddr
      IERC20(_token).safeTransfer(_wrapperAddr, _amount);
      tokens = ILendingProtocol(_wrapperAddr).redeem(_account);
  }
}
