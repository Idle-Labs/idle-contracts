pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/CHAI.sol";

contract CHAIMock is ERC20Detailed, ERC20 {
  uint256 public daiAmount;
  uint256 public price;
  address public daiAddr;
  constructor(address _dai, address tokenOwner)
    ERC20()
    ERC20Detailed('CHAI', 'CHAI', 18) public {
    daiAddr = _dai;
    _mint(address(this), 10**24); // 1.000.000 CHAI
    _mint(tokenOwner, 10**33); // 100.000 CHAI
  }
  function dai(address) external view returns (uint) {
    return daiAmount;
  }
  function setDai(uint256 _daiAmount) external returns (uint) {
    daiAmount = _daiAmount;
  }
  function setPrice(uint256 _price) external returns (uint) {
    price = _price;
  }
  // wad is denominated in dai
  function join(address dst, uint wad) external {
    require(IERC20(daiAddr).transferFrom(msg.sender, address(this), wad), "Error during transferFrom"); // 1 DAI
    _mint(dst, (wad * 10**18)/price);
  }
  // wad is denominated in (1/chi) * dai
  function exit(address src, uint wad) external {
    _burn(src, wad);
    require(IERC20(daiAddr).transfer(src, wad * price / 10**18), "Error during transfer"); // 1 DAI
  }
}
