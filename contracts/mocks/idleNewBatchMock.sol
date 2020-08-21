pragma solidity 0.5.16;

// interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IdleNewBatchMock is ERC20Detailed, ERC20 {
  uint256 public transferAmount;
  constructor()
    ERC20()
    ERC20Detailed('idleNew', 'IDLENEW', 18) public {
    _mint(msg.sender, 10**22); // 10.000 IDLENEW
  }
  function setAmountToMint(uint256 _amount) public {
    transferAmount = _amount;
  }
  function mintIdleToken(uint256, bool, address) external returns (uint256 mintedTokens) {
    _mint(msg.sender, transferAmount);
    mintedTokens = transferAmount;
  }
}
