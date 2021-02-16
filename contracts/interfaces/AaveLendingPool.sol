pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "../interfaces/DataTypes.sol";

interface AaveLendingPool {
  function deposit(address _reserve, uint256 _amount, uint16 _referralCode) external;
  function getReserveData(address _reserve) external view returns (DataTypes.ReserveData memory);
  // function getReserveData(address _reserve)
  //   external view returns (
  //     uint256 totalLiquidity,
  //     uint256 availableLiquidity,
  //     uint256 totalBorrowsStable,
  //     uint256 totalBorrowsVariable,
  //     uint256 liquidityRate,
  //     uint256 variableBorrowRate,
  //     uint256 stableBorrowRate,
  //     uint256 averageStableBorrowRate,
  //     uint256 utilizationRate,
  //     uint256 liquidityIndex,
  //     uint256 variableBorrowIndex,
  //     address aTokenAddress,
  //     uint40 lastUpdateTimestamp
  //   );
}
