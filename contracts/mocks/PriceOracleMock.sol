pragma solidity 0.5.16;

// interfaces
import "../interfaces/PriceOracle.sol";

contract PriceOracleMock {
  uint256 public apr;
  constructor() public {
  }

  function _setAPR(uint256 _apr) public {
    apr = _apr;
  }
  function getCompApr(address, address) external view returns (uint256) {
    return apr;
  }
}
