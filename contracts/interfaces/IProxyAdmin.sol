pragma solidity 0.5.16;

interface IProxyAdmin {
  function owner() external returns (address);
  function transferOwnership(address) external;
  function changeProxyAdmin(address proxy, address newAdmin) external;
  function getProxyAdmin(address proxy) external view returns (address);
  function upgrade(address proxy, address implementation) external;
}
