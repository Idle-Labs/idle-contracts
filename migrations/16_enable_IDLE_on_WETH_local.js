var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IERC20 = artifacts.require("./IERC20.sol");
var IProxyAdmin = artifacts.require("./IProxyAdmin.sol");
var IAdminUpgradeabilityProxy = artifacts.require("./IAdminUpgradeabilityProxy.sol");
var IdleController = artifacts.require("./IdleController.sol");

const {
  creator, rebalancerManager, feeAddress, gstAddress,
  cDAI, iDAI, aDAI, CHAI, DAI, yxDAI, idleDAIV4, idleDAISafeV4,
  cUSDC, iUSDC, aUSDC, USDC, yxUSDC, idleUSDCV4, idleUSDCSafeV4,
  cUSDT, iUSDT, aUSDT, USDT, idleUSDTV4, idleUSDTSafeV4,
  aTUSD, TUSD, idleTUSDV4,
  aSUSD, SUSD, idleSUSDV4,
  cWBTC, iWBTC, aWBTC, WBTC, idleWBTCV4, idleWETHV4,
  COMP, IDLE, idleController,
  timelock, idleMultisig, proxyAdmin, proxyAdminETH
} = require('./addresses.js');
const addresses = require('./addresses.js');

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
  const idleCtrl = await IdleController.at(idleController);
  const idleDAI = await IdleTokenGovernance.at(idleDAIV4);
  const idleUSDC = await IdleTokenGovernance.at(idleUSDCV4);
  const idleUSDT = await IdleTokenGovernance.at(idleUSDTV4);
  const idleSUSD = await IdleTokenGovernance.at(idleSUSDV4);
  const idleTUSD = await IdleTokenGovernance.at(idleTUSDV4);
  const idleWBTC = await IdleTokenGovernance.at(idleWBTCV4);
  const idleWETH = await IdleTokenGovernance.at(idleWETHV4);
  const idleDAISafe = await IdleTokenGovernance.at(idleDAISafeV4);
  const idleUSDCSafe = await IdleTokenGovernance.at(idleUSDCSafeV4);
  const idleUSDTSafe = await IdleTokenGovernance.at(idleUSDTSafeV4);

  if (network === 'local') {
    await web3.eth.sendTransaction({from: accounts[0], to: timelock, value: BNify(one).times(BNify('10'))});
  }
  console.log('getAllMarkets pre', await idleCtrl.getAllMarkets({from: timelock}));

  // Those 2 actions should be done with a proposal
  console.log('Doing _supportMarkets');
  await idleCtrl._supportMarkets([idleWETHV4], {from: timelock});
  console.log('Doing _addIdleMarkets');
  await idleCtrl._addIdleMarkets([idleWETHV4], {from: timelock});

  // Test that idleWETH has a speed
  console.log('getAllMarkets', await idleCtrl.getAllMarkets({from: timelock}));
  console.log('speed idleDAIV4', (await idleCtrl.idleSpeeds(idleDAIV4, {from: timelock})).toString());
  console.log('speed idleUSDCV4', (await idleCtrl.idleSpeeds(idleUSDCV4, {from: timelock})).toString());
  console.log('speed idleWBTCV4', (await idleCtrl.idleSpeeds(idleWBTCV4, {from: timelock})).toString());
  console.log('speed idleWETHV4', (await idleCtrl.idleSpeeds(idleWETHV4, {from: timelock})).toString());

  // ###########################################\
  // Transfer proxy admin
  await idleWETH.setGovTokens([COMP.live, IDLE], [addresses.cWETH[network], addresses.aWETH[network]], {from: creator});
  console.log('idleWETH.setGovTokens')
  await idleWETH.transferOwnership(timelock, {from: creator});
  console.log('idleWETH.transferOwnership')

  // Change proxyAdmin so to have the same one for all tokens
  const proxyAdminInstance = await IProxyAdmin.at(proxyAdminETH);
  await proxyAdminInstance.changeProxyAdmin(idleWETHV4, proxyAdmin, {from: creator});
  console.log('proxyChanged')

  console.log('proxy admin owner', await idleWETH.owner());
  await proxyAdminInstance.transferOwnership(timelock, {from: creator});
  console.log('proxy admin new owner', await idleWETH.owner());

  console.log('this should fail because admin is timelock now')
  await proxyAdminInstance.changeProxyAdmin(idleWETHV4, proxyAdmin, {from: creator});
};
