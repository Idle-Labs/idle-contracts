pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/Comptroller.sol";

contract ComptrollerMock is Comptroller {
  address public compAddr;
  address public cTokenAddr;
  uint256 private amount = 10**18;
  constructor(address _comp, address _cToken) public {
    compAddr = _comp;
    cTokenAddr = _cToken;
  }
  function setAmount(uint256 _amount) external {
    amount = _amount;
  }

  // This contract should have COMP inside
  function claimComp(address[] calldata holders, address[] calldata cTokens, bool borrowers, bool suppliers) external {
    require(cTokenAddr == cTokens[0], 'Wrong cToken');
    require(!borrowers && suppliers, 'Only suppliers should be true');
    IERC20(compAddr).transfer(holders[0], amount);
  }
}
