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

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage') {
    return;
  }

  network = "matic";

  console.log("account balance: ", await web3.eth.getBalance(addresses.creator))
  const chainId = await web3.eth.getChainId();

  const idleTokenAddress = addresses.maticIdleWETHV4;

  console.log('Network', network);
  console.log('idleTokenAddress: ', idleTokenAddress);

  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
  console.log("helper: ", await idleToken.tokenHelper())

  console.log("calling idleToken._init", addresses.idleTokenHelper[network])
  await idleToken._init(
    addresses.idleTokenHelper[network],
    addresses.addr0, // set aToken if used
    addresses.addr0,
    { from: addresses.creator, chainId }
  );

  console.log('_init called for idleWETH');
};
