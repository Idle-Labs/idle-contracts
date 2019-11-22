var IdleToken = artifacts.require("./IdleToken.sol");
var IdleRebalancer = artifacts.require("./IdleRebalancer.sol");
var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
var IdleCompound = artifacts.require("./IdleCompound.sol");
var IdleFulcrum = artifacts.require("./IdleFulcrum.sol");
var IdleFactory = artifacts.require("./IdleFactory.sol");

const cDAI = {
  'live': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'live-fork': '0xf5dce57282a584d2746faf1593d3121fcac444dc', // needed for truffle
  'kovan': '0x3BD3f5b19BCB7f96d42cb6A9dE510ea6f9096355',
  'kovan-fork': '0x3BD3f5b19BCB7f96d42cb6A9dE510ea6f9096355', // needed for truffle
  'local': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'local-fork': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'test': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'coverage': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
};
const iDAI = {
  'live': '0x14094949152eddbfcd073717200da82fed8dc960',
  'live-fork': '0x14094949152eddbfcd073717200da82fed8dc960', // needed for truffle
  'kovan': '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6',
  'kovan-fork': '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6', // needed for truffle
  'local': '0x14094949152eddbfcd073717200da82fed8dc960',
  'local-fork': '0x14094949152eddbfcd073717200da82fed8dc960',
  'test': '0x14094949152eddbfcd073717200da82fed8dc960',
  'coverage': '0x14094949152eddbfcd073717200da82fed8dc960',
};
const DAI = {
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
  const PriceCalculator = await deployer.deploy(IdlePriceCalculator);
  const Factory = await deployer.deploy(IdleFactory);
  const IdleSAIAddress = await Factory.newIdleToken.call(
    'IdleSAI',
    'IDLESAI',
    18,
    DAI[network], cDAI[network], iDAI[network],
    IdleRebalancer.address,
    PriceCalculator.address,
    IdleCompound.address, IdleFulcrum.address
  );
  await Factory.newIdleToken(
    'IdleSAI',
    'IDLESAI',
    18,
    DAI[network], cDAI[network], iDAI[network],
    IdleRebalancer.address,
    PriceCalculator.address,
    IdleCompound.address, IdleFulcrum.address
  );
  await Factory.setTokenOwnershipAndPauser(IdleSAIAddress);
};
