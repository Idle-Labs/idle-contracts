pragma solidity 0.5.16;

interface IIdleTokenHelper {
  function setIdleTokens(address[] calldata _newIdleTokens) external;
  function getAPR(address _idleToken, address _cToken, address _aToken) external view returns (uint256 avgApr);
  function getCurrentAllocations(address _idleToken) external view returns (uint256[] memory amounts, uint256 total);
  function getAPRs(address _idleToken) external view returns (address[] memory addresses, uint256[] memory aprs);
  function sellGovTokens(address _idleToken, uint256[] calldata _minTokenOut) external;
  function emergencyWithdrawToken(address _token, address _to) external;
}
