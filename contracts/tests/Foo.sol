pragma solidity 0.5.16;

contract Foo {
  uint256 public x;

  constructor(uint256 _x) public {
    initialize(_x);
  }

  function initialize(uint256 _x) public {
    x = _x;
  }
}
