var IdleToken = artifacts.require("./IdleToken.sol");
var IdleRebalancer = artifacts.require("./IdleRebalancer.sol");
var IdleCompound = artifacts.require("./IdleCompound.sol");
var IdleFulcrum = artifacts.require("./IdleFulcrum.sol");
var IdleFactory = artifacts.require("./IdleFactory.sol");

const cDAI = {
  'live': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'live-fork': '0xf5dce57282a584d2746faf1593d3121fcac444dc', // needed for truffle
  'test': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
};

const iDAI = {
  'live': '0x14094949152eddbfcd073717200da82fed8dc960',
  'live-fork': '0x14094949152eddbfcd073717200da82fed8dc960', // needed for truffle
  'test': '0x14094949152eddbfcd073717200da82fed8dc960',
};

const DAI = {
  'live': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
  'live-fork': '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359', // needed for truffle
  'test': '0xd6801a1DfFCd0a410336Ef88DeF4320D6DF1883e',
};

module.exports = async function(deployer, network, accounts) {
  console.log('Network', network);
  console.log('cDAI address: ', cDAI[network]);
  console.log('iDAI address: ', iDAI[network]);
  console.log('DAI address: ', DAI[network]);
  console.log('##################');
  await deployer.deploy(IdleCompound, cDAI[network], DAI[network]);
  await deployer.deploy(IdleFulcrum, iDAI[network], DAI[network]);
  await deployer.deploy(IdleRebalancer,
    cDAI[network], iDAI[network],
    IdleCompound.address, IdleFulcrum.address
  );
  const Factory = await deployer.deploy(IdleFactory);
  await Factory.newIdleToken(
    'IdleDAI',
    'IDLEDAI',
    18,
    DAI[network], cDAI[network], iDAI[network],
    IdleRebalancer.address,
    IdleCompound.address, IdleFulcrum.address
  );
};
