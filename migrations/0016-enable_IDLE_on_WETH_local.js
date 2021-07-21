var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IERC20 = artifacts.require("./IERC20.sol");
var IProxyAdmin = artifacts.require("./IProxyAdmin.sol");
var IAdminUpgradeabilityProxy = artifacts.require("./IAdminUpgradeabilityProxy.sol");
var IGovernorAlpha = artifacts.require("./IGovernorAlpha.sol");
var IdleController = artifacts.require("./IdleController.sol");
const { time } = require('@openzeppelin/test-helpers');

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
const timelockDelay = 172800
const advanceBlocks = async n => {
  for (var i = 0; i < n; i++) {
    if (i === 0 || i % 100 === 0) {
      process.stdout.clearLine();  // clear current text
      process.stdout.cursorTo(0);
      process.stdout.write(`waiting for ${n - i} blocks...`);
    }

    await time.advanceBlock();
  }
}
const getLatestPropsal = async gov => gov.proposalCount.call()

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network == 'soliditycoverage') {
    return;
  }
  if (!IDLE && network === 'live') {
    console.log('set IDLE address');
    return;
  }
  const one = BNify('1000000000000000000');
  const addr0 = '0x0000000000000000000000000000000000000000';

  const idle = await IERC20.at(IDLE);
  const comp = await IERC20.at(COMP.live);
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
  const gov = await IGovernorAlpha.at(addresses.governorAlpha);


  if (network === 'local') {
    await web3.eth.sendTransaction({from: accounts[0], to: timelock, value: BNify(one).times(BNify('10'))});
  }
  // console.log('getAllMarkets pre', await idleCtrl.getAllMarkets({from: timelock}));

  // ####################
  // // execute the proposal
  // await time.increase(timelockDelay+100)
  // console.log("time increased")
  // await advanceBlocks(1)
  // console.log("advanced 1")
  // const proposalId = await getLatestPropsal(gov);
  // await gov.execute(proposalId);
  // console.log('executed');
  // await advanceBlocks(2);

  // // Those 2 actions should be done with a proposal
  // console.log('Doing _supportMarkets');
  // await idleCtrl._supportMarkets([idleWETHV4], {from: timelock});
  // console.log('Doing _addIdleMarkets');
  // await idleCtrl._addIdleMarkets([idleWETHV4], {from: timelock});
  // ####################

  // Test that idleWETH has a speed
  console.log('getAllMarkets', await idleCtrl.getAllMarkets({from: timelock}));
  console.log('speed idleDAIV4', (await idleCtrl.idleSpeeds(idleDAIV4, {from: timelock})).toString());
  console.log('speed idleUSDCV4', (await idleCtrl.idleSpeeds(idleUSDCV4, {from: timelock})).toString());
  console.log('speed idleWBTCV4', (await idleCtrl.idleSpeeds(idleWBTCV4, {from: timelock})).toString());
  console.log('speed idleWETHV4', (await idleCtrl.idleSpeeds(idleWETHV4, {from: timelock})).toString());

  // ###########################################
  console.log('timelock', timelock);
  console.log('all proxyAdmin', proxyAdmin);
  console.log('eth proxyAdmin', proxyAdminETH);
  await idleWETH.setGovTokens([COMP.live, IDLE], [addresses.cWETH[network], addresses.aWETH[network]], {from: creator});
  console.log('idleWETH.setGovTokens')

  // Change proxyAdmin so to have the same one for all tokens
  const proxyAdminInstance = await IProxyAdmin.at(proxyAdminETH);
  await proxyAdminInstance.changeProxyAdmin(idleWETHV4, proxyAdmin, {from: creator});
  console.log('proxyChanged')
  await idleWETH.transferOwnership(timelock, {from: creator});
  console.log('idleWETH.transferOwnership');

  // check that is indeed timelock the owner of the contract and the admin of
  // the IAdminUpgradeabilityProxy
  const adminProxy = await IAdminUpgradeabilityProxy.at(idleWETHV4);
  console.log(`new admin `, await adminProxy.admin.call({from: proxyAdmin}));
  const proxyAdminAll = await IProxyAdmin.at(proxyAdmin);
  console.log(`proxy admin owner`, await proxyAdminAll.owner.call());
  console.log('new owner', await idleWETH.owner());

  // test redeem and check that you get IDLE
  await advanceBlocks(2);
  const usr = addresses.idleWETHUser;
  console.log('Bal pre IDLE', (await idle.balanceOf.call(usr)).toString());
  console.log('Bal pre COMP', (await comp.balanceOf.call(usr)).toString());
  await idleWETH.redeemIdleToken(BNify('0'), {from: usr});
  console.log('Bal pre IDLE', (await idle.balanceOf.call(usr)).toString());
  console.log('Bal pre COMP', (await comp.balanceOf.call(usr)).toString());
};
