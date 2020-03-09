/**
 * @title: Idle Rebalancer contract
 * @summary: Used for calculating amounts to lend on each implemented protocol.
 *           This implementation works with Compound and Fulcrum only,
 *           when a new protocol will be added this should be replaced
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "./interfaces/IIdleRebalancerScore.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancerManagedScore is IIdleRebalancerScore, Ownable {
  using SafeMath for uint256;
  // protocol token (cToken) address
  address public cToken;
  // protocol token (iToken) address
  address public iToken;
  // protocol token (aToken) address
  address public aToken;

  uint256[] public lastAmounts = new uint256[](3);
  address public rebalancerManager;

  /**
   * @param _cToken : cToken address
   * @param _iToken : iToken address
   * @param _aToken : aToken address
   */
  constructor(address _cToken, address _iToken, address _aToken) public {
    require(_cToken != address(0) && _iToken != address(0) && _aToken != address(0), 'some addr is 0');

    cToken = _cToken;
    iToken = _iToken;
    aToken = _aToken;

    lastAmounts = [10000, 0, 0];
  }

  /**
   * Throws if called by any account other than rebalancerManager.
   */
  modifier onlyRebalancer() {
    require(msg.sender == rebalancerManager, "Only rebalacer");
    _;
  }

  /**
   * It allows owner to set the allowed rebalancer address
   *
   * @param _rebalancerManager : iToken address
   */
  function setRebalancerManager(address _rebalancerManager)
    external onlyOwner {
      rebalancerManager = _rebalancerManager;
  }
  // end onlyOwner

  /**
   * Used by Rebalance manager to set the new allocations
   *
   * @param _allocations : array with allocations in percentages (100% => 10000)
   */
  function setAllocations(uint256[] calldata _allocations)
    external onlyRebalancer
  {
    require(_allocations[0].add(_allocations[1]).add(_allocations[2]) == 10000, "Not allocating 100%");

    lastAmounts[0] = _allocations[0];
    lastAmounts[1] = _allocations[1];
    lastAmounts[2] = _allocations[2];
  }

  function getAllocations()
    external view returns (uint256[] memory _allocations) {
    return lastAmounts;
  }
}
