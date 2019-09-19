pragma solidity 0.5.11;

interface ILendingProtocol {
  function mint(uint256 mintAmount) external returns (uint256);
  function redeem(uint256 redeemTokens, address account) external returns (uint256);
  function maxAmountBelowRate(uint256 targetRate) external view returns (uint256);
  function nextSupplyRate(uint256 amount) external view returns (uint256);
  function getAPR() external view returns (uint256);
  function token() external view returns (address);
  function underlying() external view returns (address);
}
