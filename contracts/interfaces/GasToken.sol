pragma solidity 0.5.11;

interface GasToken {
  function freeFromUpTo(address from, uint256 value) external returns (uint256 freed);
  function balanceOf(address from) external returns (uint256 balance);
}
