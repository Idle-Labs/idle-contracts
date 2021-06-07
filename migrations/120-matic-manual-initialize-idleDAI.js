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
  aSUSD, SUSD, idleSUSDV4, aDAIV2,
  cWBTC, iWBTC, aWBTC, WBTC, idleWBTCV4,
  COMP, IDLE, aWETH, WETH, cWETH, RAI, crRAI, fuseRAI, addr0,
  timelock, idleMultisig, proxyAdmin, aaveAddressesProvider,
  minimalInitializableProxyFactory,
  maticIdleDAIV4
} = require('./addresses.js');


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' ||  network === 'soliditycoverage') {
    return;
  }

  const chainId = await web3.eth.getChainId();

  const deployWrapperProxy = async (proxyFactory, implementationAddress, tokenAddress, aaveV2AddressesProvider, idleTokenAddress, from) => {
    const initSig = "initialize(address,address,address)";
    const initData = web3.eth.abi.encodeParameters(
      ["address", "address", "address"],
      [tokenAddress, aaveV2AddressesProvider, idleTokenAddress]
    );

    console.log("initSig", initSig);
    console.log("initData", initData);

    const result = await proxyFactory.createAndCall(implementationAddress, initSig, initData, { from: from, chainId: chainId });
    const wrapperAddress = result.logs[0].args.proxy;
    return wrapperAddress;
  }

  const decimals = 18;
  const one = BNify('1000000000000000000');

  console.log('Network', network);
  console.log('DAI address: ', DAI[network]);
  console.log('aDAI address: ', aDAIV2[network]);
  console.log('##################');

  // #######################

  const idleTokenAddress = maticIdleDAIV4;
  const idleToken = await IdleTokenV3_1.at(idleTokenAddress);

  const proxyFactory = await MinimalInitializableProxyFactory.at(minimalInitializableProxyFactory[network]);

  console.log('idleTokenAddress', idleTokenAddress);

  // deploy IdleAaveV2 implementation
  let idleAaveV2Instance;
  console.log("deploying IdleAaveV2 instance");
  await deployer.deploy(IdleAaveV2, {from: creator, chainId: chainId}).then(instance => idleAaveV2Instance = instance)
  console.log("idleAaveV2Instance instance deployed ", idleAaveV2Instance.address);

  // deploy wrapper proxies
  // aave
  console.log("deploying aave wrapper via proxy factory");
  const aaveV2WrapperAddress = await deployWrapperProxy(proxyFactory, idleAaveV2Instance.address, aDAIV2[network], aaveAddressesProvider[network], idleTokenAddress, creator);
  console.log("aaveV2WrapperAddress", aaveV2WrapperAddress);

  const idleADAIV2Instance = await IdleAaveV2.at(aaveV2WrapperAddress);
  const idleADAIV2Apr = await idleADAIV2Instance.getAPR.call();
  console.log('idleADAIV2Apr', BNify(idleADAIV2Apr).div(one).toString());

  console.log("calling idleToken.manualInitialize");
  await idleToken.manualInitialize(
    [], // govTokens, no IDLE initially
    [aDAIV2[network]],
    [aaveV2WrapperAddress],
    [BNify('100000')], // lastRebalancerAllocations
    false,
    addr0, // cToken
    { from: creator, chainId: chainId }
  );

  console.log('manually initialized idleDAI');
  console.log('[WETH] IdleADAIV2 address:', aaveV2WrapperAddress);
  console.log('#### IdleDAIYield Address: ', idleTokenAddress);


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
