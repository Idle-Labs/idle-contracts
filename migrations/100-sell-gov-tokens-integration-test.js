const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20 = artifacts.require("IERC20.sol");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const FlashLoanerMock = artifacts.require("FlashLoanerMock");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');
const IdleTokenHelper = artifacts.require('IdleTokenHelper');

const holder = "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98";
const proxyAdminAddress = '0x7740792812A00510b50022D84e5c4AC390e01417';

const toBN = v => new BigNumber(v.toString());
const toBNString = v => new BigNumber(v.toString()).toString();
const ONE_18 = toBN("10").pow(toBN("18"));
const toUnit = v => v.div(ONE_18);
const toUnitString = v => toUnit(toBN(v)).toString();
const fromUnits = u => toBN(u).times(ONE_18);

const check = (a, b, message) => {
  a = a.toString();
  b = b.toString();
  let [icon, symbol] = a.toString() === b ? ["✔️", "==="] : ["🚨🚨🚨", "!=="];
  console.log(`${icon}  `, a, symbol, b, message ? message : "");
}

const checkIncreased = (a, b, message) => {
  let [icon, symbol] = b.gt(a) ? ["✔️", ">"] : ["🚨🚨🚨", "<="];
  console.log(`${icon}  `, a.toString(), symbol, b.toString(), message ? message : "");
}

module.exports = async function(deployer, network) {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  await web3.eth.sendTransaction({ from: holder, to: addresses.timelock, value: "1000000000000000000" });

  const idleTokenAddress = addresses.idleDAIV4;

  await deployer.deploy(IdleTokenGovernance);
  const newImplementation = await IdleTokenGovernance.deployed();
  console.log("implementation deployed at", newImplementation.address)

  const proxyAdmin = await IProxyAdmin.at(proxyAdminAddress);
  await proxyAdmin.upgrade(idleTokenAddress, newImplementation.address, { from: addresses.timelock });

  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

  const tokenHelper = await IdleTokenHelper.new({ from: addresses.timelock });
  await idleToken._init(tokenHelper.address, { from: addresses.timelock });

  const totalSupplyBefore = await idleToken.totalSupply();
  const tokenPriceBefore = await idleToken.tokenPrice();

  await idleToken.sellGovTokens([toBN("1"), toBN("1")], { from: addresses.timelock });

  const totalSupplyAfter = await idleToken.totalSupply();
  const tokenPriceAfter = await idleToken.tokenPrice();

  console.log("totalSupplyBefore", totalSupplyBefore.toString());
  console.log("tokenPriceBefore ", tokenPriceBefore.toString());
  console.log("totalSupplyAfter ", totalSupplyAfter.toString());
  console.log("tokenPriceAfter  ", tokenPriceAfter.toString());

  // sell gov tokens and everyone get something more
  check(totalSupplyBefore, totalSupplyAfter, "same supply should remain the same");
  checkIncreased(tokenPriceBefore, tokenPriceAfter, "token price should increase");

  // if I skip gov tokens redeem everyone has some more gov tokens
}

