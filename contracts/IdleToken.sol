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

import "./IdleRebalancer.sol";

contract IdleToken is ERC20, ERC20Detailed, ReentrancyGuard, Ownable, Pausable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocolWrappers may be changed/updated/removed do not rely on their
  // addresses to determine where funds are allocated

  // eg. cTokenAddress => IdleCompoundAddress
  mapping(address => address) public protocolWrappers;
  // eg. DAI address
  address public token;
  // eg. iDAI address
  address public iToken; // used for claimITokens and userClaimITokens
  // Min thresold of APR difference between protocols to trigger a rebalance
  uint256 public minRateDifference;
  // Idle rebalancer current implementation address
  address public rebalancer;

  // no one can directly change this
  // Idle pool current investments eg. [cTokenAddress, iTokenAddress]
  address[] public currentTokensUsed;
  // eg. [cTokenAddress, iTokenAddress, ...]
  address[] public allAvailableTokens;

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
    address _idleCompound,
    address _idleFulcrum)
    public
    ERC20Detailed(_name, _symbol, _decimals) {
      token = _token;
      iToken = _iToken; // used for claimITokens and userClaimITokens methods
      rebalancer = _rebalancer;
      protocolWrappers[_cToken] = _idleCompound;
      protocolWrappers[_iToken] = _idleFulcrum;
      allAvailableTokens = [_cToken, _iToken];
      minRateDifference = 100000000000000000; // 0.1% min
  }

  // onlyOwner
  function setToken(address _token)
    external onlyOwner {
      token = _token;
  }
  function setIToken(address _iToken)
    external onlyOwner {
      iToken = _iToken;
  }
  function setRebalancer(address _rebalancer)
    external onlyOwner {
      rebalancer = _rebalancer;
  }
  function setProtocolWrapper(address _token, address _wrapper)
    external onlyOwner {
      // update allAvailableTokens if needed
      if (protocolWrappers[_token] == address(0)) {
        allAvailableTokens.push(_token);
      }
      protocolWrappers[_token] = _wrapper;
  }
  function setMinRateDifference(uint256 _rate)
    external onlyOwner {
      minRateDifference = _rate;
  }

  // view
  /**
   * @dev IdleToken price calculation
   */
  function tokenPrice()
    public view
    returns (uint256 price) {
      uint256 totalSupply = this.totalSupply();
      if (totalSupply == 0) {
        return 10**18;
      }

      uint256 currPrice;
      uint256 currNav;
      uint256 totNav;
      for (uint8 i = 0; i < currentTokensUsed.length; i++) {
        currPrice = ILendingProtocol(protocolWrappers[currentTokensUsed[i]]).getPriceInToken();
        // NAV = price * poolSupply
        currNav = currPrice.mul(IERC20(currentTokensUsed[i]).balanceOf(address(this)));
        totNav = totNav.add(currNav);
      }

      price = totNav.div(totalSupply); // idleToken price in token wei
  }

  /**
   * @dev call getAPR of every ILendingProtocol
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

  // external
  // TODO add event here? a mint event is already raised from erc20 mint
  // maybe for rebalance?
  // We should save the amount one has deposited to calc interests

  /**
   * @dev User should 'approve' _amount of tokens before calling mintIdleToken
   */
  function mintIdleToken(uint256 _amount)
    external nonReentrant whenNotPaused
    returns (uint256 mintedTokens) {
      // Get current IdleToken price
      uint256 idlePrice = tokenPrice();
      // transfer tokens to this contract
      IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
      // Rebalance the current pool if needed and mint new supplyied amount
      rebalance(_amount);

      mintedTokens = _amount.mul(10**18).div(idlePrice);
      _mint(msg.sender, mintedTokens);
  }

  /**
   * @dev here we calc the pool share of the cTokens | iTokens one can withdraw
   */
  function redeemIdleToken(uint256 _amount)
    external nonReentrant
    returns (uint256) {
      uint256 idleSupply = this.totalSupply();
      require(idleSupply > 0, "No IDLEDAI have been issued");

      address currentToken;
      uint256 protocolPoolBalance;
      uint256 toRedeem;

      for (uint8 i = 0; i < currentTokensUsed.length; i++) {
        currentToken = currentTokensUsed[i];
        protocolPoolBalance = IERC20(currentToken).balanceOf(address(this));
        toRedeem = _amount.mul(protocolPoolBalance).div(idleSupply);
        _redeemProtocolTokens(protocolWrappers[currentToken], currentToken, _amount, msg.sender);
      }

      _burn(msg.sender, _amount);
      rebalance(0);
  }

  /**
   * @dev here we are redeeming unclaimed token from iToken contract to this contracts
   * then allocating claimedTokens with rebalancing
   * Everyone should be incentivized in calling this method
   */
  function claimITokens()
    external whenNotPaused
    returns (uint256 claimedTokens) {
      claimedTokens = iERC20Fulcrum(iToken).claimLoanToken();
      rebalance(claimedTokens);
  }

  /**
   * @dev Dynamic allocate all the pool across different lending protocols
   * if needed
   * Everyone should be incentivized in calling this method
   *
   * If _newAmount == 0 then simple rebalance
   * else rebalance (if needed) and mint (always)
   */

  function rebalance(uint256 _newAmount)
    public whenNotPaused
    returns (bool) {
      if (!_rebalanceCheck(_newAmount)) {
        if (_newAmount > 0) {
          _mintProtocolTokens(protocolWrappers[currentTokensUsed[0]], _newAmount);
        }
        return false; // hasNotRebalanced
      }

      // redeem from every protocol
      // - get current protocol used
      TokenProtocol[] memory tokenProtocols = _getCurrentProtocols();
      // - redeem everything from each protocol
      for (uint8 i = 0; i < tokenProtocols.length; i++) {
        _redeemProtocolTokens(
          tokenProtocols[i].protocolAddr,
          tokenProtocols[i].tokenAddr,
          IERC20(tokenProtocols[i].tokenAddr).balanceOf(address(this)),
          address(this) // token are now in this contract
        );
      }

      // calcAmounts
      uint256 tokenBalance = IERC20(token).balanceOf(address(this));
      // tokenBalance here has already _newAmount counted
      (address[] memory tokenAddresses, uint256[] memory protocolAmounts) = _calcAmounts(tokenBalance);

      // remove all elements from `currentTokensUsed`
      delete currentTokensUsed;

      // mint for each protocol and update currentTokensUsed
      uint256 currAmount;
      address currAddr;
      for (uint8 i = 0; i < protocolAmounts.length; i++) {
        currAmount = protocolAmounts[i];
        if (currAmount == 0) {
          continue;
        }
        currAddr = tokenAddresses[i];
        _mintProtocolTokens(protocolWrappers[currAddr], currAmount);
        // update current tokens used in IdleToken storage
        currentTokensUsed.push(currAddr);
      }

      return true; // hasRebalanced
  }

  // if there is only one protocol and has the best rate then check the nextRateWithAmount()
  // if rate is still the highest then put everything there
  // otherwise rebalance with all amount
  function _rebalanceCheck(uint256 _newAmount)
    public view
    returns (bool) {
      // if we are invested in more than a single protocol or there are no protocols used (ie afer deploy) then rebalance
      if (currentTokensUsed.length > 1 || currentTokensUsed.length == 0) {
        return true;
      }

      (address[] memory addresses, uint256[] memory aprs) = getAPRs();
      if (aprs.length == 0) {
        return false;
      }

      // we are trying to find if the currentTokenUsed has still the best APR
      // and eventually if the nextRateWithAmount is still the best
      address currTokenUsed = currentTokensUsed[0];
      uint256 currTokenApr;

      uint256 maxRate = aprs[0];
      uint256 secondBestRate;
      uint256 currApr;

      for (uint8 i = 0; i < aprs.length; i++) {
        currApr = aprs[i];
        if (currTokenUsed == addresses[i]) {
          currTokenApr = currApr;
        }
        if (currApr > maxRate) {
          secondBestRate = maxRate;
          maxRate = currApr;
        } else if (currApr < maxRate && currApr > secondBestRate) {
          secondBestRate = currApr;
        }
      }
      if (currTokenApr < maxRate) {
        return true;
      }

      uint256 nextRate;
      if (_newAmount > 0) {
        nextRate = _getProtocolNextRate(protocolWrappers[currTokenUsed], _newAmount);
        // TODO use minRateDifference
        /* if (nextRate < secondBestRate || ) { */
        if (nextRate < secondBestRate) {
          return true;
        }
      }

      return false;
  }

  // internal
  function _calcAmounts(uint256 _amount)
    internal view
    returns (address[] memory, uint256[] memory) {
      return IdleRebalancer(rebalancer).calcRebalanceAmounts(_amount);
  }

  // Get addresses of current protocols used by iterating through currentTokensUsed
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

  // ### ILendingProtocols calls

  // _wrapperAddr is the protocolWrappers address
  function _getProtocolNextRate(address _wrapperAddr, uint256 _amount)
    internal view
    returns (uint256 apr) {
      ILendingProtocol _wrapper = ILendingProtocol(_wrapperAddr);
      apr = _wrapper.nextSupplyRate(_amount);
  }
  // _wrapperAddr is the protocolWrappers address
  function _mintProtocolTokens(address _wrapperAddr, uint256 _amount)
    internal
    returns (uint256 cTokens) {
      ILendingProtocol _wrapper = ILendingProtocol(_wrapperAddr);
      // Transfer _amount underlying token (eg. DAI) to _wrapperAddr
      IERC20(token).safeTransfer(_wrapperAddr, _amount);
      cTokens = _wrapper.mint();
  }
  // _wrapperAddr is the protocolWrappers address
  // _amount of _token to redeem
  // _token to redeem
  // _account should be msg.sender when rebalancing and final user when redeeming
  function _redeemProtocolTokens(address _wrapperAddr, address _token, uint256 _amount, address _account)
    internal
    returns (uint256 tokens) {
      ILendingProtocol _wrapper = ILendingProtocol(_wrapperAddr);
      // Transfer _amount of _protocolToken (eg. cDAI) to _wrapperAddr
      IERC20(_token).safeTransfer(_wrapperAddr, _amount);
      tokens = _wrapper.redeem(_account);
  }
}
