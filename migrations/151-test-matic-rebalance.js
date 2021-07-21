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
  if (network === 'live' || network === 'mainnet' || network === 'test' || network == 'coverage') {
    return;
  }

  const idleTokens = [
    {
      idleTokenAddress: addresses.maticIdleDAIV4,
      whale: "0x8eb6ead701b7d378cf62c898a0a7b72639a89201",
    },
    {
      idleTokenAddress: addresses.maticIdleUSDCV4,
      whale: "0xe566df86b3c91762d9b7098f1c99b06771a2ac15",
    },
    {
      idleTokenAddress: addresses.maticIdleWETHV4,
      whale: "0x082a5a5d287ed0063100c186f0f09cae7baa677c",
    },
  ]

  const timelock = "0x3cD0720CC16E85a8e4Fd3e9D5647E35a4009A75C";

  const chainId = await web3.eth.getChainId();
  await web3.eth.sendTransaction({ from: accounts[0], to: timelock, value: "1000000000000000000", chainId });

  const setAllocationsAndRebalance = async (idleToken, allocations, unlent, whale) => {
    const underlying = await idleToken.token();
    const underlyingContract = await IERC20.at(underlying);
    const tokenDecimals = await underlyingContract.decimals();
    // console.log('tokenDecimals', tokenDecimals.toString());
    const oneToken = toBN(`1e${tokenDecimals}`);
    console.log(`decimals: ${tokenDecimals}`)
    console.log("total supply", (await idleToken.totalSupply()).toString());

    if (unlent) {
      console.log('whale transfer, balance is', (await underlyingContract.balanceOf(whale)).toString());
      const amount = oneToken.times(toBN(unlent));
      console.log(`amount: ${amount}`)
      await underlyingContract.transfer(idleToken.address, amount, { from: whale, chainId });
      console.log('whale transfer complete');
    }

    console.log('# unlent balance: ', toBN(await underlyingContract.balanceOf(idleToken.address)).div(oneToken).toString());
    const tokens = (await idleToken.getAPRs())["0"];
    console.log("tokens", tokens.join(", "));
    const idleTokenDecimals = toBN(await idleToken.decimals());
    const idleTokenName = await idleToken.name();
    const toIdleTokenUnit = v => v.div(toBN("10").pow(idleTokenDecimals));
    console.log("curr allocations", (await idleToken.getAllocations()).map(x => x.toString()));

    allocations = allocations.map(toBN);
    console.log("new allocations", allocations.toString());

    await idleToken.setAllocations(allocations, { from: timelock, chainId });
    const newAllocations = await idleToken.getAllocations();
    console.log("done setting allocations for", idleTokenName, "-", newAllocations.join(", "));
    console.log("rebalancing");
    const tx = await idleToken.rebalance({ from: timelock, chainId });
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
    const idleTokenAddress = idleTokens[i].idleTokenAddress;
    const whale = idleTokens[i].whale;
    console.log("sendTransaction to ", whale);
    await web3.eth.sendTransaction({ from: accounts[0], to: whale, value: "1000000000000000000", chainId });
    console.log("done");

    const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
    console.log("\n\n********************************* testing", await idleToken.name());
    console.log('idleToken price pre', (await idleToken.tokenPrice()).toString());
    const amount = 1000;

    await setAllocationsAndRebalance(idleToken, [50000, 50000], 0);
    console.log('idleToken price after', (await idleToken.tokenPrice()).toString());
    await setAllocationsAndRebalance(idleToken, [100000, 0], 0);
    console.log('idleToken price after', (await idleToken.tokenPrice()).toString());
    await setAllocationsAndRebalance(idleToken, [0, 100000], 0);
    console.log('idleToken price after', (await idleToken.tokenPrice()).toString());
  }
}
