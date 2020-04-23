pragma solidity 0.5.16;
import "../interfaces/WhitePaperInterestRateModel.sol";

contract WhitePaperMock is WhitePaperInterestRateModel {
  uint256 public borrowRate;
  uint256 public supplyRate;
  uint256 public baseRate;
  uint256 public multiplier;
  uint256 public blocksPerYear;
  constructor() public {
    baseRate = 50000000000000000;
    multiplier = 120000000000000000;
    blocksPerYear = 2102400;
  }
  function getBorrowRate(uint256 cash, uint256 borrows, uint256 _reserves) external view returns (uint256, uint256) {

  }
  function _setSupplyRate(uint256 rate) public {
    supplyRate = rate;
  }
  function getSupplyRate(uint256, uint256, uint256, uint256) external view returns (uint256) {
    return supplyRate;
  }
  function dsrPerBlock() external view returns (uint256) {}
}
