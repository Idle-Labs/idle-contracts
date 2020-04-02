pragma solidity 0.5.11;

interface PotLike {
  function chi() external view returns (uint256);
  function rho() external view returns (uint256);
  function dsr() external view returns (uint256);
  function join(uint256) external;
  function exit(uint256) external;
}
