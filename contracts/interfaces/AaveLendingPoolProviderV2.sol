pragma solidity 0.5.16;

interface AaveLendingPoolProviderV2 {
  function getLendingPool() external view returns (address);
}
