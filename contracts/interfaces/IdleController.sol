pragma solidity 0.5.16;

interface IdleController {
  function idleSpeeds(address _idleToken) external view returns (uint256);
  function claimIdle(address[] calldata holders, address[] calldata idleTokens) external;
  function getAllMarkets() external view returns (address[] memory);
  function _addIdleMarkets(address[] calldata) external;
  function _supportMarkets(address[] calldata) external;
}
