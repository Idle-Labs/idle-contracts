/**
 * @title: Idle Rebalancer contract
 * @summary: Used for calculating amounts to lend on each implemented protocol.
 *           This implementation works with Compound and Fulcrum only,
 *           when a new protocol will be added this should be replaced
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "./interfaces/IIdleRebalancer.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancerManaged is IIdleRebalancer, Ownable {
  using SafeMath for uint256;
  // IdleToken address
  address public idleToken;
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
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken contract");
    _;
  }
  /**
   * Throws if called by any account other than rebalancerManager.
   */
  modifier onlyRebalancer() {
    require(msg.sender == rebalancerManager, "Only rebalacer ");
    _;
  }

  // onlyOwner
  /**
   * sets idleToken address
   * NOTE: can be called only once. It's not on the constructor because we are deploying this contract
   *       after the IdleToken contract
   * @param _idleToken : idleToken address
   */
  function setIdleToken(address _idleToken)
    external onlyOwner {
      require(idleToken == address(0), "idleToken addr already set");
      require(_idleToken != address(0), "_idleToken addr is 0");
      idleToken = _idleToken;
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
  /**
   * Used by IdleToken contract to calculate the amount to be lended
   * on each protocol in order to get the best available rate for all funds.
   *
   * @param _rebalanceParams : first param is the total amount to be rebalanced,
   *                           all other elements are client side calculated amounts to put on each lending protocol
   * @return tokenAddresses : array with all token addresses used,
   *                          currently [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   currently [amountCompound, amountFulcrum]
   */
  function calcRebalanceAmounts(uint256[] calldata _rebalanceParams)
    external view onlyIdle
    returns (address[] memory tokenAddresses, uint256[] memory amounts)
  {
    uint256 totAmountToRebalance = _rebalanceParams[0];

    tokenAddresses = new address[](3);
    tokenAddresses[0] = cToken;
    tokenAddresses[1] = iToken;
    tokenAddresses[2] = aToken;

    amounts = new uint256[](3);
    amounts[0] = totAmountToRebalance.mul(lastAmounts[0]).div(10000);
    amounts[1] = totAmountToRebalance.mul(lastAmounts[1]).div(10000);
    amounts[2] = totAmountToRebalance.sub(amounts[0]).sub(amounts[1]);

    return (tokenAddresses, amounts);
  }
}
