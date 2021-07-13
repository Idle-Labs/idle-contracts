const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');

const toBN = v => new BigNumber(v.toString());

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'soliditycoverage') {
    return;
  }

  const chainId = await web3.eth.getChainId();
  console.log(`chainId: ${chainId}`);

  const result = await deployer.deploy(MinimalInitializableProxyFactory, { from: addresses.creator, chainId: chainId });
  const proxyFactory = await MinimalInitializableProxyFactory.deployed();
  console.log("MinimalInitializableProxyFactory deployed at", proxyFactory.address);
}
