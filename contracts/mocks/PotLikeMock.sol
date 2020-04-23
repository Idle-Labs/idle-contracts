pragma solidity 0.5.16;

import "../interfaces/PotLike.sol";

contract PotLikeMock is PotLike {
  uint256 public _chi;
  uint256 public _rho;
  uint256 public _dsr;

  function chi() external view returns (uint256) {
    return _chi;
  }
  function setChi(uint256 _val) external returns (uint256) {
    _chi = _val;
  }
  function rho() external view returns (uint256) {
    return _rho;
  }
  function setRho(uint256 _val) external returns (uint256) {
    _rho = _val;
  }
  function dsr() external view returns (uint256) {
    return _dsr;
  }
  function setDsr(uint256 _val) external returns (uint256) {
    _dsr = _val;
  }
  function join(uint256) external {}
  function exit(uint256) external {}
}
