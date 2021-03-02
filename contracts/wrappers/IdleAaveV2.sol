/**
 * @title: Aave wrapper
 * @summary: Used for interacting with Aave. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IAToken.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/AaveLendingPoolProviderV2.sol";
import "../interfaces/AaveLendingPoolV2.sol";
import "../interfaces/DataTypes.sol";
import "../interfaces/IVariableDebtToken.sol";
import "../interfaces/IStableDebtToken.sol";
import "../interfaces/AaveInterestRateStrategyV2.sol";

contract IdleAaveV2 is ILendingProtocol, DataTypes, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (aToken) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;
  address public idleToken;
  bool public initialized;

  AaveLendingPoolProviderV2 public provider;

  /**
   * @param _token : aToken address
   * @param _addressesProvider : aave addresses provider
   * @param _idleToken : idleToken address
   */
  function initialize(address _token, address _addressesProvider, address _idleToken) public {
    require(!initialized, "Already initialized");
    require(_token != address(0), 'AAVE: addr is 0');

    token = _token;
    underlying = IAToken(_token).UNDERLYING_ASSET_ADDRESS();
    idleToken = _idleToken;
    provider = AaveLendingPoolProviderV2(_addressesProvider);
    IERC20(underlying).safeApprove(provider.getLendingPool(), uint256(-1));
    initialized = true;
  }

  /**
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken");
    _;
  }

  /**
   * Not used
   */
  function nextSupplyRateWithParams(uint256[] calldata)
    external view
    returns (uint256) {
    return 0;
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
      AaveLendingPoolV2 core = AaveLendingPoolV2(provider.getLendingPool());
      DataTypes.ReserveData memory data = core.getReserveData(underlying);
      AaveInterestRateStrategyV2 apr = AaveInterestRateStrategyV2(data.interestRateStrategyAddress);

      (uint256 totalStableDebt, uint256 avgStableRate) = IStableDebtToken(data.stableDebtTokenAddress).getTotalSupplyAndAvgRate();

      uint256 totalVariableDebt = IVariableDebtToken(data.variableDebtTokenAddress)
        .scaledTotalSupply()
        .mul(data.variableBorrowIndex).div(10**27);

      uint256 availableLiquidity = IERC20(underlying).balanceOf(data.aTokenAddress);

      (uint256 newLiquidityRate,,) = apr.calculateInterestRates(
        underlying,
        availableLiquidity.add(_amount),
        totalStableDebt,
        totalVariableDebt,
        avgStableRate,
        getReserveFactor(data.configuration)
      );
      return newLiquidityRate.div(10**7); // .mul(100).div(10**9)
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
      DataTypes.ReserveData memory data = AaveLendingPoolV2(provider.getLendingPool()).getReserveData(underlying);
      return uint256(data.currentLiquidityRate).div(10**7); // .mul(100).div(10**9)
  }

  /**
   * Gets all underlying tokens in this contract and mints aTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sent here before calling this
   * NOTE2: given that aToken price is always 1 token -> underlying.balanceOf(this) == token.balanceOf(this)
   *
   * @return aTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 tokens) {
      tokens = IERC20(underlying).balanceOf(address(this));
      AaveLendingPoolV2 lendingPool = AaveLendingPoolV2(provider.getLendingPool());
      lendingPool.deposit(underlying, tokens, msg.sender, 29); // 29 -> referral
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
      tokens = IERC20(token).balanceOf(address(this));
      AaveLendingPoolV2(provider.getLendingPool()).withdraw(underlying, tokens, _account);
  }

  /**
   * Get the underlying balance on the lending protocol
   *
   * @return underlying tokens available
   */
  function availableLiquidity() external view returns (uint256) {
    return IERC20(underlying).balanceOf(token);
  }
}
