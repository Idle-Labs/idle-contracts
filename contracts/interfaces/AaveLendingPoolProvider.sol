pragma solidity 0.5.16;

interface AaveLendingPoolProvider {
  function getLendingPool() external view returns (address);
  function getLendingPoolCore() external view returns (address);
}
