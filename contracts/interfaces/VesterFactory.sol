pragma solidity 0.5.16;

interface VesterFactory {
  function vestingContracts(address) external view returns(address);
}
