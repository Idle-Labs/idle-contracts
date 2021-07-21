var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
var IERC20 = artifacts.require("./IERC20.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require('./addresses.js');

const BigNumber = require('bignumber.js');
const BN = s => new BigNumber(String(s));


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' ||  network === 'soliditycoverage') {
    return;
  }

  const creator = addresses.creator;
  const decimals = 18;
  const idleTokenAddress = addresses.idleRAIV4;
  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

  if (network === "local") {
    await web3.eth.sendTransaction({ from: accounts[0], to: creator, value: "1000000000000000000"});
  }

  console.log('Network', network);
  console.log('Creator', creator);
  console.log('IdleToken', await idleToken.name(), idleTokenAddress);
  console.log('RAI address: ', addresses.RAI[network]);
  console.log('aRAI address: ', addresses.aRAI[network]);
  console.log('##################');

  const deployAaveV2WrapperProxy = async (proxyFactory, implementationAddress, tokenAddress, addressesProvider, idleTokenAddress, from) => {
    const initSig = "initialize(address,address,address)";
    const initData = web3.eth.abi.encodeParameters(
      ["address", "address", "address"],
      [tokenAddress, addressesProvider, idleTokenAddress]
    );

    const result = await proxyFactory.createAndCall(implementationAddress, initSig, initData, { from: creator });
    const wrapperAddress = result.logs[0].args.proxy;
    return wrapperAddress;
  }

  // #######################

  const proxyFactory = await MinimalInitializableProxyFactory.at(addresses.minimalInitializableProxyFactory);

  // deploy aaveV2 wrapper proxies
  console.log("deploying aaveV2 wrapper via proxy factory");
  const aaveV2WrapperAddress = await deployAaveV2WrapperProxy(proxyFactory, addresses.idleAaveV2Implementation, addresses.aRAI[network],
    addresses.aaveAddressesProvider, idleTokenAddress, creator);
  console.log("aaveV2WrapperAddress", aaveV2WrapperAddress);
};
