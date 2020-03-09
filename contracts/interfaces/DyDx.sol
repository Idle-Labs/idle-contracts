pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import './DyDxStructs.sol';

contract DyDx is DyDxStructs {
  struct val {
    uint256 value;
  }

  struct set {
    uint128 borrow;
    uint128 supply;
  }

  function getEarningsRate() external view returns (val memory);
  function getMarketInterestRate(uint256 marketId) external view returns (val memory);
  function getMarketTotalPar(uint256 marketId) external view returns (set memory);
  function getAccountWei(Info memory account, uint256 marketId) public view returns (Wei memory);
  function operate(Info[] memory, ActionArgs[] memory) public;
}
