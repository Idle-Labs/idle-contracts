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

  const setAllocationsAndRebalance = async (idleToken, allocations, unlent) => {
    const underlying = await idleToken.token();
    const underlyingContract = await IERC20.at(underlying);
    const tokenDecimals = await underlyingContract.decimals();
    // console.log('tokenDecimals', tokenDecimals.toString());
    const oneToken = toBN(`1e${tokenDecimals}`);
    console.log("total supply", (await idleToken.totalSupply()).toString());

    if (unlent) {
      const amount = oneToken.times(toBN(unlent));
      await underlyingContract.transfer(idleToken.address, amount, {from: addresses.whale}); // whale
      console.log('whale transfer complete');
    }

    console.log('# unlent balance: ', toBN(await underlyingContract.balanceOf(idleToken.address)).div(oneToken).toString());
    const tokens = (await idleToken.getAPRs())["0"];
    // console.log("tokens", tokens.join(", "));
    const idleTokenDecimals = toBN(await idleToken.decimals());
    const idleTokenName = await idleToken.name();
    const toIdleTokenUnit = v => v.div(toBN("10").pow(idleTokenDecimals));
    console.log("curr allocations", allocations.toString());

    allocations = allocations.map(toBN);
    // add 1% to first protocol and remove 1% from last protocol
    allocations = allocations.map((a, i) => {
      if (i == 0 && allocations[allocations.length-1] > 0) return a.plus(toBN('1000'));
      if (i == allocations.length-1 && a > 0) return a.minus(toBN('1000'));
      return a;
    });
    console.log("new allocations", allocations.toString());

    await idleToken.setAllocations(allocations, { from: addresses.timelock });
    const newAllocations = await idleToken.getAllocations();
    console.log("done setting allocations for", idleTokenName, "-", newAllocations.join(", "));
    console.log("rebalancing");
    const tx = await idleToken.rebalance({ from: addresses.timelock });
    console.log("⛽ rebalancing done GAS SPENT: ", tx.receipt.cumulativeGasUsed.toString())

    console.log('# unlent balance: ', toBN(await underlyingContract.balanceOf(idleToken.address)).div(oneToken).toString());
    for (var i = 0; i < tokens.length; i++) {
      const token = await IERC20.at(tokens[i]);
      const tokenDecimals = toBN(await token.decimals());
      const toTokenUnit = v => v.div(toBN("10").pow(tokenDecimals));
      const name = await token.name();
      const balance = toTokenUnit(toBN(await token.balanceOf(idleToken.address)));
      console.log("token balance", name, balance.toString());
      // console.log("token balance", name, tokens[i], balance.toString());
    };
  }

  for (let i = 0; i < idleTokens.length; i++) {
    const idleTokenAddress = idleTokens[i];
    const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
    console.log("\n\n********************************* testing", await idleToken.name());
    console.log('idleToken price pre', (await idleToken.tokenPrice()).toString());
    // await setAllocationsAndRebalance(idleToken, [100000, 0, 0, 0], 0);
    const amount = [addresses.idleWBTCV4, addresses.idleWETHV4].includes(idleTokenAddress) ? 10 : 1000000;
    await setAllocationsAndRebalance(idleToken, await idleToken.getAllocations(), amount);
    console.log('idleToken price after', (await idleToken.tokenPrice()).toString());
  }
}
