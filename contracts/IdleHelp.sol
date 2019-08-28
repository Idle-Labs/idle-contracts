pragma solidity ^0.5.2;

import "./interfaces/CERC20.sol";
import "./interfaces/iERC20Fulcrum.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library IdleHelp {
  using SafeMath for uint256;
  function getPriceInToken(address cToken, address iToken, address bestToken, uint256 totalSupply, uint256 poolSupply)
    public view
    returns (uint256 tokenPrice) {
      // 1Token = net_asset_value / total_Token_liquidity
      // net_asset_value = (rate of 1(cToken || iToken) in underlying_Token) * balanceOf((cToken || iToken))
      uint256 navPool;
      uint256 price;

      // rate
      if (bestToken == cToken) {
        // exchangeRateStored is the rate (in wei, 8 decimals) of 1cDAI in DAI * 10**18
        price = CERC20(cToken).exchangeRateStored(); // 202487304197710837666727644 ->
      } else {
        price = iERC20Fulcrum(iToken).tokenPrice(); // eg 1001495070730287403 -> 1iToken in wei = 1001495070730287403 Token
      }
      navPool = price.mul(poolSupply); // eg 43388429749999990000 in DAI
      tokenPrice = navPool.div(totalSupply); // idleToken price in token wei
  }
  function getAPRs(address cToken, address iToken, uint256 blocksInAYear)
    public view
    returns (uint256 cApr, uint256 iApr) {
      uint256 cRate = CERC20(cToken).supplyRatePerBlock(); // interest % per block
      cApr = cRate.mul(blocksInAYear).mul(100);
      iApr = iERC20Fulcrum(iToken).supplyInterestRate(); // APR in wei 18 decimals
  }
  function getBestRateToken(address cToken, address iToken, uint256 blocksInAYear)
    public view
    returns (address bestRateToken, uint256 bestRate, uint256 worstRate) {
      (uint256 cApr, uint256 iApr) = getAPRs(cToken, iToken, blocksInAYear);
      bestRateToken = cToken;
      bestRate = cApr;
      worstRate = iApr;
      if (iApr > cApr) {
        worstRate = cApr;
        bestRate = iApr;
        bestRateToken = iToken;
      }
  }
  function rebalanceCheck(address cToken, address iToken, address bestToken, uint256 blocksInAYear, uint256 minRateDifference)
    public view
    returns (bool shouldRebalance, address bestTokenAddr) {
      shouldRebalance = false;

      uint256 _bestRate;
      uint256 _worstRate;
      (bestTokenAddr, _bestRate, _worstRate) = getBestRateToken(cToken, iToken, blocksInAYear);
      if (
          bestToken == address(0) ||
          (bestTokenAddr != bestToken && (_worstRate.add(minRateDifference) < _bestRate))) {
        shouldRebalance = true;
        return (shouldRebalance, bestTokenAddr);
      }

      return (shouldRebalance, bestTokenAddr);
  }
}
