pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

interface IVesterFactory {
  function vestingContracts(address vestor) external returns (address);
}
