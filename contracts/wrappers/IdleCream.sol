/**
 * @title: Cream DAI wrapper
 * @summary: Used for interacting with Cream Finance. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/ILendingProtocol.sol";

interface ICream {
  function mint(uint256 mintAmount) external returns (uint256);
  function redeem(uint256 redeemTokens) external returns (uint256);
  function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
  function borrow(uint256 borrowAmount) external returns (uint256);
  function repayBorrow(uint256 repayAmount) external returns (uint256);
  function repayBorrowBehalf(address borrower, uint256 repayAmount) external returns (uint256);
  function getCash() external view returns (uint256);
  function reserveFactorMantissa() external view returns (uint256);
  function totalBorrows() external view returns (uint256);
  function totalReserves() external view returns (uint256);
  function underlying() external view returns (uint256);
  function exchangeRateStored() external view returns (uint256);
}

interface ICreamJumpRateModelV2 {
  function getBorrowRate(uint256 cash, uint256 borrows, uint256 reserves) external view returns (uint256);
  function getSupplyRate(uint256 cash, uint256 borrows, uint256 reserves, uint256 reserveFactorMantissa) external view returns (uint256);
  function utilizationRate(uint256 cash, uint256 borrows, uint256 reserves) external pure returns (uint256);
}

contract IdleCream is ILendingProtocol {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (crDAI) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;
  address public idleToken;
  address public jumpRateModelV2;
  uint256 public blocksPerYear;

  /**
   * @param _token : crDAI address
   * @param _idleToken : idleToken address
   */
  function initialize(address _token, address _idleToken) public {
    require(token == address(0), 'crDAI: already initialized');
    require(_token != address(0), 'crDAI: addr is 0');

    token = _token;
    underlying = address(ICream(_token).underlying());
    idleToken = _idleToken;
    blocksPerYear = 2371428;
    IERC20(underlying).safeApprove(_token, uint256(-1));

    jumpRateModelV2 = address(0x014872728e7D8b1c6781f96ecFbd262Ea4D2e1A6);
  }

  /**
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken");
    _;
  }

  function nextSupplyRateWithParams(uint256[] memory params)
    external view
    returns (uint256) {
      uint256 oneMinusReserveFactor = uint256(1e18).sub(params[3]);
      uint256 borrowRate = ICreamJumpRateModelV2(jumpRateModelV2).getBorrowRate(params[0], params[1], params[2]);
      uint256 rateToPool = borrowRate.mul(oneMinusReserveFactor).div(1e18);
      uint256 ratePerBlock = ICreamJumpRateModelV2(jumpRateModelV2).utilizationRate(params[0], params[1], params[2]).mul(rateToPool).div(1e18);
      uint256 totalApy = ratePerBlock.div(1e8).mul(blocksPerYear).mul(100);
      return totalApy;
  }

  /**
   * Calculate next supply rate for crDAI, given an `_amount` supplied
   *
   * @param _amount : new underlying amount supplied (eg DAI)
   * @return : yearly net rate
   */
  function nextSupplyRate(uint256 _amount)
    external view
    returns (uint256) {
      uint256 cash = ICream(token).getCash();
      uint256 totalBorrows = ICream(token).totalBorrows();
      uint256 totalReserves = ICream(token).totalReserves().add(_amount);
      uint256 reserveFactorMantissa = ICream(token).reserveFactorMantissa();
      uint256[] memory _params = new uint256[](4);
      _params[0] = cash;
      _params[1] = totalBorrows;
      _params[2] = totalReserves;
      _params[3] = reserveFactorMantissa;
      return nextSupplyRateWithParams(_params);
  }

  /**
   * @return current price of crDAI token
   */
  function getPriceInToken()
    external view
    returns (uint256) {
      return ICream(token).exchangeRateStored();
  }

  /**
   * @return current apr
   */
  function getAPR()
    external view
    returns (uint256 apr) {
      // return nextSupplyRate(0); // current apr whne you pass amount 0
      return ICream(token).supplyRatePerBlock().mul(blocksPerYear).mul(100);
  }

  /**
   * Gets all underlying tokens in this contract and mints crDAI Tokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sent here before calling this
   * NOTE2: given that crDAI price is always 1 token -> underlying.balanceOf(this) == token.balanceOf(this)
   *
   * @return crDAI Tokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 crTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return crTokens;
      }
      require(ICream(token).mint(balance) == 0, "Error minting crTokens");
      crTokens = IERC20(token).balanceOf(address(this));
      IERC20(token).safeTransfer(msg.sender, crTokens);
  }

  /**
   * Gets all crDAI in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: crDAI needs to be sent here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
    require(ICream(token).redeem(IERC20(token).balanceOf(address(this))) == 0, "Error redeeming crTokens");
    IERC20 _underlying = IERC20(underlying);
    tokens = _underlying.balanceOf(address(this));
    _underlying.safeTransfer(_account, tokens);
  }

  /**
   * Get the underlying balance on the lending protocol
   *
   * @return underlying tokens available
   */
  function availableLiquidity() external view returns (uint256) {
    return ICream(token).getCash();
  }
}
