pragma solidity 0.5.16;

interface IAdminUpgradeabilityProxy {
  function admin() external view returns (address);
  function changeAdmin(address) external;
}
