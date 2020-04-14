var IdleToken = artifacts.require("./IdleToken.sol");
var IdleRebalancer = artifacts.require("./IdleRebalancer.sol");
var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
var IdleCompound = artifacts.require("./IdleCompound.sol");
var IdleFulcrum = artifacts.require("./IdleFulcrum.sol");
var IdleFactory = artifacts.require("./IdleFactory.sol");

const cUSDC = {
  'live': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'live-fork': '0x39AA39c021dfbaE8faC545936693aC917d5E7563', // needed for truffle
  // Attention: This is the new interest rate model
  'kovan': '0xcfc9bb230f00bffdb560fce2428b4e05f3442e35',
  'kovan-fork': '0xcfc9bb230f00bffdb560fce2428b4e05f3442e35', // needed for truffle
  'local': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'local-fork': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'test': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'coverage': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',

  'deploy': '0xcfc9bb230f00bffdb560fce2428b4e05f3442e35', // used for truffle Teams deploy, now kovan
};
const iUSDC = {
  'live': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'live-fork': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f', // needed for truffle
  'kovan': '',
  'kovan-fork': '', // needed for truffle
  'local': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'local-fork': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'test': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'coverage': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',

  'deploy': '', // used for truffle Teams deploy, now kovan
};
const USDC = {
  'live': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'live-fork': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // needed for truffle
  'kovan': '0x75B0622Cec14130172EaE9Cf166B92E5C112FaFF',
  'kovan-fork': '0x75B0622Cec14130172EaE9Cf166B92E5C112FaFF', // needed for truffle
  'local': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'local-fork': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'test': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'coverage': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',

  'deploy': '0x75B0622Cec14130172EaE9Cf166B92E5C112FaFF', // used for truffle Teams deploy, now kovan
};

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'coverage') {
    return;
  }
  console.log('Network', network);
  console.log('cUSDC address: ', cUSDC[network]);
  console.log('iUSDC address: ', iUSDC[network]);
  console.log('USDC address: ', USDC[network]);
  console.log('##################');

  let fulcrumUSDCInstance;
  await deployer.deploy(IdleFulcrum, iUSDC[network], USDC[network]).then(instance => fulcrumUSDCInstance = instance)
  // if is using new interestRateModel
  let compoundUSDCInstance;
  await deployer.deploy(IdleCompound, cUSDC[network], USDC[network]).then(instance => compoundUSDCInstance = instance)

  let rebalancerUSDCInstance;
  await deployer.deploy(IdleRebalancer,
    cUSDC[network], iUSDC[network],
    compoundUSDCInstance.address, fulcrumUSDCInstance.address
  ).then(instance => rebalancerUSDCInstance = instance)

  const Factory = await IdleFactory.at(IdleFactory.address);
  const IdleUSDCAddress = await Factory.newIdleToken.call(
    'IdleUSDC',
    'IDLEUSDC',
    18,
    USDC[network], cUSDC[network], iUSDC[network],
    rebalancerUSDCInstance.address,
    IdlePriceCalculator.address,
    compoundUSDCInstance.address,
    fulcrumUSDCInstance.address
  );
  await Factory.newIdleToken(
    'IdleUSDC',
    'IDLEUSDC',
    18,
    USDC[network], cUSDC[network], iUSDC[network],
    rebalancerUSDCInstance.address,
    IdlePriceCalculator.address,
    compoundUSDCInstance.address,
    fulcrumUSDCInstance.address
  );
  await Factory.setTokenOwnershipAndPauser(IdleUSDCAddress);

  console.log('[USDC] IdleCompound address:', compoundUSDCInstance.address);
  console.log('[USDC] IdleFulcrum  address:', fulcrumUSDCInstance.address);
  console.log('[USDC] IdleRebalancer  address:', rebalancerUSDCInstance.address);
  console.log('#### IdleUSDCAddress: ', IdleUSDCAddress);

  (await IdleRebalancer.at(rebalancerUSDCInstance.address)).setIdleToken(IdleUSDCAddress);
  (await IdleCompound.at(compoundUSDCInstance.address)).setIdleToken(IdleUSDCAddress);
  (await IdleFulcrum.at(fulcrumUSDCInstance.address)).setIdleToken(IdleUSDCAddress);
};
