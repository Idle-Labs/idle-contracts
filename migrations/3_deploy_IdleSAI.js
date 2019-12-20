var IdleToken = artifacts.require("./IdleToken.sol");
var IdleRebalancer = artifacts.require("./IdleRebalancer.sol");
var IdleRebalancerV2 = artifacts.require("./IdleRebalancerV2.sol");
var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
var IdleCompound = artifacts.require("./IdleCompound.sol");
var IdleCompoundV2 = artifacts.require("./IdleCompoundV2.sol");
var IdleFulcrum = artifacts.require("./IdleFulcrum.sol");
var IdleFactory = artifacts.require("./IdleFactory.sol");

const cSAI = {
  'live': '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  'live-fork': '0xf5dce57282a584d2746faf1593d3121fcac444dc', // needed for truffle

  // Attention: This is the new interest rate model
  'kovan': '0x63c344bf8651222346dd870be254d4347c9359f7',
  'kovan-fork': '0x63c344bf8651222346dd870be254d4347c9359f7', // needed for truffle

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
  console.log('Network', network);
  console.log('cSAI address: ', cSAI[network]);
  console.log('iSAI address: ', iSAI[network]);
  console.log('SAI address: ', SAI[network]);
  console.log('##################');

  await deployer.deploy(IdleFulcrum, iSAI[network], SAI[network]);
  // if is using new interestRateModel
  let isUsingNewRateModel = false;
  if ((network === 'kovan' || network === 'kovan-fork') && cSAI[network] === '0x63c344bf8651222346dd870be254d4347c9359f7') {
    isUsingNewRateModel = true;
    await deployer.deploy(IdleCompoundV2, cSAI[network], SAI[network]);
    await deployer.deploy(IdleRebalancerV2,
      cSAI[network], iSAI[network],
      IdleCompoundV2.address, IdleFulcrum.address
    );
  } else {
    await deployer.deploy(IdleCompound, cSAI[network], SAI[network]);
    await deployer.deploy(IdleRebalancer,
      cSAI[network], iSAI[network],
      IdleCompound.address, IdleFulcrum.address
    );
  }

  const Factory = await IdleFactory.at(IdleFactory.address);
  const IdleSAIAddress = await Factory.newIdleToken.call(
    'IdleSAI',
    'IDLESAI',
    18,
    SAI[network], cSAI[network], iSAI[network],
    isUsingNewRateModel ? IdleRebalancerV2.address : IdleRebalancer.address,
    IdlePriceCalculator.address,
    isUsingNewRateModel ? IdleCompoundV2.address : IdleCompound.address,
    IdleFulcrum.address
  );
  await Factory.newIdleToken(
    'IdleSAI',
    'IDLESAI',
    18,
    SAI[network], cSAI[network], iSAI[network],
    isUsingNewRateModel ? IdleRebalancerV2.address : IdleRebalancer.address,
    IdlePriceCalculator.address,
    isUsingNewRateModel ? IdleCompoundV2.address : IdleCompound.address,
    IdleFulcrum.address
  );
  await Factory.setTokenOwnershipAndPauser(IdleSAIAddress);

  console.log('#### IdleSAIAddress: ', IdleSAIAddress);
  if (isUsingNewRateModel) {
    (await IdleRebalancerV2.at(IdleRebalancerV2.address)).setIdleToken(IdleSAIAddress);
    (await IdleCompoundV2.at(IdleCompoundV2.address)).setIdleToken(IdleSAIAddress);
  } else {
    (await IdleRebalancer.at(IdleRebalancer.address)).setIdleToken(IdleSAIAddress);
    (await IdleCompound.at(IdleCompound.address)).setIdleToken(IdleSAIAddress);
  }
  (await IdleFulcrum.at(IdleFulcrum.address)).setIdleToken(IdleSAIAddress);
};
