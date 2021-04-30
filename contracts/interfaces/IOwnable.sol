pragma solidity 0.5.16;

interface IOwnable {
  function owner() external view returns (address);
  function transferOwnership(address newOwner) external;
}
