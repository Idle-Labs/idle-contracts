var IdleDAI = artifacts.require("./IdleDAI.sol");
var IdleHelp = artifacts.require("./IdleHelp.sol");

const cDAI = {
  'live': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'live-fork': '0xf5dce57282a584d2746faf1593d3121fcac444dc', // needed for truffle
  'test': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'rinkeby': '0x6d7f0754ffeb405d23c51ce938289d4835be3b14',
  'rinkeby-fork': '0x6d7f0754ffeb405d23c51ce938289d4835be3b14', // needed for truffle
  'ropsten': '0xb6b09fbffba6a5c4631e5f7b2e3ee183ac259c0d',
  'ropsten-fork': '0xb6b09fbffba6a5c4631e5f7b2e3ee183ac259c0d', // needed for truffle
  // TODO update addresses
  'kovan': '0xb6b09fbffba6a5c4631e5f7b2e3ee183ac259c0d',
  'kovan-fork': '0xb6b09fbffba6a5c4631e5f7b2e3ee183ac259c0d' // needed for truffle
};

// TODO
const iDAI = {
  'live': '0x14094949152eddbfcd073717200da82fed8dc960',
  'live-fork': '0x14094949152eddbfcd073717200da82fed8dc960', // needed for truffle
  'test': '0x14094949152eddbfcd073717200da82fed8dc960',
  'ropsten': '0x9Aefbe3e4C09FAA4B6BcF03bcCBECbe98A470596',
  'ropsten-fork': '0x9Aefbe3e4C09FAA4B6BcF03bcCBECbe98A470596', // needed for truffle

  // Update other addresses
  'rinkeby': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
  'rinkeby-fork': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e', // needed for truffle
  'kovan': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
  'kovan-fork': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e' // needed for truffle
};

// TODO
const DAI = {
  'live': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
  'live-fork': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359', // needed for truffle
  'test': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
  'rinkeby': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
  'rinkeby-fork': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e', // needed for truffle

  // DAI for fulcrum
  'ropsten': '0xaD6D458402F60fD3Bd25163575031ACDce07538D',
  'ropsten-fork': '0xaD6D458402F60fD3Bd25163575031ACDce07538D', // needed for truffle

  // DAI for compound what should I do?
  // 'ropsten': '0x25a01a05c188dacbcf1d61af55d4a5b4021f7eed',
  // 'ropsten-fork': '0x25a01a05c188dacbcf1d61af55d4a5b4021f7eed', // needed for truffle

  'kovan': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
  'kovan-fork': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e' // needed for truffle
};

module.exports = async function(deployer, network, accounts) {
  console.log('cDAI address: ', cDAI[network]);
  console.log('iDAI address: ', iDAI[network]);
  await deployer.deploy(IdleHelp);
  await deployer.link(IdleHelp, IdleDAI);
  await deployer.deploy(IdleDAI, cDAI[network], iDAI[network], DAI[network]);
};
