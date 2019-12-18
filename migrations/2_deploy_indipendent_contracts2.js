var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
var IdleFactory = artifacts.require("./IdleFactory.sol");

module.exports = async function(deployer, network, accounts) {
  console.log(`### Deploying indipendent contract on ${network}`);

  await deployer.deploy(IdlePriceCalculator);
  await deployer.deploy(IdleFactory);
};
