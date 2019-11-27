const BigNumber = require('bignumber.js');

var IdleToken = artifacts.require("./IdleToken.sol");
var IdleRebalancer = artifacts.require("./IdleRebalancer.sol");
var IdlePriceCalculator = artifacts.require("./IdlePriceCalculator.sol");
var IdleCompound = artifacts.require("./IdleCompound.sol");
var IdleFulcrum = artifacts.require("./IdleFulcrum.sol");
var IdleFactory = artifacts.require("./IdleFactory.sol");
var IERC20 = artifacts.require("./IERC20Mintable.sol");
var CERC20 = artifacts.require("./CERC20.sol");
var iERC20Fulcrum = artifacts.require("./iERC20Fulcrum.sol");
var ForceSend = artifacts.require("./ForceSend.sol");

const BNify = s => new BigNumber(String(s));

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
  if (network !== 'local') {
    return console.log('4_test_ganache_idle.js not used in this network');
  }
  console.log('Creating IdleSAI contract');
  console.log('DAI[network]', DAI[network]);
  console.log('cDAI[network]', cDAI[network]);
  console.log('iDAI[network]', iDAI[network]);
  console.log('IdleRebalancer', IdleRebalancer.address);
  console.log('IdlePriceCalculator', IdlePriceCalculator.address);
  console.log('IdleCompound', IdleCompound.address);
  console.log('IdleFulcrum', IdleFulcrum.address);
  console.log('Owner', accounts[0]);
  console.log('Other minter', accounts[1]);

  const one = BNify('1000000000000000000');
  const oneCToken = BNify('100000000');
  const SAIAddr = DAI[network];
  const iSAIAddr = iDAI[network];
  const cSAIAddr = cDAI[network];

  const SAI = await IERC20.at(SAIAddr);
  const iSAI = await iERC20Fulcrum.at(iSAIAddr);
  const cSAI = await CERC20.at(cSAIAddr);
  const iSAIERC20 = await IERC20.at(iSAIAddr);
  const cSAIERC20 = await IERC20.at(cSAIAddr);

  const idleFactoryInstance = await IdleFactory.at(IdleFactory.address);
  const idleSAIAddr = await idleFactoryInstance.getIdleTokenAddress.call(SAIAddr);
  const IdleSAI = await IdleToken.at(idleSAIAddr);

  const toMint = BNify('1000000').times(one); // 1M SAI

  // give SAI to accounts[0]
  await SAI.mint(accounts[0], toMint, { from: SAIAddr });

  console.log('IdleSAI.address', IdleSAI.address);
  console.log('##################################');
  // Approve IdleSAI as accounts[0] SAI spender
  await SAI.approve(IdleSAI.address, BNify('-1'), { from: accounts[0] });

  const tokenPrice = await IdleSAI.tokenPrice.call();
  console.log('IdleSAI current tokenPrice', BNify(tokenPrice).div(one).toString());

  // Actual test of IdleSAI mint with `toMint` amount
  const txMint = await IdleSAI.mintIdleToken(toMint, []);
  const logContractDatas = async (type, tx, account) => {
    console.log(`@@@@@@@@@@ [${account}] START LOG FOR: -------------------- ${type} --------------------`);

    const IdleSAIBalanceMinter = BNify(await IdleSAI.balanceOf.call(accounts[0]));
    console.log('IdleSAIBalance of accounts[0]', IdleSAIBalanceMinter.div(one).toString());

    const IdleSAISupply = BNify(await IdleSAI.totalSupply.call());
    console.log('IdleSAI totalSupply', IdleSAISupply.div(one).toString());

    const tokenPriceAfter = BNify(await IdleSAI.tokenPrice.call());
    console.log('IdleSAI tokenPrice after mint', tokenPriceAfter.div(one).toString());

    console.log('cSAI #####################');
    const cSAIBalanceIdleSAI = BNify(await cSAIERC20.balanceOf.call(idleSAIAddr));
    console.log('cSAIBalance of IdleSAI', cSAIBalanceIdleSAI.div(oneCToken).toString());
    const cSAIPrice = BNify(await cSAI.exchangeRateStored.call());
    const cSAIPoolValue = cSAIBalanceIdleSAI.times(cSAIPrice.div(one));
    console.log('cSAI pool VALUE: ', cSAIPoolValue.div(one).toString());

    console.log('iSAI #####################');
    const iSAIBalanceIdleSAI = BNify(await iSAIERC20.balanceOf.call(idleSAIAddr));
    console.log('iSAIBalance of IdleSAI', iSAIBalanceIdleSAI.div(one).toString());
    const iSAIPrice = BNify(await iSAI.tokenPrice.call());
    const iSAIPoolValue = iSAIBalanceIdleSAI.times(iSAIPrice.div(one));
    console.log('iSAI pool VALUE: ', iSAIPoolValue.div(one).toString());
    console.log('##########################');

    const totPoolValue = cSAIPoolValue.plus(iSAIPoolValue);
    console.log('IdleSAI pool value: ', totPoolValue.div(one).toString());
    const idealTokenPrice = totPoolValue.div(IdleSAISupply);
    console.log('IdleSAI ideal price: ', idealTokenPrice.toString());
    console.log(`@@@@@@@@@@ [${account}] END LOG FOR: -------------------- ${type} --------------------`);
    return IdleSAIBalanceMinter;
  }

  const IdleSAIBalanceMinter = await logContractDatas('MINT', txMint, 'Owner');

  // we are redeeming half
  const txRedeem = await IdleSAI.redeemIdleToken(BNify(IdleSAIBalanceMinter).div(BNify('2')), false, [], { from: accounts[0]});

  await logContractDatas('REDEEM', txRedeem, 'Owner');
};
