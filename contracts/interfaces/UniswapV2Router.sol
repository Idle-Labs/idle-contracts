pragma solidity 0.5.16;

interface UniswapV2Router {
  function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts);
}
