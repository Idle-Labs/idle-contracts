pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IdleController.sol";

contract IdleControllerMock is IdleController {
  address public idleAddr;
  address public idleTokenAddr;
  uint256 private amount;
  constructor(address _idle, address _idleToken) public {
    idleAddr = _idle;
    idleTokenAddr = _idleToken;
  }
  function setAmount(uint256 _amount) external {
    amount = _amount;
  }

  // This contract should have IDLE inside
  function claimIdle(address[] calldata, address[] calldata idleTokens) external {
    require(idleTokenAddr == idleTokens[0], 'Wrong idleToken');
    IERC20(idleAddr).transfer(msg.sender, amount > IERC20(idleAddr).balanceOf(address(this)) ? 0 : amount);
  }
  function claimIdle(address _sender) external {
    IERC20(idleAddr).transfer(_sender, amount > IERC20(idleAddr).balanceOf(address(this)) ? 0 : amount);
  }
  function idleSpeeds(address _idleToken) external view returns (uint256) {

  }
}
