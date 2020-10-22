var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IERC20 = artifacts.require("./IERC20.sol");
var IProxyAdmin = artifacts.require("./IProxyAdmin.sol");

const {
  creator, rebalancerManager, feeAddress, gstAddress,
  cDAI, iDAI, aDAI, CHAI, DAI, yxDAI, idleDAIV4, idleDAISafeV4,
  cUSDC, iUSDC, aUSDC, USDC, yxUSDC, idleUSDCV4, idleUSDCSafeV4,
  cUSDT, iUSDT, aUSDT, USDT, idleUSDTV4, idleUSDTSafeV4,
  aTUSD, TUSD, idleTUSDV4,
  aSUSD, SUSD, idleSUSDV4,
  cWBTC, iWBTC, aWBTC, WBTC, idleWBTCV4,
  COMP, IDLE,
  timelock, idleMultisig, proxyAdmin
} = require('./addresses.js');

const BigNumber = require('bignumber.js');
const BNify = s => new BigNumber(String(s));

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network == 'coverage') {
    return;
  }
  if (!IDLE && network === 'live') {
    console.log('set IDLE address');
    return;
  }
  const one = BNify('1000000000000000000');
  const addr0 = '0x0000000000000000000000000000000000000000';

  const idle = await IERC20.at(IDLE);
  const idleDAI = await IdleTokenV3_1.at(idleDAIV4);
  const idleUSDC = await IdleTokenV3_1.at(idleUSDCV4);
  const idleUSDT = await IdleTokenV3_1.at(idleUSDTV4);
  const idleSUSD = await IdleTokenV3_1.at(idleSUSDV4);
  const idleTUSD = await IdleTokenV3_1.at(idleTUSDV4);
  const idleWBTC = await IdleTokenV3_1.at(idleWBTCV4);
  const idleDAISafe = await IdleTokenV3_1.at(idleDAISafeV4);
  const idleUSDCSafe = await IdleTokenV3_1.at(idleUSDCSafeV4);
  const idleUSDTSafe = await IdleTokenV3_1.at(idleUSDTSafeV4);

  // DAI
  const compoundV2DAIBest = '0x7466c91238d6e9c16801b4b885cfc3155af3fce3';
  const aaveDAIBest = '0x0bc3bba4ef3d1355a76e69900f98a59d30ef54f3';
  const dyDxDAIBest = '0xe9B1391334B2727ff23206255873D8A7C4C403Cb';
  await idleDAI.manualInitialize(
    [COMP[network], IDLE], // govTokens
    [cDAI[network], aDAI[network], yxDAI[network]], // protocolTokens
    [compoundV2DAIBest, aaveDAIBest, dyDxDAIBest], // protocolWrappers
    [BNify('100000'), BNify('0'), BNify('0')], // lastRebalancerAllocations
    false, // isRiskAdjusted
    {from: creator}
  );
  console.log('manually initialized idleDAI');

  const compoundV2DAISafe = '0x5CcBa376bc879362b1069323b74298Ee68fF83D6';
  const aaveDAISafe = '0x11833cf5145C4EC310b315Fa9781c53cdb4B9718';
  const dyDxDAISafe = '0xE3D2f165AE2143ad13e1674ca50865b1304539c4';
  await idleDAISafe.manualInitialize(
    [COMP[network], IDLE], // govTokens
    [cDAI[network], aDAI[network], yxDAI[network]],
    [compoundV2DAISafe, aaveDAISafe, dyDxDAISafe],
    [BNify('100000'), BNify('0'), BNify('0')], // lastRebalancerAllocations
    true, // isRiskAdjusted
    {from: creator}
  );
  console.log('manually initialized idleDAISafe');

  // USDC
  const compoundUSDCBest = '0xE8981Aa72d495AA71681c41159c1Ec8746eE3fbD';
  const aaveUSDCBest = '0x695085c4eAE4c0416E26DE99059Db71d8183b783';
  const dyDxUSDCBest = '0xc5b580114c19E1490cf4573c59db6A2Fb2F402BD';
  await idleUSDC.manualInitialize(
    [COMP[network], IDLE], // govTokens
    [cUSDC[network], aUSDC[network], yxUSDC[network]],
    [compoundUSDCBest, aaveUSDCBest, dyDxUSDCBest],
    [BNify('100000'), BNify('0'), BNify('0')], // lastRebalancerAllocations
    false, // isRiskAdjusted
    {from: creator}
  );
  console.log('manually initialized idleUSDC');

  const compoundUSDCSafe = '0x55583F7Ca92F4Cf051e6f55D77a967bA9B2C1edD';
  const aaveUSDCSafe = '0xE85f72Cb10Eb9406d3857397e194168e43De534d';
  const dyDxUSDCSafe = '0xbae90B9C5DAF4122eA5Ed51492D0a86638f8fCF5';
  await idleUSDCSafe.manualInitialize(
    [COMP[network], IDLE], // govTokens
    [cUSDC[network], aUSDC[network], yxUSDC[network]],
    [compoundUSDCSafe, aaveUSDCSafe, dyDxUSDCSafe],
    [BNify('100000'), BNify('0'), BNify('0')], // lastRebalancerAllocations
    true, // isRiskAdjusted
    {from: creator}
  );
  console.log('manually initialized idleUSDCSafe');

  // USDT
  const compoundV2USDTBest = '0x3751b4466a238Db35C39B578D4889cFB6847A46B';
  const aaveUSDTBest = '0x0F4B416A651f57358C2aA86dA285100fbE5bc7C9';
  await idleUSDT.manualInitialize(
    [COMP[network], IDLE], // govTokens
    [cUSDT[network], aUSDT[network]],
    [compoundV2USDTBest, aaveUSDTBest],
    [BNify('100000'), BNify('0')], // lastRebalancerAllocations
    false, // isRiskAdjusted
    {from: creator}
  );
  console.log('manually initialized idleUSDT');

  const compoundUSDTSafe = '0x9fd4bF528563F0535fA84C93200e105612B39bFE';
  const aaveUSDTSafe = '0x292714dD74A03ADAf59c0dec61353340E8A85e67';
  await idleUSDTSafe.manualInitialize(
    [COMP[network], IDLE], // govTokens
    [cUSDT[network], aUSDT[network]],
    [compoundUSDTSafe, aaveUSDTSafe],
    [BNify('100000'), BNify('0')], // lastRebalancerAllocations
    true,
    {from: creator}
  );
  console.log('manually initialized idleUSDTSafe');

  // TUSD
  const aaveTUSD = '0xff9338dae3d2335172156467c5440da4db05ae52';
  await idleTUSD.manualInitialize(
    [IDLE], // govTokens
    [aTUSD[network]],
    [aaveTUSD],
    [BNify('100000')], // lastRebalancerAllocations
    false,
    {from: creator}
  );
  console.log('manually initialized idleTUSD');

  // SUSD
  const aaveSUSD = '0x9509af16566eb4d7401b50250de73d2f6dfb60c3';
  await idleSUSD.manualInitialize(
    [IDLE], // govTokens
    [aSUSD[network]],
    [aaveSUSD],
    [BNify('100000')], // lastRebalancerAllocations
    false,
    {from: creator}
  );
  console.log('manually initialized idleSUSD');

  // WBTC
  const compoundWBTC = '0x969Ce00488720D4907C75Da5fD9565B5AC27E8BA';
  const aaveWBTC = '0xa91cf5b36a691bda39640156b081cb71c3e9992e';
  await idleWBTC.manualInitialize(
    [COMP[network], IDLE], // govTokens
    [cWBTC[network], aWBTC[network]],
    [compoundWBTC, aaveWBTC],
    [BNify('100000'), BNify('0')], // lastRebalancerAllocations
    false,
    {from: creator}
  );
  console.log('manually initialized idleWBTC');

  // Deploy new implementation contract IdleTokenGovernance and set new implementation
  // to all proxies via openzeppelin
};
