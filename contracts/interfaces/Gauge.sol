pragma solidity 0.5.16;

interface Gauge {
  function claimable_reward(address user, address token) external view returns (uint256);
  function claimable_tokens(address user) external view returns (uint256);
}
