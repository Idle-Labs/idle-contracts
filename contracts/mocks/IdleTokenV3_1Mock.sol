/**
 * @title: Idle Token main contract
 * @summary: ERC20 that holds pooled user funds together
 *           Each token rapresent a share of the underlying pools
 *           and with each token user have the right to redeem a portion of these pools
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "./IdleTokenV3_1NoConst.sol";
import "./GasTokenMock.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol";

import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract IdleTokenV3_1Mock is IdleTokenV3_1NoConst {
  constructor(
    string memory _name, // eg. IdleDAI
    string memory _symbol, // eg. IDLEDAI
    address _token,
    address _idle,
    address _comp,
    address _aave
    ) public {
      IDLE = _idle;
      COMP = _comp;
      stkAAVE = _aave;

      _initV1(_name, _symbol, _token);
  }
  function amountsFromAllocations(uint256[] calldata allocations, uint256 total)
    external pure returns (uint256[] memory foo) {
      return _amountsFromAllocations(allocations, total);
  }
  function mintWithAmounts(uint256[] calldata allocation, uint256 total) external {
    _mintWithAmounts(allocation, total);
  }
  function setLastAllocations(uint256[] calldata allocs) external {
    lastAllocations = allocs;
  }
  function setIdleControllerAddress(address _controller) external onlyOwner {
    idleController = _controller;
  }
  function setMaxUnlentPerc(uint256 _perc)
    external onlyOwner {
      require(_perc <= 100000, "IDLE:TOO_HIGH");
      maxUnlentPerc = _perc;
  }
  function setOracleAddress(address _oracle)
    external onlyOwner {
      require(_oracle != address(0), "IDLE:IS_0");
      oracle = _oracle;
  }

  function setGST(address _gst) external {
    gst2 = GasTokenMock(_gst);
  }
  function redeemAllNeeded(
    uint256[] calldata amounts,
    uint256[] calldata newAmounts
    ) external returns (
      uint256[] memory toMintAllocations,
      uint256 totalToMint,
      bool lowLiquidity
    ) {
      return _redeemAllNeeded(amounts, newAmounts);
  }
}
