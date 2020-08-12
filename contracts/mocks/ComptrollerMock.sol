pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/Comptroller.sol";

contract ComptrollerMock is Comptroller {
  address public compAddr;
  address public cTokenAddr;
  uint256 private amount;
  constructor(address _comp, address _cToken) public {
    compAddr = _comp;
    cTokenAddr = _cToken;
  }
  function setAmount(uint256 _amount) external {
    amount = _amount;
  }

  // This contract should have COMP inside
  function claimComp(address[] calldata, address[] calldata cTokens, bool borrowers, bool suppliers) external {
    require(cTokenAddr == cTokens[0], 'Wrong cToken');
    require(!borrowers && suppliers, 'Only suppliers should be true');
    IERC20(compAddr).transfer(msg.sender, amount > IERC20(compAddr).balanceOf(address(this)) ? 0 : amount);
  }
  function claimComp(address _sender) external {
    IERC20(compAddr).transfer(_sender, amount > IERC20(compAddr).balanceOf(address(this)) ? 0 : amount);
  }
  function compSpeeds(address _cToken) external view returns (uint256) {

  }
}
