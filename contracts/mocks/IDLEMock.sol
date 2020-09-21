pragma solidity 0.5.16;

// interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IDLEMock is ERC20Detailed, ERC20 {
  constructor()
    ERC20()
    ERC20Detailed('IDLE', 'IDLE', 18) public {
    _mint(address(this), 13**25); // 13.000.000 IDLE
    _mint(msg.sender, 10**22); // 10.000 IDLE
  }
}
