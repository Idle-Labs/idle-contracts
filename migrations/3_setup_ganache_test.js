const BigNumber = require('bignumber.js');

var IdleToken = artifacts.require("./IdleToken.sol");
var IdleRebalancer = artifacts.require("./IdleRebalancer.sol");
var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
var IdleCompound = artifacts.require("./IdleCompound.sol");
var IdleFulcrum = artifacts.require("./IdleFulcrum.sol");
var IdleFactory = artifacts.require("./IdleFactory.sol");
var IERC20 = artifacts.require("./IERC20Mintable.sol");
var ForceSend = artifacts.require("./ForceSend.sol");

const BNify = s => new BigNumber(String(s));

const cSAI = {
  'live': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'live-fork': '0xf5dce57282a584d2746faf1593d3121fcac444dc', // needed for truffle
  'kovan': '0x3BD3f5b19BCB7f96d42cb6A9dE510ea6f9096355',
  'kovan-fork': '0x3BD3f5b19BCB7f96d42cb6A9dE510ea6f9096355', // needed for truffle
  'local': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'local-fork': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'test': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'coverage': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
};
const iSAI = {
  'live': '0x14094949152eddbfcd073717200da82fed8dc960',
  'live-fork': '0x14094949152eddbfcd073717200da82fed8dc960', // needed for truffle
  'kovan': '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6',
  'kovan-fork': '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6', // needed for truffle
  'local': '0x14094949152eddbfcd073717200da82fed8dc960',
  'local-fork': '0x14094949152eddbfcd073717200da82fed8dc960',
  'test': '0x14094949152eddbfcd073717200da82fed8dc960',
  'coverage': '0x14094949152eddbfcd073717200da82fed8dc960',
};
const SAI = {
  'live': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
  'live-fork': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359', // needed for truffle
  'kovan': '0xC4375B7De8af5a38a93548eb8453a498222C4fF2',
  'kovan-fork': '0xC4375B7De8af5a38a93548eb8453a498222C4fF2', // needed for truffle
  'local': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
  'local-fork': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
  'test': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
  'coverage': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
};

module.exports = async function(deployer, network, accounts) {
  if (network !== 'local') {
    return console.log('3_setup_ganache_test.js not used in this network');
  }
  console.log('Migration used to setup SAI ETH balance for accounts[0] in order to interct with Idle');
  console.log('##################################');

  const one = BNify('1000000000000000000');
  const SAIAddr = SAI[network];
  const SAI = await IERC20.at(SAIAddr);
  const idleFactoryInstance = await IdleFactory.at(IdleFactory.address);
  const idleAddr = await idleFactoryInstance.getIdleTokenAddress.call(SAIAddr);
  const IdleSAI = await IdleToken.at(idleAddr);

  console.log('IdleSAI.address', IdleSAI.address);
  console.log('##################################');
  console.log('##################################');

  // We have to mint some SAI for our accounts see
  // so we send 1 eth to SAI.address to have gas to mint.
  // https://medium.com/ethereum-grid/forking-ethereum-mainnet-mint-your-own-dai-d8b62a82b3f7
  const forceSend = await ForceSend.new();
  await forceSend.go(SAIAddr, { value: one });
  const ethBalance = await web3.eth.getBalance(SAIAddr);
  console.log('SAI eth balance (should be 1 ether)', ethBalance);
};
