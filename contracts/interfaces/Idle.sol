pragma solidity 0.5.16;

interface Idle {
  function delegate(address delegatee) external;
  function balanceOf(address delegatee) external view;
}
