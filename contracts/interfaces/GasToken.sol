pragma solidity 0.5.16;

interface GasToken {
  function freeUpTo(uint256 value) external returns (uint256 freed);
  function freeFromUpTo(address from, uint256 value) external returns (uint256 freed);
  function balanceOf(address from) external returns (uint256 balance);
}
