pragma solidity 0.5.16;

interface IWETH {
  function getBaseVariableBorrowRate() external view returns (uint256);
  function deposit() external payable;
  function withdraw(uint wad) external;
  function balanceOf(address) external view;
}
