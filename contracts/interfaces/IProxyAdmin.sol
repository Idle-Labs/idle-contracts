pragma solidity 0.5.16;

interface IProxyAdmin {
  function owner() external view returns (address);
  function transferOwnership(address) external;
  function changeProxyAdmin(address proxy, address newAdmin) external;
  function getProxyAdmin(address proxy) external view returns (address);
  function getProxyImplementation(address proxy) external view returns (address);
  function upgrade(address proxy, address implementation) external;
  function upgradeAndCall(address proxy, address implementation, bytes calldata data) external;
}
