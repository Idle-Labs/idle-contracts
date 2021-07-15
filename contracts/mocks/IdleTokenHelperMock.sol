pragma solidity 0.5.16;

import "./IdleTokenHelperNoConst.sol";

contract IdleTokenHelperMock is IdleTokenHelperNoConst {
  address public sellReceivedIdleToken;
  uint256[] public sellReceivedMinTokenOut;
  uint256 public sellReceivedMinTokenOutCount;

  constructor(address _idle, address _comp) public {
    IDLE = _idle;
    COMP = _comp;
  }
}
