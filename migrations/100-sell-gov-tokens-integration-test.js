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

module.exports = async function(deployer, network, [account1, account2, deployerAccount]) {
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
  const underlying = await idleToken.token();
  const underlyingContract = await IERC20.at(underlying);

  const tokenHelper = await IdleTokenHelper.new({ from: addresses.timelock });
  await tokenHelper.initialize({ from: deployerAccount });
  await idleToken._init(tokenHelper.address, { from: addresses.timelock });

  const totalSupplyBefore = await idleToken.totalSupply();
  const tokenPriceBefore = await idleToken.tokenPrice();

  // if I skip gov tokens redeem everyone has some more gov tokens

  const comp = await IERC20.at(addresses.COMP.live);

  const calculateExpectedGovAmount = async (user) => {
    const FULL_ALLOC = toBN("100000");
    const usrBal = toBN(await idleToken.balanceOf(user));
    const usrIndex = toBN(await idleToken.usersGovTokensIndexes(addresses.COMP.live, user));
    const delta = toBN(await idleToken.govTokensIndexes(addresses.COMP.live)).minus(usrIndex);
    const share = usrBal.times(delta).dividedBy(ONE_18);
    const contractBal = await comp.balanceOf(addresses.idleDAIV4);
    const fee = toBN(await idleToken.fee());
    const feeDue = share.times(fee).div(FULL_ALLOC);
    const finalAmount = share.minus(feeDue);

    return finalAmount;
  };

  // new user mint X
  // old user mint Y
  // redeem both
  // // add some rebalances

  user1 = "0x87806fa6481dee55438d90bac808919f35a027e0";
  user2 = "0x1a32ee8ac16a7d5f45a81503fe06cdc665d218b1";
  user3 = account1;


  await underlyingContract.transfer(user1, fromUnits("100"), { from: addresses.whale });
  await underlyingContract.transfer(user2, fromUnits("300"), { from: addresses.whale });
  await underlyingContract.transfer(user3, fromUnits("100"), { from: addresses.whale });

  await underlyingContract.approve(idleToken.address, fromUnits("1000000"), { from: user2 });
  await underlyingContract.approve(idleToken.address, fromUnits("1000000"), { from: user3 });

  await idleToken.mintIdleToken(fromUnits("100"), true, addresses.addr0, { from: user2 });
  await idleToken.mintIdleToken(fromUnits("100"), true, addresses.addr0, { from: user3 });

  await idleToken.redeemIdleToken(fromUnits("10"), { from: user2 });
  await idleToken.redeemIdleToken(fromUnits("10"), { from: user3 });

  const user1ExpectedGovTokensBefore = toBN(await calculateExpectedGovAmount(user1));
  const user2ExpectedGovTokensBefore = toBN(await calculateExpectedGovAmount(user2));

  await idleToken.redeemIdleTokenSkipGov("0", [true, true], { from: user2});

  const user1ExpectedGovTokensAfter = toBN(await calculateExpectedGovAmount(user1));
  const user2ExpectedGovTokensAfter = toBN(await calculateExpectedGovAmount(user2));

  check(user2ExpectedGovTokensAfter, toBN("0"));
  checkIncreased(user1ExpectedGovTokensBefore, user1ExpectedGovTokensAfter);

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

  await idleToken.mintIdleToken(fromUnits("100"), true, addresses.addr0, { from: user2 });
  await idleToken.rebalance();
  await idleToken.mintIdleToken(fromUnits("100"), true, addresses.addr0, { from: user2 });
  await idleToken.rebalance();
  await idleToken.redeemIdleToken(fromUnits("10"), { from: user2 });
}

