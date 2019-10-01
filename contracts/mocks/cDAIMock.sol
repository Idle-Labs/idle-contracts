pragma solidity 0.5.11;

// interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/CERC20.sol";

contract cDAIMock is ERC20Detailed, ERC20, CERC20 {
  address public dai;
  uint256 public exchangeRate;
  uint256 public toTransfer;
  uint256 public toMint;
  uint256 public supplyRate;

  constructor(address _dai, address tokenOwner)
    ERC20()
    ERC20Detailed('cDAI', 'cDAI', 8) public {
    dai = _dai;
    exchangeRate = 200000000000000000000000000;
    toTransfer = 10**18;
    toMint = 5000000000;
    supplyRate = 32847953230;
    _mint(address(this), 10**14); // 1.000.000 cDAI
    _mint(tokenOwner, 10**11); // 1.000 cDAI
  }
  function() payable external {}

  function mint(uint256 amount) external returns (uint256) {
    require(IERC20(dai).transferFrom(msg.sender, address(this), amount), "Error during transferFrom"); // 1 DAI
    require(this.transfer(msg.sender, toMint), "Error during transfer"); // 50 cETH
    return 0;
  }
  function redeem(uint256 amount) external returns (uint256) {
    // here I should transfer 1 DAI back
    _burn(msg.sender, amount);
    require(IERC20(dai).transfer(msg.sender, toTransfer), "Error during transfer"); // 1 DAI
    return 0;
  }

  function exchangeRateStored() external view returns (uint256) {
    return exchangeRate;
  }
  function supplyRatePerBlock() external view returns (uint256) {
    return supplyRate;
  }

  function setSupplyRatePerBlockForTest() external {
    supplyRate = supplyRate / 10;
  }
  function resetSupplyRatePerBlockForTest() external {
    supplyRate = supplyRate * 10;
  }
  function setMintValueForTest() external {
    toMint = 4545454545;
  }
  function setExchangeRateStoredForTest() external {
    exchangeRate = 220000000000000000000000000;
    toTransfer = 1.1 * 10**18;
  }
  function setNewExchangeRateStoredForTest() external {
    exchangeRate = 300000000000000000000000000;
    toTransfer = 1.1 * 10**18;
    toMint = 3333333333;
  }
  function setExchangeRateStoredForTestNoFee() external {
    exchangeRate = 220000000000000000000000000;
    toTransfer = 1.078 * 10**18;
  }

  function borrowRatePerBlock() external view returns (uint256) {}
  function totalReserves() external view returns (uint256) {}
  function getCash() external view returns (uint256) {}
  function totalBorrows() external view returns (uint256) {}
  function reserveFactorMantissa() external view returns (uint256) {}
  function interestRateModel() external view returns (address) {}
  function blocksInAYear() external view returns (uint256) {}
}
