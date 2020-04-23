pragma solidity 0.5.16;

interface AaveInterestRateStrategy {
  function getBaseVariableBorrowRate() external view returns (uint256);
  function calculateInterestRates(
    address _reserve,
    uint256 _utilizationRate,
    uint256 _totalBorrowsStable,
    uint256 _totalBorrowsVariable,
    uint256 _averageStableBorrowRate) external view
  returns (uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate);
}
