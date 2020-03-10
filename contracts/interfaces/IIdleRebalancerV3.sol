/**
 * @title: Idle Rebalancer interface
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

interface IIdleRebalancerV3 {
  function getAllocations() external view returns (uint256[] memory _allocations);
}
