const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20 = artifacts.require("IERC20.sol");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const FlashLoanerMock = artifacts.require("FlashLoanerMock");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');
const IdleTokenHelper = artifacts.require('IdleTokenHelper');
const ForceSend = artifacts.require('ForceSend');

const toBN = v => new BigNumber(v.toString());
const toBNString = v => new BigNumber(v.toString()).toString();

const check = (a, b, message) => {
  a = a.toString();
  b = b.toString();
  let [icon, symbol] = a.toString() === b ? ["✔️", "==="] : ["🚨🚨🚨", "!=="];
  console.log(`${icon}  `, a, symbol, b, message ? message : "");
}

const checkIncreased = (a, b, message) => {
  let [icon, symbol] = b.gt(a) ? ["✔️", "<"] : ["🚨🚨🚨", ">="];
  console.log(`${icon}  `, a.toString(), symbol, b.toString(), message ? message : "");
}

module.exports = async function(deployer, network, [account1, account2, deployerAccount]) {
  if (network === 'test' || network == 'soliditycoverage') {
    return;
  }

  // ####### SETUP
  const holder = "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98";
  const proxyAdminAddress = '0x7740792812A00510b50022D84e5c4AC390e01417';
  const user1 = "0x87806fa6481dee55438d90bac808919f35a027e0";
  const user2 = "0x1a32ee8ac16a7d5f45a81503fe06cdc665d218b1";
  const user3 = account1;
  const whale = '0x9f51F4df0b275dfB1F74f6Db86219bAe622B36ca';
  const idleTokenAddress = addresses.idleDAIV4;

  const decimals = 18;
  const ONE = toBN("10").pow(toBN(decimals));
  const toUnit = v => v.div(ONE);
  const toUnitString = v => toUnit(toBN(v)).toString();
  const fromUnits = u => toBN(u).times(ONE);

  console.log('Force send to whale contract')
  await deployer.deploy(ForceSend);
  const forceSend = await ForceSend.deployed();
  await forceSend.go(whale, {from: holder, value: '1000000000000000000'});

  console.log('Deplying new idle impl')
  await deployer.deploy(IdleTokenGovernance);
  const newImplementation = await IdleTokenGovernance.deployed();
  console.log("implementation deployed at", newImplementation.address)

  await web3.eth.sendTransaction({ from: holder, to: addresses.timelock, value: "1000000000000000000" });
  const proxyAdmin = await IProxyAdmin.at(proxyAdminAddress);
  await proxyAdmin.upgrade(idleTokenAddress, newImplementation.address, { from: addresses.timelock });

  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
  const underlying = await idleToken.token();
  const underlyingContract = await IERC20.at(underlying);
  const idle = await IERC20.at(addresses.IDLE);
  const comp = await IERC20.at(addresses.COMP.live);

  const tokenHelper = await IdleTokenHelper.new({ from: addresses.timelock });
  await idleToken._init(tokenHelper.address, { from: addresses.timelock });

  // ####### HELPERS
  const calculateExpectedGovAmount = async (user) => {
    const FULL_ALLOC = toBN("100000");
    const fee = toBN("10000");
    const govTokensAmounts = await idleToken.getGovTokensAmounts(user);
    const share = toBN(govTokensAmounts[0]);
    const feeDue = share.times(fee).div(FULL_ALLOC);
    return share.minus(feeDue);
  };
  const calculateExpectedGovAmountIDLE = async (user) => {
    const govTokensAmounts = await idleToken.getGovTokensAmounts(user);
    return toBN(govTokensAmounts[1]);
  };
  const bigLog = (num, txt = '') => console.log(`${txt}${toBN(num).div(ONE).toString()} (${toBN(num).toString()})`);
  const bigLogArr = (arr, arrTxt) => {
    arr.forEach((num, i) => {
      console.log(`${arrTxt[i] || ''}${toBN(num).div(ONE).toString()} (${toBN(num).toString()})`);
    });
  }
  const getUserIdx = usr => {
    switch (usr.toLowerCase()) {
      case user1.toLowerCase():
        return '♠️';
      case user2.toLowerCase():
        return '♥️';
      case user3.toLowerCase():
        return '🃏';
      case whale.toLowerCase():
        return '🐋';
      default:
        throw 'error users'
    }
  }
  const toUnderlyingStr = val => toBN(val).div(ONE).toString();
  const printIdleTokenBal = async usr => {
    let idx = getUserIdx(usr);
    const res = (await Promise.all([
      underlyingContract.balanceOf(usr),
      idleToken.balanceOf(usr),
      comp.balanceOf(usr),
      calculateExpectedGovAmount(usr),
      idle.balanceOf(usr),
      calculateExpectedGovAmountIDLE(usr),
      idleToken.usersGovTokensIndexes(comp.address, usr),
      idleToken.usersGovTokensIndexes(idle.address, usr),
    ])).map(e => toBN(e).toString());
    console.log(`${idx} | ${toUnderlyingStr(res[0])} DAI, ${toUnderlyingStr(res[1])} idleDAI, ${toUnderlyingStr(res[2])} COMP, ${toUnderlyingStr(res[4])} IDLE ### +[${toUnderlyingStr(res[3])} COMP, ${toUnderlyingStr(res[5])} IDLE]`);
  }
  const printContractGov = async () => {
    const res = (await Promise.all([
      comp.balanceOf(idleTokenAddress),
      idle.balanceOf(idleTokenAddress),
      idleToken.govTokensIndexes(comp.address),
      idleToken.govTokensIndexes(idle.address),
      idleToken.govTokensLastBalances(comp.address),
      idleToken.govTokensLastBalances(idle.address),
    ])).map(e => toBN(e).toString());
    console.log(`## CONTRACT | ${toUnderlyingStr(res[0])} COMP, ${toUnderlyingStr(res[1])} IDLE, [${toUnderlyingStr(res[2])} COMP glob, ${toUnderlyingStr(res[3])} IDLE glob] ## [${toUnderlyingStr(res[4])} COMP lastB, ${toUnderlyingStr(res[5])} IDLE lastB]`);
  };
  const mint = async (amount, from, printBal = true, printGov = true) => {
    let idx = getUserIdx(from);
    console.log(`${idx}${idx}${idx}${idx} mint ${amount} DAI`);
    if (printBal) await printIdleTokenBal(from);
    await idleToken.mintIdleToken(fromUnits(amount), true, addresses.addr0, { from });
    if (printBal) await printIdleTokenBal(from);
    if (printGov) await printContractGov();
  };
  const redeem = async (amount, from, printBal = true, printGov = true) => {
    let idx = getUserIdx(from);
    console.log(`${idx}${idx}${idx}${idx} redeem ${amount} idleDAI`);
    if (printBal) await printIdleTokenBal(from);
    await idleToken.redeemIdleToken(
      amount === '-1' ? toBN(await idleToken.balanceOf(from)) : fromUnits(amount),
      { from }
    );
    if (printBal) await printIdleTokenBal(from);
    if (printGov) await printContractGov();
  };
  const logAll = async () => {
    console.log('STATE ##########')
    await printIdleTokenBal(user1);
    await printIdleTokenBal(user2);
    await printIdleTokenBal(user3);
    await printIdleTokenBal(whale);
    await printContractGov();
    console.log('END STATE ######')
  }

  // ####### INITIALIZE
  await underlyingContract.transfer(user1, fromUnits("100"), { from: addresses.whale });
  await underlyingContract.transfer(user2, fromUnits("300"), { from: addresses.whale });
  await underlyingContract.transfer(user3, fromUnits("100"), { from: addresses.whale });

  await underlyingContract.approve(idleToken.address, fromUnits("1000000"), { from: user1 });
  await underlyingContract.approve(idleToken.address, fromUnits("1000000"), { from: user2 });
  await underlyingContract.approve(idleToken.address, fromUnits("1000000"), { from: user3 });

  console.log('Initial state')
  await logAll();

  // ####### TESTS
  // mint with a new user
  await mint('100', user3);
  // mint with a an old user
  await mint('10', user2);

  // redeemIdleTokenSkipGov should increase gov expected balance of other users
  console.log('--------------------------');
  const user1ExpectedGovTokensBeforeSkip = toBN(await calculateExpectedGovAmount(user1));
  const user2ExpectedGovTokensBeforeSkip = toBN(await calculateExpectedGovAmount(user2));
  const user3ExpectedGovTokensBeforeSkip = toBN(await calculateExpectedGovAmount(user3));
  const whaleExpectedGovTokensBeforeSkip = toBN(await calculateExpectedGovAmount(whale));
  await logAll();
  console.log(`User ${getUserIdx(whale)} Redeem skip gov`)
  await idleToken.redeemIdleTokenSkipGov("0", [true, true], { from: whale });
  // +0.2 IDLE for user ♠️ with true, and + 0.00002 with false so it's working correctly at block 12206503
  await logAll();

  const user1ExpectedGovTokensAfterSkip = toBN(await calculateExpectedGovAmount(user1));
  const user2ExpectedGovTokensAfterSkip = toBN(await calculateExpectedGovAmount(user2));
  const user3ExpectedGovTokensAfterSkip = toBN(await calculateExpectedGovAmount(user3));
  const whaleExpectedGovTokensAfterSkip = toBN(await calculateExpectedGovAmount(whale));

  check(whaleExpectedGovTokensAfterSkip, toBN("0"));
  // WARNING:
  // This would be true even with a normal redeem because we accrued something since the last redeem
  // This should be checked by pinning a block, doing a test without the skipGov but waiting a single block
  // to see that the increase is less that when a user forfeits his rewards, it's easier when using a whale wallet
  checkIncreased(user1ExpectedGovTokensBeforeSkip, user1ExpectedGovTokensAfterSkip);
  checkIncreased(user2ExpectedGovTokensBeforeSkip, user2ExpectedGovTokensAfterSkip);
  checkIncreased(user3ExpectedGovTokensBeforeSkip, user3ExpectedGovTokensAfterSkip);

  // redeem everything old user
  console.log('--------------------------');
  const user1GovTokensBalanceBefore = toBN(await comp.balanceOf(user1));
  const user1ExpectedGovTokensBefore = toBN(await calculateExpectedGovAmount(user1));
  await redeem('-1', user1);
  const user1GovTokensBalanceAfter = toBN(await comp.balanceOf(user1));

  await printIdleTokenBal(user2);
  await printIdleTokenBal(user3);
  const user1GovTokensBalanceIDLEBefore = await idle.balanceOf(user1);
  // console.log("before                         ", user1GovTokensBalanceBefore.toString())
  // console.log("expected total                 ", user1GovTokensBalanceBefore.plus(user1ExpectedGovTokensBefore).toString())
  // console.log("after                          ", user1GovTokensBalanceAfter.toString())

  // We need at least user1GovTokensBalanceBefore.plus(user1ExpectedGovTokensBefore), but we will receive something more
  checkIncreased(user1GovTokensBalanceBefore.plus(user1ExpectedGovTokensBefore), user1GovTokensBalanceAfter, "gov tokens redeemed");

  console.log('--------------------------');
  // mint after a full redeem (+ rebalance)
  await mint('100', user1);
  await idleToken.rebalance();

  console.log('--------------------------');
  console.log('end rebalance')
  await mint('100', user2);
  await idleToken.rebalance();
  console.log('end rebalance')

  // redeem gov tokens only
  await redeem('0', user1);

  await printIdleTokenBal(user1);
  await printIdleTokenBal(user3);
}
