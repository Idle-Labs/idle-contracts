pragma solidity 0.5.11;

// interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/AaveLendingPool.sol";

contract aaveLendingPoolMock is AaveLendingPool {
  address public dai;
  address public aDai;

  constructor (address _dai, address _aDai) public {
    dai = _dai;
    aDai = _aDai;
  }
  function deposit(address, uint256 _amount, uint16) external {
    /* require(IERC20(dai).transferFrom(msg.sender, address(this), _amount), "Error during transferFrom"); */
    IERC20(aDai).transfer(msg.sender, _amount);
  }
  function getReserveData(address _reserve) external view returns (
    uint256 totalLiquidity,
    uint256 availableLiquidity,
    uint256 totalBorrowsStable,
    uint256 totalBorrowsVariable,
    uint256 liquidityRate,
    uint256 variableBorrowRate,
    uint256 stableBorrowRate,
    uint256 averageStableBorrowRate,
    uint256 utilizationRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex,
    address aTokenAddress,
    uint40 lastUpdateTimestamp
  ) {

  }
}
