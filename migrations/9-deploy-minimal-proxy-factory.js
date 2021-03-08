const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');

const toBN = v => new BigNumber(v.toString());

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const result = await deployer.deploy(MinimalInitializableProxyFactory);
  const proxyFactory = await MinimalInitializableProxyFactory.deployed();
  console.log("MinimalInitializableProxyFactory deployed at", proxyFactory.address);
}
