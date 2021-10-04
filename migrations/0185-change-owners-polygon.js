const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const IOwnable = artifacts.require("IOwnable");
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

  const currentOwner = '0x3cD0720CC16E85a8e4Fd3e9D5647E35a4009A75C';

  const proxyAdminAddress = "0xCF8977156cc60a5c9bF32d44C143A60CDe6341c3";
  const oracleV2Address = "0x27F06D00d73Ec426193473726BB0671267Fd27F0";
  const idleTokenAddresses = [
    addresses.maticIdleDAIV4,
    addresses.maticIdleUSDCV4,
    addresses.maticIdleWETHV4,
  ];
  const newAdminAddress = "0xE5Dab8208c1F4cce15883348B72086dBace3e64B";

  if (newAdminAddress === undefined) {
    console.log("set the newAdminAddress variable");
    return;
  }

  // IDLE TOKENS
  for (var i = 0; i < idleTokenAddresses.length; i++) {
    const idleToken = await IdleTokenGovernance.at(idleTokenAddresses[i]);
    console.log("setting new owner to IdleToken ", idleTokenAddresses[i]);
    await idleToken.transferOwnership(newAdminAddress, { from: currentOwner });
    assertEqualAddress(newAdminAddress, await idleToken.owner());
  }

  // PROXY ADMIN
  const proxyAdmin = await IProxyAdmin.at(proxyAdminAddress);
  console.log("setting new admin to ProxyAdmin");
  await proxyAdmin.transferOwnership(newAdminAddress, { from: currentOwner });
  assertEqualAddress(newAdminAddress, await proxyAdmin.owner());

  // ORACLE
  const oracle = await IOwnable.at(oracleV2Address);
  console.log("setting new admin to Oracle");
  await oracle.transferOwnership(newAdminAddress, { from: currentOwner });
  assertEqualAddress(newAdminAddress, await oracle.owner());
}
