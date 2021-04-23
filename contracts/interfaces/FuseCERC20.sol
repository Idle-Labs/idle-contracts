pragma solidity 0.5.16;

interface FuseCERC20 {
  function totalReserves() external view returns (uint256);
  function getCash() external view returns (uint256);
  function totalBorrows() external view returns (uint256);
  function reserveFactorMantissa() external view returns (uint256);
  function interestRateModel() external view returns (address);
  function underlying() external view returns (address);
  function totalFuseFees() external view returns(uint256);
  function totalAdminFees() external view returns(uint256);
  function fuseFeeMantissa() external view returns(uint256);
  function adminFeeMantissa() external view returns(uint256);
}
