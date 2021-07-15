var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IdleCompoundLike = artifacts.require("./IdleCompoundLike.sol");
var IdleFuse = artifacts.require("./IdleFuse.sol");
var IdleFulcrumV2 = artifacts.require("./IdleFulcrumV2.sol");
var IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
var IdleDyDx = artifacts.require("./IdleDyDx.sol");
var IdleDSR = artifacts.require("./IdleDSR.sol");
var yxToken = artifacts.require("./yxToken.sol");
var IERC20 = artifacts.require("./ERC20Detailed.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");

const BigNumber = require('bignumber.js');
const BN = s => new BigNumber(String(s));

const addresses = require('./addresses.js');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' ||  network === 'soliditycoverage') {
    return;
  }

  network = "matic";
  const chainId = await web3.eth.getChainId();
  const creator = addresses.creator;
  const proxyFactory = await MinimalInitializableProxyFactory.at(addresses.minimalInitializableProxyFactory[network]);
  const one = BN('1000000000000000000');

  console.log("creator:", creator);
  console.log("proxyFactory:", proxyFactory.address);

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

  // deploy IdleCompoundLike implementation
  let idleCompoundLikeImplementation;
  console.log("deploying IdleCompoundLike implementation");
  await deployer.deploy(IdleCompoundLike, { from: creator }).then(instance => idleCompoundLikeImplementation = instance);
  console.log("IdleCompoundLike instance deployed ", idleCompoundLikeImplementation.address);

  const tasks = [
    {
      idleTokenAddress: addresses.maticIdleDAIV4,
      crTokenAddress: addresses.crDAI[network],
    },
    {
      idleTokenAddress: addresses.maticIdleUSDCV4,
      crTokenAddress: addresses.crUSDC[network],
    },
    {
      idleTokenAddress: addresses.maticIdleWETHV4,
      crTokenAddress: addresses.crWETH[network],
    },
  ];

  // deploy wrappers
  for (var i = 0; i < tasks.length; i++) {
    console.log("");
    const task = tasks[i];
    const idleToken = await IdleTokenGovernance.at(task.idleTokenAddress);
    const crToken = await IERC20.at(task.crTokenAddress);
    console.log("idleToken:", await idleToken.name(), idleToken.address);
    console.log("crToken:", await crToken.name(), crToken.address);

    console.log("deploying cream wrapper via proxy factory");
    const creamWrapperAddress = await deployWrapperProxy(proxyFactory, idleCompoundLikeImplementation.address, crToken.address, idleToken.address, idleToken.address, creator);
    console.log("**** 2")
    tasks[i].wrapperAddress = creamWrapperAddress;
    console.log("creamWrapperAddress", creamWrapperAddress);

    const creamWrapperInstance = await IdleCompoundLike.at(creamWrapperAddress);
    const idleCreamApr = await creamWrapperInstance.getAPR.call();
    console.log('idleCreamApr', BN(idleCreamApr).div(one).toString());
    console.log("*****************************************************************");
  };

  console.log("\n\ncalling setAllAvailableTokensAndWrappers\n\n");

  // calling setAllAvailableTokensAndWrappers
  for (var i = 0; i < tasks.length; i++) {
    console.log("");
    const task = tasks[i];
    const idleToken = await IdleTokenGovernance.at(task.idleTokenAddress);
    console.log("idleToken:", await idleToken.name(), idleToken.address);

    const protocolTokens = (await idleToken.getAPRs())["0"];
    console.log("tokens:", protocolTokens);
    let wrappers = [];

    for (var j = 0; j < protocolTokens.length; j++) {
      const token = protocolTokens[j];
      const wrapper = await idleToken.protocolWrappers(token);
      wrappers.push(wrapper);
    };
    console.log("wrappers:", wrappers);

    console.log("adding crToken and wrapper");

    newProtocolTokens = [...protocolTokens, task.crTokenAddress];
    newWrappers = [...wrappers, task.wrapperAddress];

    console.log("new tokens:", newProtocolTokens);
    console.log("new wrappers:", newWrappers);

    await idleToken.setAllAvailableTokensAndWrappers(
      newProtocolTokens, // protocolTokens
      newWrappers, // wrappers
      [addresses.WMATIC[network]], // newGovTokens
      [addresses.WMATIC[network], addresses.addr0], // newGovTokensEqualLen
      { from: creator, chainId }
    );

    console.log("*****************************************************************");
  }

  return

  const decimals = 18;

  console.log('Network', network);
  console.log('RAI address: ', RAI[network]);
  console.log('crRAI address: ', crRAI[network]);
  console.log('##################');

  // #######################

  const idleTokenAddress = '0x5C960a3DCC01BE8a0f49c02A8ceBCAcf5D07fABe';
  const idleToken = await IdleTokenV3_1.at(idleTokenAddress);

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
