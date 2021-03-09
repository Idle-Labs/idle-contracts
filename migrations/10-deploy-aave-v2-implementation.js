const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');

const toBN = v => new BigNumber(v.toString());

module.exports = async (deployer, network, accounts) => {
  console.log("started");
  if (network === 'test' || network == 'coverage') {
    return;
  }

  console.log("deploying...");
  await deployer.deploy(IdleAaveV2);
  const aaveV2WrapperImplementation = await IdleAaveV2.deployed();
  console.log("IdleAaveV2 implementation deployed at", aaveV2WrapperImplementation.address, "\n\n");
}
