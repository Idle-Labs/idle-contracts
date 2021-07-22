const IdleTokenHelper = artifacts.require("IdleTokenHelper");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  await deployer.deploy(IdleTokenHelper);
  const instance = await IdleTokenHelper.deployed();
  console.log("IdleTokenHelper deployed at", instance.address);
}
