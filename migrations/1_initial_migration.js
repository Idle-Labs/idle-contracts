var Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer, network) {
  if (network === 'test' || network == 'coverage') {
    return;
  }
  deployer.deploy(Migrations);
};
