pragma solidity 0.5.16;

// interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20Detailed, ERC20 {
  constructor(
    string memory name,
    string memory symbol,
    uint256 _creatorSupply
  )
    ERC20()
    ERC20Detailed(name, symbol, 18) public {
    _mint(address(this), 10**24); // 1.000.000
    _mint(msg.sender, _creatorSupply);
  }
}
