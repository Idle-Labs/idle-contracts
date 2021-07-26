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
const addresses = require('./addresses.js');

const BigNumber = require('bignumber.js');
const BNify = s => new BigNumber(String(s));

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
  console.log('FEI address: ', addresses.FEI[network]);
  console.log('crFEI address: ', addresses.crFEI[network]);
  console.log('fuseFEI address: ', addresses.fuseFEI[network]);
  console.log('##################');

  // #######################

  const idleTokenAddress = addresses.idleFEIV4;
  const idleToken = await IdleTokenV3_1.at(idleTokenAddress);

  const proxyFactory = await MinimalInitializableProxyFactory.at(addresses.minimalInitializableProxyFactory[network]);

  console.log('idleTokenAddress', idleTokenAddress);

  // deploy wrapper proxies
  // cream
  console.log("deploying cream wrapper via proxy factory");
  const creamWrapperAddress = await deployWrapperProxy(proxyFactory, addresses.idleCREAMImplementation, addresses.crFEI[network], idleTokenAddress, idleTokenAddress, addresses.creator);
  console.log("creamWrapperAddress", creamWrapperAddress);

  // fuse
  console.log("deploying fuse wrapper via proxy factory");
  const fuseWrapperAddress = await deployWrapperProxy(proxyFactory, addresses.idleFUSEImplementation, addresses.fuseFEI[network], idleTokenAddress, idleTokenAddress, addresses.creator);
  console.log("fuseWrapperAddress", fuseWrapperAddress);

  const creamFEIInstance = await IdleCompoundLike.at(creamWrapperAddress);
  const idleCreamApr = await creamFEIInstance.getAPR.call();
  console.log('idleCreamApr', BNify(idleCreamApr).div(one).toString());

  const fuseFEIInstance = await IdleCompoundLike.at(fuseWrapperAddress);
  const idleFuseApr = await fuseFEIInstance.getAPR.call();
  console.log('idleFuseApr', BNify(idleFuseApr).div(one).toString());

  console.log("calling idleToken.manualInitialize");
  await idleToken.manualInitialize(
    [], // govTokens, no IDLE initially
    [addresses.crFEI[network], addresses.fuseFEI[network]],
    [creamWrapperAddress, fuseWrapperAddress],
    [BNify('100000'), BNify('0')], // lastRebalancerAllocations
    false,
    addresses.addr0, // cToken
    addresses.addr0, // aToken
    {from: addresses.creator}
  );

  console.log('manually initialized idleFEI');
  console.log('[WETH] IdleCreamFEI address:', creamWrapperAddress);
  console.log('[WETH] IdleFuseFEI  address:', fuseWrapperAddress);
  console.log('#### IdleFEIYield Address: ', idleTokenAddress);
};
