/**
 * @title: Aave wrapper
 * @summary: Used for interacting with Aave. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/ILendingProtocol.sol";
import "../interfaces/AaveLendingPoolProvider.sol";
import "../interfaces/AaveLendingPool.sol";
import "../interfaces/AaveLendingPoolCore.sol";
import "../interfaces/AToken.sol";
import "../interfaces/AaveInterestRateStrategy.sol";

contract IdleAave is ILendingProtocol, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (aToken) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;
  address public idleToken;

  address public constant aaveAddressesProvider = address(0x24a42fD28C976A61Df5D00D0599C34c4f90748c8);
  AaveLendingPoolProvider provider = AaveLendingPoolProvider(aaveAddressesProvider);

  /**
   * @param _token : aToken address
   * @param _underlying : underlying token (eg DAI) address
   */
  constructor(address _token, address _underlying) public {
    require(_token != address(0) && _underlying != address(0), 'AAVE: some addr is 0');

    token = _token;
    underlying = _underlying;
    IERC20(_underlying).safeApprove(
      provider.getLendingPoolCore(),
      uint256(-1)
    );
  }

  /**
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken");
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
  // end onlyOwner

  /**
   * Calculate next supply rate for Aave, given an `_amount` supplied (last array param)
   * and all other params supplied.
   * on calculations.
   *
   * @param params : array with all params needed for calculation (see below)
   * @return : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] calldata params)
    external view
    returns (uint256) {
      AaveLendingPoolCore core = AaveLendingPoolCore(provider.getLendingPoolCore());
      AaveInterestRateStrategy apr = AaveInterestRateStrategy(core.getReserveInterestRateStrategyAddress(underlying));
      /*
        params[0] = core.getReserveAvailableLiquidity(underlying);
        params[1] = core.getReserveTotalBorrowsStable(underlying);
        params[2] = core.getReserveTotalBorrowsVariable(underlying);
        params[3] = core.getReserveCurrentAverageStableBorrowRate(underlying);
        params[4] = _amount;
      */

      (uint256 newLiquidityRate,,) = apr.calculateInterestRates(
        underlying,
        params[0].add(params[4]),
        params[1],
        params[2],
        params[3]
      );

      // newLiquidityRate is in RAY (ie 1e27)
      // also newLiquidityRate is in the form 0.03 * 1e27
      // while we need the result in the form 3 * 1e18
      return newLiquidityRate.mul(100).div(10**9);
  }

  /**
   * Calculate next supply rate for Aave, given an `_amount` supplied
   *
   * @param _amount : new underlying amount supplied (eg DAI)
   * @return : yearly net rate
   */
  function nextSupplyRate(uint256 _amount)
    external view
    returns (uint256) {
      AaveLendingPoolCore core = AaveLendingPoolCore(provider.getLendingPoolCore());
      AaveInterestRateStrategy apr = AaveInterestRateStrategy(core.getReserveInterestRateStrategyAddress(underlying));

      (uint256 newLiquidityRate,,) = apr.calculateInterestRates(
        underlying,
        core.getReserveAvailableLiquidity(underlying).add(_amount),
        core.getReserveTotalBorrowsStable(underlying),
        core.getReserveTotalBorrowsVariable(underlying),
        core.getReserveCurrentAverageStableBorrowRate(underlying)
      );
      return newLiquidityRate.mul(100).div(10**9);
  }

  /**
   * @return current price of aToken in underlying, Aave price is always 1
   */
  function getPriceInToken()
    external view
    returns (uint256) {
      return 10**18;
  }

  /**
   * @return apr : current yearly net rate
   */
  function getAPR()
    external view
    returns (uint256) {
      AaveLendingPoolCore core = AaveLendingPoolCore(provider.getLendingPoolCore());
      return core.getReserveCurrentLiquidityRate(underlying).mul(100).div(10**9);
  }

  /**
   * Gets all underlying tokens in this contract and mints aTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sent here before calling this
   *
   * @return aTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 aTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return aTokens;
      }
      AaveLendingPool lendingPool = AaveLendingPool(provider.getLendingPool());
      lendingPool.deposit(underlying, balance, 29); // 29 -> referral
      aTokens = IERC20(token).balanceOf(address(this));
      // transfer them to the caller
      IERC20(token).safeTransfer(msg.sender, aTokens);
  }

  /**
   * Gets all aTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: aTokens needs to be sent here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
      AToken(token).redeem(IERC20(token).balanceOf(address(this)));
      IERC20 _underlying = IERC20(underlying);

      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);
  }

  function availableLiquidity() external view returns (uint256) {
    AaveLendingPoolCore core = AaveLendingPoolCore(provider.getLendingPoolCore());
    return IERC20(underlying).balanceOf(address(core));
  }
}
