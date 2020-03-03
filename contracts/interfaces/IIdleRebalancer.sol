/**
 * @title: Idle Rebalancer interface
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

interface IIdleRebalancer {
  function calcRebalanceAmounts(uint256[] calldata _rebalanceParams)
    external view
    returns (address[] memory tokenAddresses, uint256[] memory amounts);
}
