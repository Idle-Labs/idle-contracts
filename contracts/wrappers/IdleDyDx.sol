/**
 * @title: Compound wrapper
 * @summary: Used for interacting with Compound. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "../interfaces/ILendingProtocol.sol";
import "../interfaces/DyDx.sol";
import "../interfaces/DyDxStructs.sol";

contract IdleDyDx is ILendingProtocol, Ownable, DyDxStructs, ERC20, ERC20Detailed {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public marketId;
  // underlying token (token eg DAI) address
  address public underlying;
  address public idleToken;
  address public dydxAddressesProvider = address(0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e);
  /**
   * @param _underlying : underlying token (eg DAI) address
   * @param _marketId : dydx market id
   * @param _name : dydx market tokenized name
   * @param _symbol : dydx market tokenized symbol
   * @param _decimals : dydx market tokenized decimals
   */
  constructor(address _underlying, uint256 _marketId, string memory _name, string memory _symbol, uint8 _decimals)
    public ERC20Detailed(_name, _symbol, _decimals) {
    require(_underlying != address(0), 'COMP: some addr is 0');

    underlying = _underlying;
    marketId = _marketId; // 0, ETH, (1 SAI not available), 2 USDC, 3 DAI
  }

  /**
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken contract");
    _;
  }

  // onlyOwner
  /**
   * sets idleToken address
   * NOTE: can be called only once. It's not on the constructor because we are deploying this contract
   *       after the IdleToken contract
   * @param _idleToken : idleToken address
   */
  function setIdleToken(address _idleToken)
    external onlyOwner {
      require(idleToken == address(0), "idleToken addr already set");
      require(_idleToken != address(0), "_idleToken addr is 0");
      idleToken = _idleToken;
  }

  /**
   * sets dydxAddressesProvider address
   * @param _dydxAddressesProvider : dydxAddressesProvider address
   */
  function setDydxAddressesProvider(address _dydxAddressesProvider)
    external onlyOwner {
      require(_dydxAddressesProvider != address(0), "_dydxAddressesProvider addr is 0");
      dydxAddressesProvider = _dydxAddressesProvider;
  }
  // end onlyOwner

  /**
   * Calculate next supply rate for Compound, given an `_amount` supplied (last array param)
   * and all other params supplied. See `info_compound.md` for more info
   * on calculations.
   *
   * @param params : array with all params needed for calculation (see below)
   * @return : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] calldata params)
    external view
    returns (uint256) {
      return nextSupplyRate(params[params.length - 1]);
  }

  /**
   * Calculate next supply rate for Compound, given an `_amount` supplied
   *
   * @param _amount : new underlying amount supplied (eg DAI)
   * @return : yearly net rate
   */
  function nextSupplyRate(uint256 _amount)
    public view
    returns (uint256) {
      DyDx dydx = DyDx(dydxAddressesProvider);
      uint256 borrowRate = dydx.getMarketInterestRate(marketId).value;
      uint256 aprBorrow = borrowRate.mul(31622400);
      uint256 borrow = dydx.getMarketTotalPar(marketId).borrow;
      uint256 supply = dydx.getMarketTotalPar(marketId).supply;
      uint256 usage = borrow.mul(10**18).div(supply.add(_amount));
      return aprBorrow.mul(usage).div(10**18).mul(dydx.getEarningsRate().value).div(10**18);
  }

  /**
   * @return current price of cToken in underlying
   */
  function getPriceInToken()
    public view
    returns (uint256) {
    return balanceInUnderlying(address(this)).mul(10**18).div(totalSupply());
  }

  /**
   * @return apr : current yearly net rate
   */
  function getAPR()
    external view
    returns (uint256) {
      return nextSupplyRate(0);
  }

  /**
   * Gets all underlying tokens in this contract and mints cTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return cTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 newTokens) {
      // mint IERC20 for dydx tokenized position
      uint256 price = getPriceInToken();
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      newTokens = balance.mul(10**18).div(price);
      _mint(msg.sender, newTokens);

      // Use underlying and supply it to dydx
      Info[] memory infos = new Info[](1);
      infos[0] = Info(address(this), 0);

      AssetAmount memory amt = AssetAmount(true, AssetDenomination.Wei, AssetReference.Delta, balance);
      ActionArgs memory act;
      act.actionType = ActionType.Deposit;
      act.accountId = 0;
      act.amount = amt;
      act.primaryMarketId = marketId;
      act.otherAddress = address(this);

      ActionArgs[] memory args = new ActionArgs[](1);
      args[0] = act;

      DyDx(dydxAddressesProvider).operate(infos, args);
  }

  /**
   * Gets all cTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: cTokens needs to be sended here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
      uint256 balance = balanceOf(address(this));
      uint256 toRedeem = balance.mul(getPriceInToken()).div(10**18);

      Info[] memory infos = new Info[](1);
      infos[0] = Info(address(this), 0);

      AssetAmount memory amt = AssetAmount(false, AssetDenomination.Wei, AssetReference.Delta, toRedeem);
      ActionArgs memory act;
      act.actionType = ActionType.Withdraw;
      act.accountId = 0;
      act.amount = amt;
      act.primaryMarketId = marketId;
      act.otherAddress = address(this);

      ActionArgs[] memory args = new ActionArgs[](1);
      args[0] = act;

      DyDx(dydxAddressesProvider).operate(infos, args);

      // transfer redeemed tokens to _account
      IERC20 _underlying = IERC20(underlying);
      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);

      _burn(msg.sender, balance);
  }

  function availableLiquidity() external view returns (uint256) {
    return IERC20(underlying).balanceOf(dydxAddressesProvider);
  }

  function balanceInUnderlying(address who) public view returns (uint256) {
    Wei memory bal = DyDx(dydxAddressesProvider).getAccountWei(Info(who, 0), marketId);
    return bal.value;
  }
}
