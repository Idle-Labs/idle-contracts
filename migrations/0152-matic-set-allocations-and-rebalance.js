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
    },
    {
      idleTokenAddress: addresses.maticIdleUSDCV4,
    },
    {
      idleTokenAddress: addresses.maticIdleWETHV4,
    },
  ]

  const timelock = addresses.creator;
  const chainId = await web3.eth.getChainId();

  for (let i = 0; i < idleTokens.length; i++) {
    const idleTokenAddress = idleTokens[i].idleTokenAddress;
    const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
    console.log("current allocations", (await idleToken.getAllocations()).map(x => x.toString()))

    console.log("setAllocations", await idleToken.name(), idleToken.address);
    const allocations = [toBN("100000"), toBN("0")];
    await idleToken.setAllocations(allocations, { from: timelock, chainId });
    console.log("rebalance", await idleToken.name(), idleToken.address);
    const tx = await idleToken.rebalance({ from: timelock, chainId });

    console.log("new allocations", (await idleToken.getAllocations()).map(x => x.toString()))

    console.log("sleeping...");
    await new Promise((res, rej) => {
      setTimeout(() => {
        console.log("done.");
        res();
      }, 5000);
    });

    console.log("****************\n\n");
  }
}
