/**
 * @title: Idle Rebalancer contract
 * @summary: Used for calculating amounts to lend on each implemented protocol.
 *           This implementation works with Compound and Fulcrum only,
 *           when a new protocol will be added this should be replaced
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "./interfaces/IIdleRebalancerV3.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancerV3 is IIdleRebalancerV3, Ownable {
  using SafeMath for uint256;
  uint256[] public lastAmounts;
  address[] public lastAmountsAddresses;
  address public rebalancerManager;
  address public idleToken;

  /**
   * @param _cToken : cToken address
   * @param _iToken : iToken address
   * @param _aToken : aToken address
   * @param _yxToken : yxToken address
   * @param _rebalancerManager : rebalancerManager address
   */
  constructor(address _cToken, address _iToken, address _aToken, address _yxToken, address _rebalancerManager) public {
    require(_cToken != address(0) && _iToken != address(0) && _aToken != address(0) && _yxToken != address(0) && _rebalancerManager != address(0), 'some addr is 0');
    rebalancerManager = _rebalancerManager;

    // Initially 100% on first lending protocol
    lastAmounts = [100000, 0, 0, 0];
    lastAmountsAddresses = [_cToken, _iToken, _aToken, _yxToken];
  }

  /**
   * Throws if called by any account other than rebalancerManager.
   */
  modifier onlyRebalancerAndIdle() {
    require(msg.sender == rebalancerManager || msg.sender == idleToken, "Only rebalacer and IdleToken");
    _;
  }

  /**
   * It allows owner to set the allowed rebalancer address
   *
   * @param _rebalancerManager : rebalance manager address
   */
  function setRebalancerManager(address _rebalancerManager)
    external onlyOwner {
      require(_rebalancerManager != address(0), "_rebalancerManager addr is 0");

      rebalancerManager = _rebalancerManager;
  }

  function setIdleToken(address _idleToken)
    external onlyOwner {
      require(idleToken == address(0), "idleToken addr already set");
      require(_idleToken != address(0), "_idleToken addr is 0");
      idleToken = _idleToken;
  }

  /**
   * It adds a new token address to lastAmountsAddresses list
   *
   * @param _newToken : new interest bearing token address
   */
  function setNewToken(address _newToken)
    external onlyOwner {
      require(_newToken != address(0), "New token should be != 0");
      for (uint256 i = 0; i < lastAmountsAddresses.length; i++) {
        if (lastAmountsAddresses[i] == _newToken) {
          return;
        }
      }

      lastAmountsAddresses.push(_newToken);
      lastAmounts.push(0);
  }
  // end onlyOwner

  /**
   * Used by Rebalance manager to set the new allocations
   *
   * @param _allocations : array with allocations in percentages (100% => 100000)
   * @param _addresses : array with addresses of tokens used, should be equal to lastAmountsAddresses
   */
  function setAllocations(uint256[] calldata _allocations, address[] calldata _addresses)
    external onlyRebalancerAndIdle
  {
    require(_allocations.length == lastAmounts.length, "Alloc lengths are different, allocations");
    require(_allocations.length == _addresses.length, "Alloc lengths are different, addresses");

    uint256 total;
    for (uint256 i = 0; i < _allocations.length; i++) {
      require(_addresses[i] == lastAmountsAddresses[i], "Addresses do not match");
      total = total.add(_allocations[i]);
      lastAmounts[i] = _allocations[i];
    }
    require(total == 100000, "Not allocating 100%");
  }

  function getAllocations()
    external view returns (uint256[] memory _allocations) {
    return lastAmounts;
  }

  function getAllocationsLength()
    external view returns (uint256) {
    return lastAmounts.length;
  }
}
