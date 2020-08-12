var IdleConverterPersonalSignV4 = artifacts.require("./IdleConverterPersonalSignV4.sol");
const {creator, rebalancerManager, feeAddress, gstAddress} = require('./addresses.js');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network == 'coverage') {
    return;
  }
  console.log(`### Deploying indipendent contract on ${network}`);
  await deployer.deploy(IdleConverterPersonalSignV4, {from: rebalancerManager});
};
