const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');

const toBN = v => new BigNumber(v.toString());

const proxyFactoryAddress = "";
const aaveV2ImplementationAddress = "";

const addressesProvider = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";
// const addressesProviderKovan = "0x88757f2f99175387ab4c6a4b3067c77a695b0349";

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const proxyFactory = await MinimalInitializableProxyFactory.at(proxyFactoryAddress);

  const idleTokens = {
    // "idleDAIV4-KOVAN": {
    //   idleTokenAddress: "0x295CA5bC5153698162dDbcE5dF50E436a58BA21e",
    //   aTokenAddress: "0xdCf0aF9e59C002FA3AA091a46196b37530FD48a8",
    //   underlyingTokenAddress: "0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD",
    // },
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

  const aaveV2WrapperImplementation = await IdleAaveV2.at(aaveV2ImplementationAddress);

  let totalGas = toBN("0");
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
