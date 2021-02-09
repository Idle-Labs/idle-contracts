pragma solidity 0.5.16;

interface CETH {
  function mint() payable external;
  function redeem(uint redeemTokens) external returns (uint);

  function comptroller() external view returns (address);
  function exchangeRateStored() external view returns (uint256);
  function supplyRatePerBlock() external view returns (uint256);

  function borrowRatePerBlock() external view returns (uint256);
  function totalReserves() external view returns (uint256);
  function getCash() external view returns (uint256);
  function totalBorrows() external view returns (uint256);
  function reserveFactorMantissa() external view returns (uint256);
  function interestRateModel() external view returns (address);
}
