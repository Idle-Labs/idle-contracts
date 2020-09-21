var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IdleRebalancerV3_1 = artifacts.require("./IdleRebalancerV3_1.sol");
var IdleRebalancerHelperDAI = artifacts.require("./IdleRebalancerHelperDAI.sol");
var IdleCompoundV2 = artifacts.require("./IdleCompoundV2.sol");
var IdleFulcrumV2 = artifacts.require("./IdleFulcrumV2.sol");
var IdleAave = artifacts.require("./IdleAave.sol");
var IdleDyDx = artifacts.require("./IdleDyDx.sol");
var IdleDSR = artifacts.require("./IdleDSR.sol");
var yxToken = artifacts.require("./yxToken.sol");
var IERC20 = artifacts.require("./IERC20.sol");

const {creator, rebalancerManager, feeAddress, gstAddress} = require('./addresses.js');
const BigNumber = require('bignumber.js');
const BNify = s => new BigNumber(String(s));

const cDAI = {
  'live': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'proxy': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'live-fork': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643', // needed for truffle
  'kovan': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c',
  'kovan-fork': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c', // needed for truffle
  'local': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'local-fork': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'test': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'coverage': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',

  'deploy': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c', // used for truffle Teams deploy, now kovan
};
const iDAI = {
  'live': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'proxy': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'live-fork': '0x493C57C4763932315A328269E1ADaD09653B9081', // needed for truffle
  'kovan': '0x6c1e2b0f67e00c06c8e2be7dc681ab785163ff4d',
  'kovan-fork': '0x6c1e2b0f67e00c06c8e2be7dc681ab785163ff4d', // needed for truffle
  'local': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'local-fork': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'test': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'coverage': '0x493C57C4763932315A328269E1ADaD09653B9081',

  'deploy': '0x6c1e2b0f67e00c06c8e2be7dc681ab785163ff4d', // used for truffle Teams deploy, now kovan
};
const aDAI = {
  'live': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'proxy': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'live-fork': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d', // needed for truffle
  'kovan': '',
  'kovan-fork': '', // needed for truffle
  'local': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'local-fork': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'test': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'coverage': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',

  'deploy': '', // used for truffle Teams deploy, now kovan
};
const CHAI = {
  'live': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'proxy': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'live-fork': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215', // needed for truffle
  'kovan': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'kovan-fork': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215', // needed for truffle
  'local': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'local-fork': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'test': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'coverage': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',

  'deploy': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215', // used for truffle Teams deploy, now kovan
};
const DAI = {
  'live': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'proxy': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'live-fork': '0x6B175474E89094C44Da98b954EedeAC495271d0F', // needed for truffle
  'kovan': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
  'kovan-fork': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // needed for truffle
  'local': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'local-fork': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'test': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'coverage': '0x6B175474E89094C44Da98b954EedeAC495271d0F',

  'deploy': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // used for truffle Teams deploy, now kovan
};
const COMP = {
  'live': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'proxy': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'live-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888', // needed for truffle
  'kovan': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'kovan-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888', // needed for truffle
  'local': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'local-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'test': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'coverage': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'deploy': '0xc00e94cb662c3520282e6f5717214004a7f26888', // used for truffle Teams deploy, now kovan
}

