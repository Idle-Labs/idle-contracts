pragma solidity 0.5.16;

contract AaveVariableDebtTokenMock {
  uint256 public _scaledTotalSupply;

  constructor(uint256 value) public {
    _scaledTotalSupply = value;
  }

  function scaledTotalSupply() external view returns (uint256) {
    return _scaledTotalSupply;
  }
}
