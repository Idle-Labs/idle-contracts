pragma solidity 0.5.16;

interface AToken {
  function redeem(uint256 amount) external;
  function burn(address user, address receiverOfUnderlying, uint256 amount, uint256 index) external;
}
