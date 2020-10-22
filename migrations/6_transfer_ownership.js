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

  // Transfer contract ownership
  await idleDAI.transferOwnership(timelock, {from: creator});
  await idleUSDC.transferOwnership(timelock, {from: creator});
  await idleUSDT.transferOwnership(timelock, {from: creator});
  await idleSUSD.transferOwnership(timelock, {from: creator});
  await idleTUSD.transferOwnership(timelock, {from: creator});
  await idleWBTC.transferOwnership(timelock, {from: creator});
  await idleDAISafe.transferOwnership(timelock, {from: creator});
  await idleUSDCSafe.transferOwnership(timelock, {from: creator});
  await idleUSDTSafe.transferOwnership(timelock, {from: creator});
  console.log('Ownership transferred for all contracts');

  // Set admin for upgradability to governance by calling `transferOwnership`
  // on the ProxyAdmin contract with timelock as parameter
  // ProxyAdmin is the upgradability admin for all idleTokens
  const proxyAdminInstance = await IProxyAdmin.at(proxyAdmin);
  await proxyAdminInstance.transferOwnership(timelock, {from: creator});
  console.log('Upgradability ability transferred');
};
