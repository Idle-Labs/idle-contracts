pragma solidity 0.5.16;

interface IProxyAdmin {
  function transferOwnership(address) external;
  function changeProxyAdmin(address proxy, address newAdmin) external;
  function upgrade(address proxy, address implementation) external;
  function upgradeAndCall(address, address, bytes calldata) external payable;
}
