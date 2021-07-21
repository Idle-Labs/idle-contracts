var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IProxyAdmin = artifacts.require("./IProxyAdmin.sol");
var IAdminUpgradeabilityProxy = artifacts.require("./IAdminUpgradeabilityProxy.sol");
const BigNumber = require('bignumber.js');
const BNify = s => new BigNumber(String(s));

const addresses = require('./addresses.js');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test') {
    return;
  }

  // Params
  const idleTokenAddress = addresses.idleRAIV4;
  const proxyAdmin = '0x659d9C49F4c21DDCF9246a7479aDe744fC4D04f8';
  const currentOwner = addresses.creator;
  const governanceProxyAdminAddress = addresses.proxyAdmin;
  const newOwner = addresses.timelock; // Idle governance

  if (!idleTokenAddress || !newOwner || !governanceProxyAdminAddress) {
    return console.log('Set addresses');
  }

  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
  const upgradabilityProxy = await IAdminUpgradeabilityProxy.at(idleTokenAddress);
  const proxyAdminInstance = await IProxyAdmin.at(proxyAdmin);

  // check that current admin for the idleToken proxy (IAdminUpgradeabilityProxy contract) is indeed proxyAdmin
  // NOTE: will revert if it's not the correct owner
  console.log('proxyAdmin', proxyAdmin);
  console.log(`current admin (should be ${proxyAdmin})`, await upgradabilityProxy.admin.call({from: proxyAdmin}));
  console.log(`curr proxy admin owner (should be ${currentOwner})`, await proxyAdminInstance.owner.call());
  console.log(`curr owner (should be ${currentOwner})`, await idleToken.owner());

  // Change proxyAdmin so to have the same one for all tokens
  await proxyAdminInstance.changeProxyAdmin(idleToken.address, governanceProxyAdminAddress, {from: currentOwner});
  console.log('proxyAdmin for idleToken changed to governanceProxyAdminAddress (and its admin is the Timelock)');
  await idleToken.transferOwnership(newOwner, {from: currentOwner});
  console.log('owner for idleToken changed to Timelock');

  // check that is indeed timelock the owner of the contract and the admin of
  // the IAdminUpgradeabilityProxy
  console.log(`new admin (should be ${governanceProxyAdminAddress})`, await upgradabilityProxy.admin.call({from: governanceProxyAdminAddress}));
  const proxyAdminAll = await IProxyAdmin.at(governanceProxyAdminAddress);
  console.log(`proxyAdmin impl should be ${addresses.lastIdleTokenImplementation}`, await proxyAdminAll.getProxyImplementation.call(idleTokenAddress));
  console.log(`proxyAdmin should be ${governanceProxyAdminAddress}`, await proxyAdminAll.getProxyAdmin.call(idleTokenAddress));
  console.log(`proxy admin owner (should be Timelock ${newOwner})`, await proxyAdminAll.owner.call());
  console.log(`new owner (should be Timelock ${newOwner})`, await idleToken.owner());
};
