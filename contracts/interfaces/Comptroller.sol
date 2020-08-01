pragma solidity 0.5.16;

interface Comptroller {
  function claimComp(address) external;
  function claimComp(address[] calldata holders, address[] calldata cTokens, bool borrowers, bool suppliers) external;
}
