var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
var IdleConverter = artifacts.require("./IdleConverter.sol");
const {creator, rebalancerManager, feeAddress, gstAddress} = require('./addresses.js');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test') {
    return;
  }
  console.log(`### Deploying indipendent contract on ${network}`);
  await deployer.deploy(IdlePriceCalculator, {from: creator});
  await deployer.deploy(IdleConverter, {from: creator});
};
