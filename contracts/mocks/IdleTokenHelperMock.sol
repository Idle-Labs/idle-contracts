pragma solidity 0.5.16;

import "./IdleTokenHelperNoConst.sol";

contract IdleTokenHelperMock is IdleTokenHelperNoConst {
  address public sellReceivedIdleToken;
  uint256[] public sellReceivedMinTokenOut;
  uint256 public sellReceivedMinTokenOutCount;

  constructor(address _idle, address _comp, address _uni_router) public {
    IDLE = _idle;
    COMP = _comp;
  }

  function sellGovTokens(address _idleToken, uint256[] calldata _minTokenOut) external {
    sellReceivedIdleToken = _idleToken;
    sellReceivedMinTokenOut = _minTokenOut;
    sellReceivedMinTokenOutCount = _minTokenOut.length;
  }
}