// IdleProxy contract for this token whoudl already be deployed with oz cli as upgradable
// IdleDAIProxy address
const proxy = '0x3fE7940616e5Bc47b0775a0dccf6237893353bB4';

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network == 'coverage') {
    return;
  }
  // dydx market if supported
  const marketId = 3;
  // underlying token decimals
  const decimals = 18;
  const one = BNify('1000000000000000000');
  // yxToken instance if present (for Dydx)
  let yxDAIInstance = {address: '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a'};

  console.log('Network', network);
  console.log('cDAI address: ', cDAI[network]);
  console.log('iDAI address: ', iDAI[network]);
  console.log('CHAI address: ', CHAI[network]);
  console.log('yxDAI address: ', yxDAIInstance.address);
  console.log('DAI address: ', DAI[network]);
  console.log('##################');

  // #######################
  let fulcrumDAIInstance;
  await deployer.deploy(IdleFulcrumV2, iDAI[network], DAI[network], {from: creator}).then(instance => fulcrumDAIInstance = instance)
  let compoundDAIInstance;
  await deployer.deploy(IdleCompoundV2, cDAI[network], DAI[network], {from: creator}).then(instance => compoundDAIInstance = instance)
  let aaveDAIInstance;
  await deployer.deploy(IdleAave, aDAI[network], DAI[network], {from: creator}).then(instance => aaveDAIInstance = instance)
  let dydxDAIInstance;
  await deployer.deploy(IdleDyDx, yxDAIInstance.address, DAI[network], marketId, {from: creator}).then(instance => dydxDAIInstance = instance)

  let rebalancerDAIInstance;
  await deployer.deploy(IdleRebalancerV3_1,
    [cDAI[network], iDAI[network], aDAI[network], yxDAIInstance.address],
    rebalancerManager,
    {from: creator}
  ).then(instance => rebalancerDAIInstance = instance)

  // #######################
  // console.log('Restart migration with 0.5M as gas limit and remore return');
  // return;

  // see https://github.com/trufflesuite/truffle/issues/737
  await IdleDAIInstance.methods['initialize(string,string,address,address,address,address)'](
    'IdleDAI v4 [Best yield]',
    'idleDAIYield',
    DAI[network],
    iDAI[network],
    cDAI[network],
    rebalancerDAIInstance.address,
    {from: creator}
  );
  await IdleDAIInstance.setGovTokens(
    [COMP[network]],
    {from: creator}
  );
  await IdleDAIInstance.setAllAvailableTokensAndWrappers(
    [cDAI[network], iDAI[network], aDAI[network], yxDAIInstance.address],
    [compoundDAIInstance.address, fulcrumDAIInstance.address, aaveDAIInstance.address, dydxDAIInstance.address],
    {from: creator}
  ).catch(err => {
    console.log('err', err);
  });

  console.log('[DAI] IdleCompoundV2 address:', compoundDAIInstance.address);
  console.log('[DAI] IdleFulcrumV2  address:', fulcrumDAIInstance.address);
  console.log('[DAI] IdleAave  address:', aaveDAIInstance.address);
  console.log('[DAI] IdleDyDx  address:', dydxDAIInstance.address);
  console.log('[DAI] IdleRebalancerV3_1  address:', rebalancerDAIInstance.address);
  console.log('#### IdleDAIYield Address: ', IdleDAIAddress);

  await (await IdleCompoundV2.at(compoundDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  await (await IdleFulcrumV2.at(fulcrumDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  await (await IdleAave.at(aaveDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  await (await IdleDyDx.at(dydxDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  await (await IdleRebalancerV3_1.at(rebalancerDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});

  await IdleDAIInstance.setFeeAddress(feeAddress, {from: creator});
  await IdleDAIInstance.setFee(BNify('10000'), {from: creator});
  // console.log('Restart migration with 3M as gas limit and remove return');
  // return;
  // ##############################
  //
  // call this with rebalancer account
  // const gstContract = await IERC20.at(gstAddress);
  // await gstContract.approve(IdleDAIAddress, BNify('-1'), { from: rebalancerManager });
  // const IdleRebalancerV3Instance = await IdleRebalancerV3_1.at(rebalancerDAIInstance.address);
  // await IdleRebalancerV3Instance.setAllocations(
  //   [70000, 10000, 10000, 10000],
  //   [cDAI[network], iDAI[network], aDAI[network], yxDAIInstance.address],
  //   {from: rebalancerManager}
  // );
  //
  // console.log('approving')
  // const DAIContract = await IERC20.at(DAI[network]);
  // await DAIContract.approve(IdleDAIAddress, BNify('-1'), { from: rebalancerManager });
  // console.log('minting 1')
  // await IdleDAIInstance.mintIdleToken(one, true, rebalancerManager, {from: rebalancerManager});
  // await IdleDAIInstance.redeemIdleToken(BNify('10'), {from: rebalancerManager});
};
