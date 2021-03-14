/**
 * @title: Idle Token interface
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

interface IIdleTokenGovernance {
  function token() external view returns (address);
  function owner() external view returns (address);
  function rebalancer() external view returns (address);
  function protocolWrappers(address) external view returns (address);
  function oracle() external view returns (address);
  function tokenPrice() external view returns (uint256 price);
  function tokenDecimals() external view returns (uint256 decimals);
  function getAPRs() external view returns (address[] memory addresses, uint256[] memory aprs);
  function getAllocations() external view returns (uint256[] memory);
  function getGovTokens() external view returns (address[] memory);
  function getAllAvailableTokens() external view returns (address[] memory);
  function getProtocolTokenToGov(address _protocolToken) external view returns (address);
}
