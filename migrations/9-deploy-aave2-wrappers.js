const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require("./addresses");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  await deployer.deploy(MinimalInitializableProxyFactory);
  const proxyFactory = await MinimalInitializableProxyFactory.deployed();
  console.log("MinimalInitializableProxyFactory deployed at", proxyFactory.address);

  const idleTokens = {
    "idleDAIV4": {
      idleTokenAddress: addresses.idleDAIV4,
      aTokenAddress: addresses.aDAIV2.live,
      underlyingTokenAddress: addresses.DAI.live,
    },
    "idleUSDCV4": {
      idleTokenAddress: addresses.idleUSDCV4,
      aTokenAddress: addresses.aUSDCV2.live,
      underlyingTokenAddress: addresses.USDC.live,
    },
    "idleUSDTV4": {
      idleTokenAddress: addresses.idleUSDTV4,
      aTokenAddress: addresses.aUSDTV2.live,
      underlyingTokenAddress: addresses.USDT.live,
    },
    "idleSUSDV4": {
      idleTokenAddress: addresses.idleSUSDV4,
      aTokenAddress: addresses.aSUSDV2.live,
      underlyingTokenAddress: addresses.SUSD.live,
    },
    "idleTUSDV4": {
      idleTokenAddress: addresses.idleTUSDV4,
      aTokenAddress: addresses.aTUSDV2.live,
      underlyingTokenAddress: addresses.TUSD.live,
    },
    "idleWBTCV4": {
      idleTokenAddress: addresses.idleWBTCV4,
      aTokenAddress: addresses.aWBTCV2.live,
      underlyingTokenAddress: addresses.WBTC.live,
    },
    "idleDAISafeV4": {
      idleTokenAddress: addresses.idleDAISafeV4,
      aTokenAddress: addresses.aDAIV2.live,
      underlyingTokenAddress: addresses.DAI.live,
    },
    "idleUSDCSafeV4": {
      idleTokenAddress: addresses.idleUSDCSafeV4,
      aTokenAddress: addresses.aUSDCV2.live,
      underlyingTokenAddress: addresses.USDC.live,
    },
    "idleUSDTSafeV4": {
      idleTokenAddress: addresses.idleUSDTSafeV4,
      aTokenAddress: addresses.aUSDTV2.live,
      underlyingTokenAddress: addresses.USDT.live,
    },
  }

  const addressesProvider = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";

  await deployer.deploy(IdleAaveV2);
  const aaveV2WrapperImplementation = await IdleAaveV2.deployed();
  console.log("IdleAaveV2 implementation deployed at", aaveV2WrapperImplementation.address, "\n\n");

  for (const name in idleTokens) {
    const attrs = idleTokens[name];
    const idleTokenAddress = attrs.idleTokenAddress;
    const aTokenAddress = attrs.aTokenAddress;
    const underlyingTokenAddress = attrs.underlyingTokenAddress;

    console.log("deploying AaveV2 wrapper for", name);
    console.log("idleTokenAddress", idleTokenAddress)
    console.log("aTokenAddress", aTokenAddress)
    console.log("underlyingTokenAddress", underlyingTokenAddress)

    const initSig = "initialize(address,address,address)";
    const initData = web3.eth.abi.encodeParameters(
      ["address", "address", "address"],
      [aTokenAddress, addressesProvider, idleTokenAddress]
    );
    const result = await proxyFactory.create(aaveV2WrapperImplementation.address, initSig, initData);
    const aaveV2Wrapper = await IdleAaveV2.at(result.logs[0].args.proxy);
    attrs.aaveV2WrapperAddress = aaveV2Wrapper.address;
    console.log("AaveV2 wrapper for", name, "deployed at", aaveV2Wrapper.address, "gas used:", result.receipt.gasUsed);
    console.log("\n************************************\n\n")
  };

  console.log("const idleTokens =", idleTokens);
}
