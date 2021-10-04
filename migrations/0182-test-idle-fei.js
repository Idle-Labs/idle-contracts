var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var ILendingProtocol = artifacts.require("./ILendingProtocol.sol");
var IdleTokenHelper = artifacts.require("./IdleTokenHelper.sol");
var IERC20 = artifacts.require("./IERC20Detailed.sol");

const addresses = require('./addresses');
const BigNumber = require('bignumber.js');
const {
  toBN,
  tokenUtils,
} = require("./utils");


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage') {
    return;
  }

  const [account1, account2] = accounts;
  const idleTokenAddress = addresses.idleFEIV4;
  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
  const fei = await IERC20.at(await idleToken.token());
  const feiUtils = tokenUtils(await fei.decimals());
  const pb = feiUtils.pb;
  const whale = "0x9544a83a8cb74062c836aa11565d4bb4a54fe40d";
  const owner = addresses.creator;

  const balance = x => {
    return `${pb(x)} - (${x.toString()})`;
  }

  console.log('Network', network);
  console.log("Idle Token", await idleToken.name());
  console.log("Underlying token", await fei.name());
  console.log("Whale balance", pb(await fei.balanceOf(whale)));

  const mint = async (account, amountUnits) => {
    const amount = feiUtils.fromUnits(amountUnits);
    console.log(`minting ${pb(amount)} from ${account}`);
    await fei.transfer(account, amount, { from: whale });
    await fei.approve(idleToken.address, amount, { from: account });
    await idleToken.mintIdleToken(amount, true, addresses.addr0, { from: account });
  };

  const redeem = async (account, amountUnits) => {
    const amount = feiUtils.fromUnits(amountUnits);
    console.log(`redeeming ${pb(amount)} from ${account}`);
    await idleToken.redeemIdleToken(amount, { from: account });
  };

  const setAllocationsAndRebalance = async (allocations) => {
    console.log(`Setting allocations ${allocations}`);
    await idleToken.setAllocations(allocations, { from: owner });
    console.log("rebalancing...");
    await idleToken.rebalance({ from: owner });
  }

  const log = async () => {
    console.log("\n******************************************************************\n");

    console.log("Account1 IdleToken balance:", balance(await idleToken.balanceOf(account1)));
    console.log("Account1 FEI balance:", balance(await fei.balanceOf(account1)));
    console.log("Account2 IdleToken balance:", balance(await idleToken.balanceOf(account2)));
    console.log("Account2 FEI balance:", balance(await fei.balanceOf(account2)));
    console.log("IdleToken total supply:", balance(await idleToken.totalSupply()));

    const protocolTokens = (await idleToken.getAPRs())["0"];
    console.log(`Contract FEI balance:`, balance(await fei.balanceOf(idleToken.address)));
    for (var i = 0; i < protocolTokens.length; i++) {
      const token = await IERC20.at(protocolTokens[i]);
      const wrapper = await ILendingProtocol.at(await idleToken.protocolWrappers(token.address));
      const tokenName = await token.name();
      console.log(`Contract ${tokenName} price:`, balance(await wrapper.getPriceInToken()));
      console.log(`Contract ${tokenName} balance:`, balance(await token.balanceOf(idleToken.address)));
    };
    console.log("\n******************************************************************\n");
  };


  await log();

  await setAllocationsAndRebalance([toBN("0"), toBN("0"), toBN("100000")]);
  await mint(account1, "100");
  await mint(account2, "100");
  await log();

  await setAllocationsAndRebalance([toBN("50000"), toBN("50000"), toBN("0")]);
  await mint(account1, "100");
  await mint(account2, "100");
  await log();

  await setAllocationsAndRebalance([toBN("0"), toBN("0"), toBN("100000")]);
  await redeem(account1, "90");
  await redeem(account2, "90");
  await log();

  await setAllocationsAndRebalance([toBN("50000"), toBN("50000"), toBN("0")]);
  await redeem(account1, "90");
  await redeem(account2, "90");
  await log();
};
