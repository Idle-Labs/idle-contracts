var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IdleRebalancerV3_1 = artifacts.require("./IdleRebalancerV3_1.sol");
var IdleRebalancerHelperDAI = artifacts.require("./IdleRebalancerHelperDAI.sol");
// var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
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
const { ZWeb3, Contracts, ProxyAdminProject } = require('@openzeppelin/upgrades');

const cDAI = {
  'live': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
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
  'live-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888', // needed for truffle
  'kovan': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'kovan-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888', // needed for truffle
  'local': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'local-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'test': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'coverage': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'deploy': '0xc00e94cb662c3520282e6f5717214004a7f26888', // used for truffle Teams deploy, now kovan
}

module.exports = async function(deployer, network, accounts) {
  if (network === 'test') {
    return;
  }
  console.log('Network', network);
  console.log('cDAI address: ', cDAI[network]);
  console.log('iDAI address: ', iDAI[network]);
  console.log('CHAI address: ', CHAI[network]);

  const marketId = 3;
  const decimals = 18;

  await web3.eth.sendTransaction({from: accounts[0], to: creator, value: BNify(1e18).times(BNify('20'))});
  // #######################
  // Deploy yxDAI
  let yxDAIInstance = {address: '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a'};
  // let yxDAIInstance;
  // await deployer.deploy(yxToken, DAI[network], marketId, 'yxDAI', 'yxDAI', decimals, {from: creator}).then(instance => yxDAIInstance = instance);
  console.log('yxDAI address: ', yxDAIInstance.address);
  console.log('DAI address: ', DAI[network]);
  console.log('##################');

  // let fulcrumDAIInstance = {address: '0x02072aBC26F1D69849B6dca0b1eA805Dc4cBE2E1'};
  let fulcrumDAIInstance;
  await deployer.deploy(IdleFulcrumV2, iDAI[network], DAI[network], {from: creator}).then(instance => fulcrumDAIInstance = instance)
  // if is using new interestRateModel
  // let compoundDAIInstance = {address: '0x0c39DaF173646c4Ce9e6A678425ed965c98CCC66'};
  let compoundDAIInstance;
  await deployer.deploy(IdleCompoundV2, cDAI[network], DAI[network], {from: creator}).then(instance => compoundDAIInstance = instance)
  // let aaveDAIInstance = {address: '0xa3a3741c48298e21EEbE5A59bEAF6f89DC0E0c4c'};
  let aaveDAIInstance;
  await deployer.deploy(IdleAave, aDAI[network], DAI[network], {from: creator}).then(instance => aaveDAIInstance = instance)
  // let dydxDAIInstance = {address: '0x73B4F354fD8d37fDB7CF13390D366E959E1E2BDf'};
  let dydxDAIInstance;
  await deployer.deploy(IdleDyDx, yxDAIInstance.address, DAI[network], marketId, {from: creator}).then(instance => dydxDAIInstance = instance)

  // let IdleDSRInstance;
  // await deployer.deploy(IdleDSR, CHAI[network], DAI[network], {from: creator}).then(instance => IdleDSRInstance = instance)

  // let rebalancerDAIInstance = {address: '0x99d053a0f4b4100e739c6b42829c7cb59c031d08'};
  let rebalancerDAIInstance;
  await deployer.deploy(IdleRebalancerV3_1,
    [cDAI[network], iDAI[network], aDAI[network], yxDAIInstance.address],
    rebalancerManager,
    {from: creator}
  ).then(instance => rebalancerDAIInstance = instance)

  // #######################
  console.log('Restart migration with 6M as gas limit for deploying IdleToken contract');

  // // Initialize a web3 provider
  ZWeb3.initialize(web3.currentProvider.host);
  console.log(await ZWeb3.defaultAccount());
  // Load the contract
  const IdleTokenV3_1New = Contracts.getFromLocal('IdleTokenV3_1');
  console.log('IdleTokenV3_1New');
  // Instantiate a project
  const myProject = new ProxyAdminProject('IdleTokenV4', null, null, {from: creator});
  console.log('myProject');
  console.log(myProject);
  // Create a proxy for the contract
  const proxy = await myProject.createProxy(IdleTokenV3_1New, {from: creator, gasPrice: 120000000000 });
  console.log('proxy created at', proxy.options.address);

  // Make a change on the contract, and compile it
  // const MyContractUpgraded = Contracts.getFromLocal('IdleTokenV3_1Upgraded');
  // myProject.upgradeProxy(proxy, IdleTokenV3_1Upgraded);

  // let IdleDAIInstance = proxy;
  let IdleDAIInstance = await IdleTokenV3_1.at(proxy.options.address);
  // let IdleDAIInstance = await IdleTokenV3_1.at('0xB0BBC245C04aDCD9C6c516F67BF95A7fbb5762Eb');
  const IdleDAIAddress = IdleDAIInstance.address;
  console.log('Restart migration with 0.5M as gas limit');

  // see https://github.com/trufflesuite/truffle/issues/737
  await IdleDAIInstance.methods['initialize(string,string,address,address,address)'](
    'IdleDAI v4 [Max yield]',
    'idleDAIYield',
    DAI[network],
    iDAI[network],
    rebalancerDAIInstance.address,
    {from: creator}
  );

  await IdleDAIInstance.setAllAvailableTokensAndWrappers(
    [cDAI[network], iDAI[network], aDAI[network], yxDAIInstance.address],
    [compoundDAIInstance.address, fulcrumDAIInstance.address, aaveDAIInstance.address, dydxDAIInstance.address],
    {from: creator}
  );
  console.log('Setting govTokens')
  await IdleDAIInstance.setGovTokens(
    [COMP[network]],
    {from: creator}
  );

  console.log('[DAI] IdleCompoundV2 address:', compoundDAIInstance.address);
  console.log('[DAI] IdleFulcrumV2  address:', fulcrumDAIInstance.address);
  console.log('[DAI] IdleAave  address:', aaveDAIInstance.address);
  console.log('[DAI] IdleDyDx  address:', dydxDAIInstance.address);
  console.log('[DAI] IdleRebalancerV3_1  address:', rebalancerDAIInstance.address);
  console.log('#### IdleDAIYield Address: ', IdleDAIAddress);

  console.log('1');
  await (await IdleCompoundV2.at(compoundDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  console.log('2');
  await (await IdleFulcrumV2.at(fulcrumDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  console.log('3');
  await (await IdleAave.at(aaveDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  console.log('4');
  await (await IdleDyDx.at(dydxDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  console.log('5');
  // console.log('[DAI] IdleDSRInstance  address:', IdleDSRInstance.address);
  // await (await IdleDSR.at(IdleDSRInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  await (await IdleRebalancerV3_1.at(rebalancerDAIInstance.address)).setIdleToken(IdleDAIAddress, {from: creator});
  console.log('6');

  // // Not needed already false
  // await IdleDAIInstance.setIsRiskAdjusted(false, {from: creator});

  await IdleDAIInstance.setFeeAddress(feeAddress, {from: creator});
  console.log('7');

  // ##############################
  console.log('Restart migration with 3M as gas limit');
  // let rebalancerHelperInstance = {address: '0x57Aa7b444458A68A9C2852B9182337aD1dC1c0D7'};
  let rebalancerHelperInstance;
  await deployer.deploy(
    IdleRebalancerHelperDAI,
    DAI[network], cDAI[network], iDAI[network], aDAI[network], yxDAIInstance.address, CHAI[network], marketId, decimals,
    {from: creator}
  ).then(instance => rebalancerHelperInstance = instance);
  console.log('[DAI] IdleRebalancerHelperDAI address:', rebalancerHelperInstance.address);

  // Todo do this below
  // ##############################
  //
  // // TODO call this with changed account
  // const gstContract = await IERC20.at(gstAddress);
  // await gstContract.approve(IdleDAIAddress, BNify('-1'), { from: rebalancerManager });
};
