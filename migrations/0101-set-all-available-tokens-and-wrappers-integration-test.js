const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IdleCompoundV2 = artifacts.require("IdleCompoundV2.sol");
const IERC20 = artifacts.require("IERC20Detailed.sol");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const FlashLoanerMock = artifacts.require("FlashLoanerMock");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');
const IdleTokenHelper = artifacts.require('IdleTokenHelper');

const holder = "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98";
const proxyAdminAddress = '0x7740792812A00510b50022D84e5c4AC390e01417';

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
  if (network === 'test' || network == 'soliditycoverage') {
    return;
  }

  await web3.eth.sendTransaction({ from: holder, to: addresses.timelock, value: "1000000000000000000" });

  const compoundV2Wrapper = await IdleCompoundV2.at('0xe5cb51e2d6682ff6b4d0b37cea7e66227dd15c4e');
  const idleTokenAddress = addresses.idleWBTCV4;

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

  const decimals = await underlyingContract.decimals();
  const toBN = v => new BigNumber(v.toString());
  const toBNString = v => new BigNumber(v.toString()).toString();
  const ONE_18 = toBN("10").pow(toBN(decimals));
  const toUnit = v => v.div(ONE_18);
  const toUnitString = v => toUnit(toBN(v)).toString();
  const fromUnits = u => toBN(u).times(ONE_18);


  const aprs = await idleToken.getAPRs();
  let tokens = aprs["0"].map(v => v.toString());
  let wrappers = [];
  for (var i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const wrapper = await idleToken.protocolWrappers(token);
    wrappers.push(wrapper);
  };

  tokens = [...tokens, addresses.cWBTCV2.live];
  wrappers = [...wrappers, compoundV2Wrapper.address];

  params = [
    tokens,
    wrappers,
    [addresses.COMP.live, addresses.IDLE], // _newGovTokens
    [
      "0x0000000000000000000000000000000000000000", // for cWBTC
      "0x0000000000000000000000000000000000000000", // for aWBTC
      addresses.COMP.live, // for cWBTCV2
      addresses.IDLE] // _newGovTokensEqualLen
  ];

  const user1 = "0x87806fa6481dee55438d90bac808919f35a027e0";
  const user2 = "0x70fbb965302d50d1783a2337cb115b30ae9c4638";
  const user3 = account1;

  await underlyingContract.transfer(user1, fromUnits("100"), { from: addresses.whale });
  await underlyingContract.transfer(user2, fromUnits("200"), { from: addresses.whale });
  await underlyingContract.transfer(user3, fromUnits("100"), { from: addresses.whale });

  await underlyingContract.approve(idleToken.address, fromUnits("1000000"), { from: user2 });
  await underlyingContract.approve(idleToken.address, fromUnits("1000000"), { from: user3 });

  await idleToken.setAllAvailableTokensAndWrappers(...params, { from: addresses.timelock });
  await idleToken.setCToken(addresses.cWBTCV2.live, { from: addresses.timelock })

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

  await underlyingContract.approve(idleToken.address, fromUnits("1000"), { from: user1 });
  await underlyingContract.approve(idleToken.address, fromUnits("1000"), { from: user2 });

  console.log("balance user1", (await underlyingContract.balanceOf(user1)).toString())
  await idleToken.mintIdleToken(fromUnits("100"), true, addresses.addr0, { from: user1 });
  await idleToken.mintIdleToken(fromUnits("100"), true, addresses.addr0, { from: user2 });

  const user1ExpectedGovTokensBefore = toBN(await calculateExpectedGovAmount(user1));
  const user2ExpectedGovTokensBefore = toBN(await calculateExpectedGovAmount(user2));

  const totalSupplyBefore = await idleToken.totalSupply();
  const tokenPriceBefore = await idleToken.tokenPrice();

  await idleToken.redeemIdleTokenSkipGov("0", [true, true], { from: user2 });

  const user1ExpectedGovTokensAfter = toBN(await calculateExpectedGovAmount(user1));
  const user2ExpectedGovTokensAfter = toBN(await calculateExpectedGovAmount(user2));

  check(user2ExpectedGovTokensAfter, toBN("0"));
  checkIncreased(user1ExpectedGovTokensBefore, user1ExpectedGovTokensAfter);

  await idleToken.sellGovTokens([toBN("1"), toBN("1")], { from: addresses.timelock });

  const totalSupplyAfter = await idleToken.totalSupply();
  const tokenPriceAfter = await idleToken.tokenPrice();

  await idleToken.redeemIdleToken(await idleToken.balanceOf(user1), { from: user1 });
  await idleToken.redeemIdleToken(await idleToken.balanceOf(user2), { from: user2 });

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

