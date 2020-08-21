pragma solidity 0.5.16;

// interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IdleBatchMock is ERC20Detailed, ERC20 {
  constructor()
    ERC20()
    ERC20Detailed('idleOld', 'IDLEOLD', 18) public {
    _mint(msg.sender, 10**22); // 10.000 IDLEOLD
  }
  function token() external returns (address) {
    return address(this);
  }
  function redeemIdleToken(uint256 _amount, bool, uint256[] calldata) external returns (uint256) {
    _burn(msg.sender, _amount);
  }
}
