pragma solidity 0.5.16;

// interfaces
import "../interfaces/AaveLendingPoolProvider.sol";

contract aaveLendingPoolProviderMock is AaveLendingPoolProvider {
  address public pool;
  address public core;

  function getLendingPool() external view returns (address) {
    return pool;
  }
  function getLendingPoolCore() external view returns (address) {
    return core;
  }

  // mocked methods
  function _setLendingPool(address _pool) external {
    pool = _pool;
  }
  function _setLendingPoolCore(address _core) external {
    core = _core;
  }
}
