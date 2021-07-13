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

const addresses = require('./addresses.js');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' ||  network === 'soliditycoverage') {
    return;
  }

  network = "matic";
  const chainId = await web3.eth.getChainId();

  const decimals = 6;
  const one = BNify('1000000');

  console.log('Network', network);
  console.log('USDC address: ', addresses.USDC[network]);
  console.log('aUSDC address: ', addresses.aUSDCV2[network]);
  console.log('##################');

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

  // #######################

  const idleTokenAddress = addresses.maticIdleUSDCV4;
  const idleToken = await IdleTokenV3_1.at(idleTokenAddress);

  const proxyFactory = await MinimalInitializableProxyFactory.at(addresses.minimalInitializableProxyFactory[network]);

  console.log('idleTokenAddress', idleTokenAddress);

  // deploy wrapper proxies
  // aave
  console.log("deploying aave wrapper via proxy factory");
  const aaveV2WrapperAddress = await deployWrapperProxy(proxyFactory, addresses.maticIdleAaveV2Implementation, addresses.aUSDCV2[network], addresses.aaveAddressesProvider[network], idleTokenAddress, addresses.creator);
  console.log("idleAaveV2USDC deployed", aaveV2WrapperAddress);

  const idleAaveV2USDC = await IdleAaveV2.at(aaveV2WrapperAddress);
  const idleAaveV2USDCApr = await idleAaveV2USDC.getAPR.call();
  console.log('idleAaveV2USDCApr', BNify(idleAaveV2USDCApr).div(one).toString());

  console.log("calling idleToken.manualInitialize");
  await idleToken.manualInitialize(
    [], // govTokens, no IDLE initially
    [addresses.aUSDCV2[network]],
    [aaveV2WrapperAddress],
    [BNify('100000')], // lastRebalancerAllocations
    false,
    addresses.addr0, // cToken
    { from: addresses.creator, chainId: chainId }
  );

  console.log('manually initialized idleUSDC');
  console.log('[WETH] IdleAaveUSDCV2 address:', aaveV2WrapperAddress);
  console.log('#### IdleUSDCYield Address: ', idleTokenAddress);
};
