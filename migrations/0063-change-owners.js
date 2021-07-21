const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const addresses = require("./addresses");

const assertEqualAddress = (a, b) => {
  if (a.toLowerCase() !== b.toLowerCase()) {
    throw(`expected address ${a} to be equal to ${b}`);
  }
}

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const currentOwner = addresses.creator;
  const idleTokenAddress = addresses.idleRAIV4;
  const newAdminAddress = undefined;
  if (newAdminAddress === undefined) {
    console.log("set the newAdminAddress variable");
    return;
  }
  const proxyAdminAddress = "0x659d9C49F4c21DDCF9246a7479aDe744fC4D04f8";

  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
  const proxyAdmin = await IProxyAdmin.at(proxyAdminAddress);

  // IDLE TOKEN
  console.log("setting new owner to IdleToken");
  await idleToken.transferOwnership(newAdminAddress, { from: addresses.creator });
  assertEqualAddress(newAdminAddress, await idleToken.owner());

  // PROXY ADMIN
  console.log("setting new admin to ProxyAdmin");
  await proxyAdmin.transferOwnership(newAdminAddress, { from: addresses.creator });
  assertEqualAddress(newAdminAddress, await proxyAdmin.owner());
}
