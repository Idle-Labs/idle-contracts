pragma solidity 0.5.16;

// interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDCMock is ERC20Detailed, ERC20 {
  constructor()
    ERC20()
    ERC20Detailed('USDC', 'USDC', 6) public {
    _mint(address(this), 10**12); // 1.000.000 USDC
    _mint(msg.sender, 10**9); // 1.000 USDC
  }
}
