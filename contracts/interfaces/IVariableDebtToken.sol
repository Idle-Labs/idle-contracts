pragma solidity 0.5.16;

interface IVariableDebtToken {
  function scaledTotalSupply() external view returns (uint256);
}
