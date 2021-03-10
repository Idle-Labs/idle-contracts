const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');

const toBN = v => new BigNumber(v.toString());

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const proxyFactory = await MinimalInitializableProxyFactory.at(addresses.minimalInitializableProxyFactory);

  const idleTokens = {
    "idleDAIV4": {
      idleTokenAddress: addresses.idleDAIV4,
      aTokenAddress: addresses.aDAIV2.live,
      underlyingTokenAddress: addresses.DAI.live,
      aaveV2WrapperAddress: addresses.idleAaveV2DAI,
    },
    "idleUSDCV4": {
      idleTokenAddress: addresses.idleUSDCV4,
      aTokenAddress: addresses.aUSDCV2.live,
      underlyingTokenAddress: addresses.USDC.live,
      aaveV2WrapperAddress: addresses.idleAaveV2USDC,
    },
    "idleUSDTV4": {
      idleTokenAddress: addresses.idleUSDTV4,
      aTokenAddress: addresses.aUSDTV2.live,
      underlyingTokenAddress: addresses.USDT.live,
      aaveV2WrapperAddress: addresses.idleAaveV2USDT,
    },
    "idleSUSDV4": {
      idleTokenAddress: addresses.idleSUSDV4,
      aTokenAddress: addresses.aSUSDV2.live,
      underlyingTokenAddress: addresses.SUSD.live,
      aaveV2WrapperAddress: addresses.idleAaveV2SUSD,
    },
    "idleTUSDV4": {
      idleTokenAddress: addresses.idleTUSDV4,
      aTokenAddress: addresses.aTUSDV2.live,
      underlyingTokenAddress: addresses.TUSD.live,
      aaveV2WrapperAddress: addresses.idleAaveV2TUSD,
    },
    "idleWBTCV4": {
      idleTokenAddress: addresses.idleWBTCV4,
      aTokenAddress: addresses.aWBTCV2.live,
      underlyingTokenAddress: addresses.WBTC.live,
      aaveV2WrapperAddress: addresses.idleAaveV2WBTC,
    },
    "idleDAISafeV4": {
      idleTokenAddress: addresses.idleDAISafeV4,
      aTokenAddress: addresses.aDAIV2.live,
      underlyingTokenAddress: addresses.DAI.live,
      aaveV2WrapperAddress: addresses.idleAaveV2DAISafe,
    },
    "idleUSDCSafeV4": {
      idleTokenAddress: addresses.idleUSDCSafeV4,
      aTokenAddress: addresses.aUSDCV2.live,
      underlyingTokenAddress: addresses.USDC.live,
      aaveV2WrapperAddress: addresses.idleAaveV2USDCSafe,
    },
    "idleUSDTSafeV4": {
      idleTokenAddress: addresses.idleUSDTSafeV4,
      aTokenAddress: addresses.aUSDTV2.live,
      underlyingTokenAddress: addresses.USDT.live,
      aaveV2WrapperAddress: addresses.idleAaveV2USDTSafe,
    },
  }

  const aaveV2WrapperImplementation = await IdleAaveV2.at(addresses.idleAaveV2Implementation);

  let totalGas = toBN("0");
  for (const name in idleTokens) {
    const attrs = idleTokens[name];
    const idleTokenAddress = attrs.idleTokenAddress;
    const aTokenAddress = attrs.aTokenAddress;
    const underlyingTokenAddress = attrs.underlyingTokenAddress;

    if (attrs.aaveV2WrapperAddress !== undefined) {
      console.log(`skipping already deployed wrapper for ${name}; already deployed at ${attrs.aaveV2WrapperAddress}`);
      console.log("\n************************************\n")
      continue;
    }

    console.log("deploying AaveV2 wrapper for", name);
    console.log("idleTokenAddress", idleTokenAddress)
    console.log("aTokenAddress", aTokenAddress)
    console.log("underlyingTokenAddress", underlyingTokenAddress)

    const initSig = "initialize(address,address,address)";
    const initData = web3.eth.abi.encodeParameters(
      ["address", "address", "address"],
      [aTokenAddress, addresses.aaveAddressesProvider, idleTokenAddress]
    );
    console.log("initSig", initSig);
    console.log("initData", initData);
    const result = await proxyFactory.createAndCall(aaveV2WrapperImplementation.address, initSig, initData);
    const aaveV2Wrapper = await IdleAaveV2.at(result.logs[0].args.proxy);
    attrs.aaveV2WrapperAddress = aaveV2Wrapper.address;
    console.log("AaveV2 wrapper for", name, "deployed at", aaveV2Wrapper.address, "gas used:", result.receipt.gasUsed);
    console.log("\n************************************\n")
    totalGas = totalGas.plus(toBN(result.receipt.gasUsed));
  };

  console.log("const idleTokens =", idleTokens);
  console.log("total gas used", totalGas.toString());
}
