/**
 * @title: Idle Token main contract
 * @summary: ERC20 that holds pooled user funds together
 *           Each token rapresent a share of the underlying pools
 *           and with each token user have the right to redeem a portion of these pools
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/lifecycle/Pausable.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/iERC20Fulcrum.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/IIdleTokenV3.sol";

import "../IdleTokenV3.sol";

contract IdleTokenV3Mock is IdleTokenV3 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  constructor(
    string memory _name, // eg. IdleDAI
    string memory _symbol, // eg. IDLEDAI
    uint8 _decimals, // eg. 18
    address _token,
    address _cToken,
    address _iToken,
    address _rebalancer,
    address _priceCalculator,
    address _idleCompound,
    address _idleFulcrum)
    public
    IdleTokenV3(_name, _symbol, _decimals, _token, _cToken, _iToken, _rebalancer, _priceCalculator, _idleCompound, _idleFulcrum) {
  }
  function amountsFromAllocations(uint256[] memory allocations, uint256 total)
    public pure returns (uint256[] memory foo) {
      return _amountsFromAllocations(allocations, total);
  }
  function mintWithAmounts(address[] memory tokenAddresses, uint256[] memory protocolAmounts) public {
    _mintWithAmounts(tokenAddresses, protocolAmounts);
  }
  function setAllocations(uint256[] memory allocs) public {
    lastAllocations = allocs;
  }
  function redeemAllNeeded(
    address[] memory tokenAddresses,
    uint256[] memory amounts,
    uint256[] memory newAmounts
    ) public returns (
      uint256[] memory toMintAllocations,
      uint256 totalToMint
    ) {
      return _redeemAllNeeded(tokenAddresses, amounts, newAmounts);
  }
}
