const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");

const IdleTokenHelper = artifacts.require("IdleTokenHelper");
const VesterFactory = artifacts.require("VesterFactory.sol");
const Vester = artifacts.require("Vester");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const IGovernorAlpha = artifacts.require("IGovernorAlpha");
const Idle = artifacts.require("Idle")
const IERC20 = artifacts.require("IERC20Detailed.sol");
const addresses = require("./addresses");
const {
  createProposal,
  advanceBlocks,
  toBN,
  askToContinue,
  Proposal,
} = require("./utils");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const idleTokens = [
    addresses.idleDAIV4,
    addresses.idleUSDCV4,
    addresses.idleUSDTV4,
    addresses.idleSUSDV4,
    addresses.idleTUSDV4,
    addresses.idleWBTCV4,
    addresses.idleWETHV4,
  ]

  await web3.eth.sendTransaction({ from: addresses.whale, to: addresses.timelock, value: "1000000000000000000" });

  const setAllocationsAndRebalance = async (idleToken, newWrapperAllocation) => {
    const tokens = (await idleToken.getAPRs())["0"];
    console.log("tokens", tokens.join(", "));
    const totalAllocations = 100000;
    const oldWrappersAllocation = Math.floor((totalAllocations - newWrapperAllocation) / (tokens.length - 1));
    const allocations = new Array(tokens.length - 1).fill(oldWrappersAllocation);
    allocations.push(newWrapperAllocation);
    const tot = allocations.reduce((i, tot) => tot + i, 0);
    if (tot < totalAllocations) {
      allocations[0] += totalAllocations - tot;
    }

    const idleTokenDecimals = toBN(await idleToken.decimals());
    const idleTokenName = await idleToken.name();
    const toIdleTokenUnit = v => v.div(toBN("10").pow(idleTokenDecimals));

    console.log("new allocations", allocations)
    console.log("setting allocations for", idleTokenName);
    await idleToken.setAllocations(allocations, { from: addresses.timelock });
    const newAllocations = await idleToken.getAllocations();
    console.log("done setting allocations for", idleTokenName, "-", newAllocations.join(", "));

    console.log("rebalancing");
    await idleToken.rebalance({ from: addresses.timelock });
    console.log("rebalancing done");

    const totalSupply = toIdleTokenUnit(toBN(await idleToken.totalSupply()));
    console.log("total supply", totalSupply.toString());
    for (var i = 0; i < tokens.length; i++) {
      const token = await IERC20.at(tokens[i]);
      const tokenDecimals = toBN(await token.decimals());
      const toTokenUnit = v => v.div(toBN("10").pow(tokenDecimals));
      const name = await token.name();
      const balance = toTokenUnit(toBN(await token.balanceOf(idleToken.address)));
      console.log("token balance", name, tokens[i], balance.toString());
    };
  }

  for (let i = 0; i < idleTokens.length; i++) {
    const idleTokenAddress = idleTokens[i];
    const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

    const user = addresses.mintRedeemTestUser;
    console.log("\n\n********************************* testing", await idleToken.name());

    console.log("--------------- 50000")
    await setAllocationsAndRebalance(idleToken, 50000);
    console.log("--------------- 0")
    await setAllocationsAndRebalance(idleToken, 0);

    // test mint and redeem
    const underlying = await idleToken.token();
    console.log('underlying', underlying);
    const underlyingContract = await IERC20.at(underlying);
    const tokenDecimals = await underlyingContract.decimals();
    console.log('tokenDecimals', tokenDecimals.toString());
    const oneToken = toBN(`1e${tokenDecimals}`);
    const oneIdleToken = toBN(`1e18`);
    const amount = oneToken.times('100');
    await underlyingContract.transfer(user, amount, {from: addresses.whale}); // whale
    console.log('transfer complete');

    await underlyingContract.approve(idleToken.address, toBN(0), {from: user});
    await underlyingContract.approve(idleToken.address, amount, {from: user});
    console.log('##### balance token user pre: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user pre: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
    await idleToken.mintIdleToken(amount, true, addresses.addr0, {from: user});
    console.log('##### balance token user post: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user post: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
    await idleToken.redeemIdleToken(await idleToken.balanceOf(user), {from: user});
    console.log('##### balance token user post 2: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user post 2: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
  }
}
