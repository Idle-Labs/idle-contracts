pragma solidity 0.5.16;

import "./IdleTokenHelperNoConst.sol";

contract IdleTokenHelperMock is IdleTokenHelperNoConst {
  constructor(address _idle, address _comp, address _uni_router) public {
    IDLE = _idle;
    COMP = _comp;
    UNI_ROUTER_V2 = _uni_router;
  }
}
