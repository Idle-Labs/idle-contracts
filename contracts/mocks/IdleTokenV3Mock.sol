/**
 * @title: Idle Token main contract
 * @summary: ERC20 that holds pooled user funds together
 *           Each token rapresent a share of the underlying pools
 *           and with each token user have the right to redeem a portion of these pools
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "./IdleTokenV3NoGSTConst.sol";
import "./GasTokenMock.sol";

contract IdleTokenV3Mock is IdleTokenV3NoGSTConst {
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
    IdleTokenV3NoGSTConst(_name, _symbol, _decimals, _token, _cToken, _iToken, _rebalancer, _priceCalculator, _idleCompound, _idleFulcrum) {
  }
  function amountsFromAllocations(uint256[] calldata allocations, uint256 total)
    external pure returns (uint256[] memory foo) {
      return _amountsFromAllocations(allocations, total);
  }
  function mintWithAmounts(address[] calldata tokenAddresses, uint256[] calldata protocolAmounts) external {
    _mintWithAmounts(tokenAddresses, protocolAmounts);
  }
  function setAllocations(uint256[] calldata allocs) external {
    lastAllocations = allocs;
  }
  function setGST(address _gst) external {
    gst2 = GasTokenMock(_gst);
  }
  function redeemAllNeeded(
    address[] calldata tokenAddresses,
    uint256[] calldata amounts,
    uint256[] calldata newAmounts
    ) external returns (
      uint256[] memory toMintAllocations,
      uint256 totalToMint,
      bool lowLiquidity
    ) {
      return _redeemAllNeeded(tokenAddresses, amounts, newAmounts);
  }
}
