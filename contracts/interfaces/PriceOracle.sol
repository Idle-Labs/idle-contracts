pragma solidity 0.5.16;

interface PriceOracle {
  function getUnderlyingPrice(address _idleToken) external view returns (uint256);
  function getPriceUSD(address _asset) external view returns (uint256 price);
  function getPriceETH(address _asset) external view returns (uint256 price);
  function getPriceToken(address _asset, address _token) external view returns (uint256 price);
  function WETH() external view returns (address);

  function getCompApr(address cToken, address token) external view returns (uint256);
}
