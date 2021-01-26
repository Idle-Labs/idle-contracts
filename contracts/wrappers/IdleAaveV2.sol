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
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/ILendingProtocol.sol";
import "../interfaces/AaveLendingPoolProviderV2.sol";
import "../interfaces/AaveLendingPoolV2.sol";
import "../interfaces/DataTypes.sol";
import "../interfaces/IVariableDebtToken.sol";
import "../interfaces/IStableDebtToken.sol";
import "../interfaces/AaveInterestRateStrategyV2.sol";

contract IdleAaveV2 is ILendingProtocol, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (aToken) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;

  address public constant aaveAddressesProvider = address(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
  AaveLendingPoolProviderV2 provider = AaveLendingPoolProviderV2(aaveAddressesProvider);

  /**
   * @param _token : aToken address
   * @param _underlying : underlying token (eg DAI) address
   */
  constructor(address _token, address _underlying) public {
    require(_token != address(0) && _underlying != address(0), 'AAVE: some addr is 0');

    token = _token;
    underlying = _underlying;
    IERC20(_underlying).safeApprove(
      provider.getLendingPool(),
      uint256(-1)
    );
  }

  /**
   * Calculate next supply rate for Aave, given an `_amount` supplied (last array param)
   * and all other params supplied.
   * on calculations.
   *
   * @param _ : array with all params needed for calculation (see below)
   * @return : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] calldata _)
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
      return newLiquidityRate.mul(100).div(10**9);
  }

  // copied from https://github.com/aave/protocol-v2/blob/dbd77ad9312f607b420da746c2cb7385d734b015/contracts/protocol/libraries/configuration/ReserveConfiguration.sol#L242
  function getReserveFactor(DataTypes.ReserveConfigurationMap memory self) internal pure returns (uint256) {
    uint256 RESERVE_FACTOR_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000FFFFFFFFFFFFFFFF; // prettier-ignore
    uint256 RESERVE_FACTOR_START_BIT_POSITION = 64;

    return (self.data & ~RESERVE_FACTOR_MASK) >> RESERVE_FACTOR_START_BIT_POSITION;
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
      return uint256(data.currentLiquidityRate).mul(100).div(10**9);
  }

  /**
   * Gets all underlying tokens in this contract and mints aTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sent here before calling this
   *
   * @return aTokens minted
   */
  function mint()
    external
    returns (uint256 aTokens) {
      aTokens = IERC20(underlying).balanceOf(address(this));
      if (aTokens == 0) {
        return aTokens;
      }
      AaveLendingPoolV2 lendingPool = AaveLendingPoolV2(provider.getLendingPool());
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      lendingPool.deposit(underlying, balance, msg.sender, 29); // 29 -> referral
  }

  /**
   * Gets all aTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: aTokens needs to be sent here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external
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
    return IERC20(token).balanceOf(provider.getLendingPool());
  }
}
