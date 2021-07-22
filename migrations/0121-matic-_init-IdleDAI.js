var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IdleCompoundLike = artifacts.require("./IdleCompoundLike.sol");
var IdleFulcrumV2 = artifacts.require("./IdleFulcrumV2.sol");
var IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
var IdleDyDx = artifacts.require("./IdleDyDx.sol");
var IdleDSR = artifacts.require("./IdleDSR.sol");
var yxToken = artifacts.require("./yxToken.sol");
var IdleTokenHelperMatic = artifacts.require("./IdleTokenHelperMatic.sol");
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
  timelock, idleMultisig, proxyAdmin,
  minimalInitializableProxyFactory,
} = require('./addresses.js');


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage') {
    return;
  }

  console.log("account balance: ", await web3.eth.getBalance(creator))
  const chainId = await web3.eth.getChainId();

  const idleTokenAddress = addresses.maticIdleDAIV4;

  console.log('Network', network);
  console.log('idleTokenAddress: ', idleTokenAddress);

  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

  console.log("helper: ", await idleToken.tokenHelper())

  let idleTokenHelper;
  console.log("deploying idle token helper")
  await deployer.deploy(IdleTokenHelperMatic, {from: creator, chainId: chainId}).then(instance => idleTokenHelper = instance);
  console.log("idleTokenHelper deployed at", idleTokenHelper.address);

  console.log("calling idleToken._init", idleTokenHelper.address)
  await idleToken._init(
    idleTokenHelper.address,
    addr0, // set aToken if used
    addr0,
    {from: creator, chainId: chainId}
  );

  console.log('_init called for idleDAI');
};
