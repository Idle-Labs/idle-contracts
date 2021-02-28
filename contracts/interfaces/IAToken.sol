pragma solidity 0.5.16;

interface IAToken {
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
