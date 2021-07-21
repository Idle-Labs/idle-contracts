var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IdleCompoundLike = artifacts.require("./IdleCompoundLike.sol");
var IdleFulcrumV2 = artifacts.require("./IdleFulcrumV2.sol");
var IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
var IdleDyDx = artifacts.require("./IdleDyDx.sol");
var IdleDSR = artifacts.require("./IdleDSR.sol");
var yxToken = artifacts.require("./yxToken.sol");
var IdleTokenHelper = artifacts.require("./IdleTokenHelper.sol");
var IERC20 = artifacts.require("./IERC20.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require('./addresses.js');
const BigNumber = require('bignumber.js');
const BNify = s => new BigNumber(String(s));

const {
  creator, rebalancerManager, feeAddress, gstAddress,
  cDAI, iDAI, aDAI, CHAI, DAI, yxDAI, idleDAIV4, idleDAISafeV4,
  cUSDC, iUSDC, aUSDC, USDC, yxUSDC, idleUSDCV4, idleUSDCSafeV4,
  cUSDT, iUSDT, aUSDT, USDT, idleUSDTV4, idleUSDTSafeV4,
  aTUSD, TUSD, idleTUSDV4,
  aSUSD, SUSD, idleSUSDV4,
  cWBTC, iWBTC, aWBTC, WBTC, idleWBTCV4,
  COMP, IDLE, aWETH, WETH, cWETH, RAI, crRAI, fuseRAI, addr0,
  timelock, idleMultisig, proxyAdmin, aaveAddressesProvider,
  minimalInitializableProxyFactory,
} = require('./addresses.js');


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage') {
    return;
  }

  const idleTokenAddress = '0x5C960a3DCC01BE8a0f49c02A8ceBCAcf5D07fABe';

  console.log('Network', network);
  console.log('idleTokenAddress: ', idleTokenAddress);

  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

  let idleTokenHelper;
  console.log("deploying idle token helper")
  await deployer.deploy(IdleTokenHelper, {from: creator}).then(instance => idleTokenHelper = instance);
  console.log("idleTokenHelper:", idleTokenHelper.address);

  console.log("calling idleToken._init")
  await idleToken._init(
    idleTokenHelper.address,
    addresses.addr0,
    {from: creator}
  );

  console.log('_init called for idleRAI');
};
