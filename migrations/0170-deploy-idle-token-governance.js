const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  await deployer.deploy(IdleTokenGovernance);
  const instance = await IdleTokenGovernance.deployed();
  console.log("IdleTokenGovernance deployed at", instance.address);

  // if (network !== "local") {
  //   return;
  // }

  // console.log("Testing...");

  // console.log("account", accounts[0])
  // console.log("owner", await instance.owner())

  // // set old price oracle
  // await instance.setOracleAddress("0xB5A8f07dD4c3D315869405d702ee8F6EA695E8C5");

  // // _init
  // await instance._init();

  // // it should have set the new oracle v3 address
  // const expectedAddress = "0x758C10272A15f0E9D50Cbc035ff9a046945da0F2".toLowerCase();
  // const address = await instance.oracle();
  // if (address.toLowerCase() == expectedAddress) {
  //   console.log(`✅ oracle updated correctly`);
  // } else {
  //   console.log(`🚨🚨 ERROR!!! wrong oracle address ${address}`);
  // }
}
