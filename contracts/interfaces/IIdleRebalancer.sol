/**
 * @title: Idle Rebalancer interface
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

interface IIdleRebalancer {
  function calcRebalanceAmounts(uint256[] calldata _rebalanceParams)
    external view
    returns (address[] memory tokenAddresses, uint256[] memory amounts);
}
