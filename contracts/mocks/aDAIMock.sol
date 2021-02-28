pragma solidity 0.5.16;

// interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/AToken.sol";

contract aDAIMock is AToken, ERC20, ERC20Detailed {
  address public dai;
  uint256 public price = 10**18;

  constructor(address _dai, address tokenOwner)
    ERC20()
    ERC20Detailed('aDAI', 'aDAI', 18) public {
    dai = _dai;
    _mint(address(this), 10**24); // 1.000.000 aDAI
    _mint(tokenOwner, 10**23); // 100.000 aDAI
  }

  function UNDERLYING_ASSET_ADDRESS() external view returns(address) {
    return dai;
  }
  function redeem(uint256 amount) external {
    _burn(msg.sender, amount);
    require(IERC20(dai).transfer(msg.sender, amount), "Error during transfer"); // 1 DAI
  }
  function setPriceForTest(uint256 _price) external {
    price = _price;
  }

  function burn(address user, address receiverOfUnderlying, uint256 amount, uint256 index) external {
    _burn(user, amount);
    require(IERC20(dai).transfer(receiverOfUnderlying, amount), "Error during transfer");
  }
}
