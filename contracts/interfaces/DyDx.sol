pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import './DyDxStructs.sol';

contract DyDx is DyDxStructs {
  function getEarningsRate() external view returns (uint256 value);
  function getMarketInterestSetter(uint256 marketId) external view returns (address interestSetter);
  function getMarketInterestRate(uint256 marketId) external view returns (uint256 value);
  function getMarketCurrentIndex(uint256 marketId) external view returns (uint256 borrow, uint256 supply);
  function getMarketTotalPar(uint256 marketId) external view returns (uint256 borrow, uint256 supply);
  function getAccountWei(Info calldata account, uint256 marketId) external view returns (Wei memory);
  function getAccountPar(Info calldata account, uint256 marketId) external view returns (bool sign, uint128 value);
  function operate(Info[] calldata, ActionArgs[] calldata) external;
}
