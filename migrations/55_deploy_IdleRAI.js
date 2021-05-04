var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
// var IdleRebalancerHelperOthersAaveV2 = artifacts.require("./IdleRebalancerHelperOthersAaveV2.sol");
var IdleCompoundLike = artifacts.require("./IdleCompoundLike.sol");
var IdleFuse = artifacts.require("./IdleFuse.sol");
var IdleFulcrumV2 = artifacts.require("./IdleFulcrumV2.sol");
var IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
var IdleDyDx = artifacts.require("./IdleDyDx.sol");
var IdleDSR = artifacts.require("./IdleDSR.sol");
var yxToken = artifacts.require("./yxToken.sol");
var IERC20 = artifacts.require("./IERC20.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");

const BigNumber = require('bignumber.js');
const BNify = s => new BigNumber(String(s));

const {
  creator, rebalancerManager, feeAddress, gstAddress,
  cDAI, iDAI, aDAI, CHAI, DAI, yxDAI, idleDAIV4, idleDAISafeV4,
  cUSDC, iUSDC, aUSDC, USDC, yxUSDC, idleUSDCV4, idleUSDCSafeV4,
  cUSDT, iUSDT, aUSDT, USDT, idleUSDTV4, idleUSDTSafeV4,
  aTUSD, TUSD, idleTUSDV4,
  aSUSD, SUSD, idleSUSDV4,
  cWBTC, iWBTC, aWBTC, WBTC, idleWBTCV4,
  COMP, IDLE, aWETH, WETH, cWETH, RAI, crRAI, fuseRAI, addr0,
  timelock, idleMultisig, proxyAdmin, aaveAddressesProvider,
  minimalInitializableProxyFactory,
} = require('./addresses.js');


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' ||  network === 'soliditycoverage') {
    return;
  }

  const deployWrapperProxy = async (proxyFactory, implementationAddress, tokenAddress, idleTokenAddress, ownerAddress, from) => {
    const initSig = "initialize(address,address,address)";
    const initData = web3.eth.abi.encodeParameters(
      ["address", "address", "address"],
      [tokenAddress, idleTokenAddress, ownerAddress]
    );

    console.log("initSig", initSig);
    console.log("initData", initData);

    const result = await proxyFactory.createAndCall(implementationAddress, initSig, initData, { from: from });
    const wrapperAddress = result.logs[0].args.proxy;
    return wrapperAddress;
  }

  const decimals = 18;
  const one = BNify('1000000000000000000');

  console.log('Network', network);
  console.log('RAI address: ', RAI[network]);
  console.log('crRAI address: ', crRAI[network]);
  console.log('##################');

  // #######################

  const idleTokenAddress = '0x5C960a3DCC01BE8a0f49c02A8ceBCAcf5D07fABe';
  const idleToken = await IdleTokenV3_1.at(idleTokenAddress);

  const proxyFactory = await MinimalInitializableProxyFactory.at(minimalInitializableProxyFactory);

  console.log('idleTokenAddress', idleTokenAddress);

  // deploy IdleCompoundLike implementation
  let idleCompoundLikeInstance;
  console.log("deploying IdleCompoundLike instance");
  await deployer.deploy(IdleCompoundLike, {from: creator}).then(instance => idleCompoundLikeInstance = instance)
  console.log("IdleCompoundLike instance deployed ", idleCompoundLikeInstance.address);

  // deploy wrapper proxies
  // cream
  console.log("deploying cream wrapper via proxy factory");
  const creamWrapperAddress = await deployWrapperProxy(proxyFactory, idleCompoundLikeInstance.address, crRAI[network], idleTokenAddress, idleTokenAddress, creator);
  console.log("creamWrapperAddress", creamWrapperAddress);

  // deploy IdleFuse implementation
  let idleFuseInstance;
  console.log("deploying IdleFuse instance");
  await deployer.deploy(IdleFuse, {from: creator}).then(instance => idleFuseInstance = instance)
  console.log("IdleFuse instance deployed ", idleFuseInstance.address);

  // fuse
  console.log("deploying fuse wrapper via proxy factory");
  const fuseWrapperAddress = await deployWrapperProxy(proxyFactory, idleFuseInstanceAddress, fuseRAI[network], idleTokenAddress, idleTokenAddress, creator);
  console.log("fuseWrapperAddress", fuseWrapperAddress);

  const creamRAIInstance = await IdleCompoundLike.at(creamWrapperAddress);
  const idleCreamApr = await creamRAIInstance.getAPR.call();
  console.log('idleCreamApr', BNify(idleCreamApr).div(one).toString());

  const fuseRAIInstance = await IdleCompoundLike.at(fuseWrapperAddress);
  const idleFuseApr = await fuseRAIInstance.getAPR.call();
  console.log('idleFuseApr', BNify(idleFuseApr).div(one).toString());

  console.log("calling idleToken.manualInitialize");
  await idleToken.manualInitialize(
    [], // govTokens, no IDLE initially
    [crRAI[network], fuseRAI[network]],
    [creamWrapperAddress, fuseWrapperAddress],
    [BNify('100000'), BNify('0')], // lastRebalancerAllocations
    false,
    addr0, // cToken
    {from: creator}
  );

  console.log('manually initialized idleRAI');
  console.log('[WETH] IdleCreamRAI address:', creamWrapperAddress);
  console.log('[WETH] IdleFuseRAI  address:', fuseWrapperAddress);
  console.log('#### IdleRAIYield Address: ', idleTokenAddress);


  // await IdleRAIInstance.setAllAvailableTokensAndWrappers(
  //   [cWETH[network], aWETH[network]],
  //   [compoundWETHInstance.address, aaveWETHInstance.address],
  //   [BNify('100000'), BNify('0')], // lastRebalancerAllocations
  //   true,
  //   {from: creator}
  // );

  // let rebalancerHelperInstance = {address: '0x57Aa7b444458A68A9C2852B9182337aD1dC1c0D7'};
  // console.log('Restart migration with 3.5M as gas limit and remore return');
  // return;
  //
  // let rebalancerHelperInstance;
  // await deployer.deploy(
  //   IdleRebalancerHelperOthersAaveV2,
  //   WETH[network], cWETH[network], addr0, addr0, aWETH[network], addr0, addr0, 0, 18,
  //   {from: creator}
  // ).then(instance => rebalancerHelperInstance = instance);
  // console.log('[WETH] IdleRebalancerHelperOthersAaveV2 address:', rebalancerHelperInstance.address);

  // TODO call this with changed account
  // const gstContract = await IERC20.at(gstAddress);
  // await gstContract.approve(IdleWETHAddress, BNify('-1'), { from: rebalancerManager });
};
