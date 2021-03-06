pragma solidity 0.5.16;

// interfaces
import "../interfaces/AaveInterestRateStrategy.sol";

contract AaveInterestRateStrategyMockV2 {
  uint256 public borrowRate;
  uint256 public supplyRate;

  constructor() public {
  }

  function getBaseVariableBorrowRate() external view returns (uint256) {
    return borrowRate;
  }
  function calculateInterestRates(
    address,
    uint256,
    uint256,
    uint256,
    uint256,
    uint256) external view
  returns (uint256, uint256, uint256) {
    return (supplyRate, borrowRate, borrowRate);
  }

  // mocked methods
  function _setSupplyRate(uint256 _supplyRate) external {
    supplyRate = _supplyRate;
  }
  function _setBorrowRate(uint256 _borrowRate) external {
    borrowRate = _borrowRate;
  }
}
