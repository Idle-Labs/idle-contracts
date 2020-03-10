/**
 * @title: Compound wrapper
 * @summary: Used for interacting with Compound. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "../interfaces/ILendingProtocol.sol";
import "../interfaces/IInterestSetter.sol";
import "../interfaces/DyDx.sol";
import "../interfaces/DyDxStructs.sol";
import "./yxToken.sol";

contract IdleDyDx is ILendingProtocol, Ownable, DyDxStructs {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public marketId;
  uint256 public secondsInAYear;
  // underlying token (token eg DAI) address
  address public underlying;
  address public token;
  address public idleToken;
  address public dydxAddressesProvider = address(0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e);
  /**
   * @param _underlying : underlying token (eg DAI) address
   * @param _token : protocol token (eg cDAI) address
   * @param _marketId : dydx market id
   */
  constructor(address _token, address _underlying, uint256 _marketId)
    public {
    require(_underlying != address(0), 'COMP: some addr is 0');

    secondsInAYear = 31536000; // 60 * 60 * 24 * 356
    underlying = _underlying;
    token = _token;
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
  /**
   * sets secondsInAYear address
   * @param _secondsInAYear : secondsInAYear address
   */
  function setSecondsInAYear(uint256 _secondsInAYear)
    external onlyOwner {
      require(_secondsInAYear != 0, "_secondsInAYear addr is 0");
      secondsInAYear = _secondsInAYear;
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
      address interestSetterAddr = dydx.getMarketInterestSetter(marketId);
      uint256 borrow = uint256(dydx.getMarketTotalPar(marketId).borrow).mul(dydx.getMarketCurrentIndex(marketId).borrow).div(10**18);
      uint256 supply = uint256(dydx.getMarketTotalPar(marketId).supply).mul(dydx.getMarketCurrentIndex(marketId).supply).div(10**18);
      uint256 usage = borrow.mul(10**18).div(supply.add(_amount));
      // Here we are calc the new borrow rate when we supply `_amount` liquidity
      uint256 borrowRatePerSecond = IInterestSetter(IInterestSetter).getInterestRate(marketId, borrow, supply.add(_amount));
      uint256 aprBorrow = borrowRatePerSecond.mul(secondsInAYear);
      return aprBorrow.mul(usage).div(10**18).mul(dydx.getEarningsRate().value).mul(100).div(10**18);
  }

  /**
   * @return current price of yxToken in underlying
   */
  function getPriceInToken()
    public view
    returns (uint256) {
    return yxToken(token).price();
  }

  /**
   * @return apr : current yearly net rate
   */
  function getAPR()
    external view
    returns (uint256) {
      DyDx dydx = DyDx(dydxAddressesProvider);
      uint256 borrow = uint256(dydx.getMarketTotalPar(marketId).borrow).mul(dydx.getMarketCurrentIndex(marketId).borrow).div(10**18);
      uint256 supply = uint256(dydx.getMarketTotalPar(marketId).supply).mul(dydx.getMarketCurrentIndex(marketId).supply).div(10**18);
      uint256 usage = borrow.mul(10**18).div(supply);
      // Here we get the current borrow rate
      uint256 borrowRatePerSecond = dydx.getMarketInterestRate(marketId).value;
      uint256 aprBorrow = borrowRatePerSecond.mul(secondsInAYear);
      return aprBorrow.mul(usage).div(10**18).mul(dydx.getEarningsRate().value).mul(100).div(10**18);
  }

  /**
   * Gets all underlying tokens in this contract and mints yxTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return yxTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 yxTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return newTokens;
      }
      // approve the transfer to yxToken contract
      IERC20(underlying).safeIncreaseAllowance(token, balance);
      // get a handle for the corresponding yxToken contract
      yxToken yxToken = yxToken(token);
      // mint the yxTokens
      yxToken.mint(balance);
      // yxTokens are now in this contract
      yxTokens = IERC20(token).balanceOf(address(this));
      // transfer them to the caller
      IERC20(token).safeTransfer(msg.sender, yxTokens);
  }

  /**
   * Gets all yxTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: yxTokens needs to be sended here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
      // Funds needs to be sended here before calling this
      yxToken yxToken = yxToken(token);
      IERC20 _underlying = IERC20(underlying);
      // redeem all underlying sent in this contract
      yxToken.redeem(IERC20(token).balanceOf(address(this)));

      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);
  }

  function availableLiquidity() external view returns (uint256) {
    return IERC20(underlying).balanceOf(dydxAddressesProvider);
  }

  function balanceInUnderlying(address who) public view returns (uint256) {
    Wei memory bal = DyDx(dydxAddressesProvider).getAccountWei(Info(who, 0), marketId);
    return bal.value;
  }
}
