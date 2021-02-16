pragma solidity 0.5.16;

interface IStableDebtToken {
  function getTotalSupplyAndAvgRate() external view returns (uint256, uint256);
}
