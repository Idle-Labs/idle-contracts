const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20 = artifacts.require("IERC20");
const IdleTokenHelper = artifacts.require("IdleTokenHelper");
const VesterFactory = artifacts.require("VesterFactory.sol");
const Vester = artifacts.require("Vester");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const IGovernorAlpha = artifacts.require("IGovernorAlpha");
const Idle = artifacts.require("Idle")
const addresses = require("./addresses");
const {
  createProposal,
  advanceBlocks,
  toBN,
  askToContinue,
  Proposal,
  check,
  checkIncreased,
} = require("./utils");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  // TODO update addresses
  let idleTokenImplementationAddress = '0xd7fc6d0fb425e450d08220fed5cfa0ec1ddbaf2b';
  const idleTokenHelperAddress = addresses.idleTokenHelper;

  const idleTokenHelper = await IdleTokenHelper.at(idleTokenHelperAddress);
  const idleTokenImplementation = await IdleTokenGovernance.at(idleTokenImplementationAddress);

  console.log("idle token helper deployed at", idleTokenHelperAddress);
  console.log("implementation deployed at", idleTokenImplementationAddress)

  const allIdleTokens = [
    {
      idleTokenAddress: addresses.idleDAIV4,
      aTokenAddress: addresses.aDAIV2[network],
    },
    {
      idleTokenAddress: addresses.idleUSDCV4,
      aTokenAddress: addresses.aUSDCV2[network],
    },
    {
      idleTokenAddress: addresses.idleUSDTV4,
      aTokenAddress: addresses.aUSDTV2[network],
    },
    {
      idleTokenAddress: addresses.idleSUSDV4,
      aTokenAddress: addresses.addr0,
    },
    {
      idleTokenAddress: addresses.idleTUSDV4,
      aTokenAddress: addresses.addr0,
    },
    {
      idleTokenAddress: addresses.idleWBTCV4,
      aTokenAddress: addresses.aWBTCV2[network],
    },
    {
      idleTokenAddress: addresses.idleWETHV4,
      aTokenAddress: addresses.aWETH[network],
    },
  ]

  const description = '#Update IdleToken implementation to update gov tokens management';
  const proposal = new Proposal(web3, description, addresses.forkProposer);

  // call upgradeAndCall on proxyAdmin
  allIdleTokens.forEach(({idleTokenAddress, aTokenAddress}) => {
    const initMethodToCall = web3.eth.abi.encodeFunctionCall({
      name: "_init(address,address)",
      type: "function",
      inputs: [
        { type: "address", name: "_tokenHelper" },
        { type: "address", name: "_aToken" },
      ]
    }, [idleTokenHelperAddress, aTokenAddress]);

    console.log("_init params:")
    console.log("idleTokenAddress:", idleTokenAddress)
    console.log("aTokenAddress:", aTokenAddress, "\n\n")

    proposal.addAction({
      target: addresses.proxyAdmin,
      value: toBN("0"),
      signature: "upgradeAndCall(address,address,bytes)",
      calldataParams: ["address", "address", "bytes"],
      calldataValues: [idleTokenAddress, idleTokenImplementationAddress, initMethodToCall]
    });
  });

  // call setCToken in idleWBTCV4
  proposal.addAction({
    target: addresses.idleWBTCV4,
    value: toBN("0"),
    signature: "setCToken(address)",
    calldataParams: ["address"],
    calldataValues: [addresses.cWBTCV2[network]],
  });

  // setAllAvailableTokensAndWrappers
  proposal.addAction({
    target: addresses.idleWBTCV4,
    value: toBN("0"),
    signature: "setAllAvailableTokensAndWrappers(address[],address[],address[],address[])",
    calldataParams: ["address[]", "address[]", "address[]", "address[]"],
    calldataValues: [
      // protocolTokens
      [
        addresses.cWBTCV2[network],
        addresses.aWBTC[network],
        addresses.aWBTCV2[network]
      ],
      // wrappers
      [
        "0xe5cb51e2d6682ff6b4d0b37cea7e66227dd15c4e", // cWBTC
        "0xA91cF5B36A691bDA39640156B081CB71C3e9992E", // aWBTC v1
        "0x69435730D6Af2249265C4fF578D89Ec4c827C475", // aWBTC v2

      ],
      // _newGovTokens
      [
        addresses.COMP[network],
        addresses.stkAAVE[network],
        addresses.IDLE,
      ],
      // _newGovTokensEqualLen
      [
        addresses.COMP[network], // for cWBTCV2
        "0x0000000000000000000000000000000000000000", // for aWBTC
        addresses.stkAAVE[network], // for aWBTCV2
        addresses.IDLE,
      ]
    ],
  });

  await askToContinue("continue?");
  if (network === "local") {
    await testCompGovTokens(network, accounts[0], check, "before the proposal, user's COMP balance should stay at 0");
  }

  if (network === "live") {
    await askToContinue("continue?");
  }

  await createProposal(network, proposal.toObject());

  if (network === "local") {
    await testCompGovTokens(network, accounts[1], checkIncreased, "after the proposal, user's COMP balance should increase");
  }
}

const testCompGovTokens = async (network, user, checkFunc, testMessage) => {
  await web3.eth.sendTransaction({ from: addresses.whale, to: addresses.timelock, value: "1000000000000000000" });
  const amount = toBN("1");
  const idleToken = await IdleTokenGovernance.at(addresses.idleWBTCV4);
  await idleToken.setAllocations([toBN("20000"), toBN("20000"), toBN("60000")], { from: addresses.timelock });

  const comp = await IERC20.at(addresses.COMP[network]);
  const wbtc = await IdleTokenGovernance.at(addresses.WBTC[network]);

  // whale sends amount to user
  await wbtc.transfer(user, amount, { from: addresses.whale });

  await idleToken.rebalance({ from: addresses.whale })

  const govTokensBalanceBefore = toBN(await comp.balanceOf(user));

  await wbtc.approve(idleToken.address, amount, {from: user});
  await idleToken.mintIdleToken(amount, true, addresses.addr0, {from: user});
  await advanceBlocks(10);
  await idleToken.redeemIdleToken(await idleToken.balanceOf(user), {from: user});

  const govTokensBalanceAfter = toBN(await comp.balanceOf(user));

  checkFunc(govTokensBalanceBefore, govTokensBalanceAfter, testMessage);
}
