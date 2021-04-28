const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20 = artifacts.require("IERC20");
const IERC20Detailed = artifacts.require("IERC20Detailed");
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

  const newOracle = addresses.priceOracleV2;
  // TODO update addresses
  // let idleTokenImplementationAddress = '0xd7fc6d0fb425e450d08220fed5cfa0ec1ddbaf2b';
  // const idleTokenImplementation = await IdleTokenGovernance.at(idleTokenImplementationAddress);
  await deployer.deploy(IdleTokenGovernance);
  const idleTokenImplementation = await IdleTokenGovernance.deployed();
  const idleTokenImplementationAddress = idleTokenImplementation.address;

  const idleTokenHelperAddress = addresses.idleTokenHelper;
  const idleTokenHelper = await IdleTokenHelper.at(idleTokenHelperAddress);

  console.log("idle token helper deployed at", idleTokenHelperAddress);
  console.log("implementation deployed at", idleTokenImplementationAddress)

  const allIdleTokens = [
    {
      idleTokenAddress: addresses.idleDAIV4,
      aTokenAddress: addresses.aDAIV2[network],
      protocolTokens: [
        addresses.cDAI[network],
        addresses.aDAI[network],
        addresses.yxDAI[network],
        addresses.aDAIV2[network],
      ],
      newGovTokens: [
        addresses.COMP[network],
        addresses.stkAAVE[network],
        addresses.IDLE,
      ],
      newGovTokensEqualLen: [
        addresses.COMP[network], // for cDAI
        "0x0000000000000000000000000000000000000000", // for aDAI
        "0x0000000000000000000000000000000000000000", // for yxDAI
        addresses.stkAAVE[network], // for aDAIV2
        addresses.IDLE,
      ]
    },
    {
      idleTokenAddress: addresses.idleUSDCV4,
      aTokenAddress: addresses.aUSDCV2[network],
      protocolTokens: [
        addresses.cUSDC[network],
        addresses.aUSDC[network],
        addresses.yxUSDC[network],
        addresses.aUSDCV2[network],
      ],
      newGovTokens: [
        addresses.COMP[network],
        addresses.stkAAVE[network],
        addresses.IDLE,
      ],
      newGovTokensEqualLen: [
        addresses.COMP[network], // for cUSDC
        "0x0000000000000000000000000000000000000000", // for aUSDC
        "0x0000000000000000000000000000000000000000", // for yxUSDC
        addresses.stkAAVE[network], // for aUSDCV2
        addresses.IDLE,
      ]
    },
    {
      idleTokenAddress: addresses.idleUSDTV4,
      aTokenAddress: addresses.aUSDTV2[network],
      protocolTokens: [
        addresses.cUSDT[network],
        addresses.aUSDT[network],
        addresses.aUSDTV2[network],
      ],
      newGovTokens: [
        addresses.COMP[network],
        addresses.stkAAVE[network],
        addresses.IDLE,
      ],
      newGovTokensEqualLen: [
        addresses.COMP[network], // for cUSDT
        "0x0000000000000000000000000000000000000000", // for aUSDT
        addresses.stkAAVE[network], // for aUSDTV2
        addresses.IDLE,
      ]
    },
    {
      idleTokenAddress: addresses.idleWBTCV4,
      aTokenAddress: addresses.aWBTCV2[network],
      protocolTokens: [
        addresses.cWBTCV2[network],
        addresses.aWBTC[network],
        addresses.aWBTCV2[network]
      ],
      wrappers: [
        "0xe5cb51e2d6682ff6b4d0b37cea7e66227dd15c4e", // cWBTC
        "0xA91cF5B36A691bDA39640156B081CB71C3e9992E", // aWBTC v1
        "0x69435730D6Af2249265C4fF578D89Ec4c827C475", // aWBTC v2
      ],
      newGovTokens: [
        addresses.COMP[network],
        addresses.stkAAVE[network],
        addresses.IDLE,
      ],
      newGovTokensEqualLen: [
        addresses.COMP[network], // for cWBTC
        "0x0000000000000000000000000000000000000000", // for aWBTC
        addresses.stkAAVE[network], // for aWBTCV2
        addresses.IDLE,
      ]
    },
    {
      idleTokenAddress: addresses.idleWETHV4,
      aTokenAddress: addresses.aWETH[network],
    },
  ]

  const description = '#Update IdleToken implementation to update gov tokens management';
  const proposal = new Proposal(web3, description, addresses.forkProposer);

  // call upgradeAndCall on proxyAdmin
  for (var i = 0; i < allIdleTokens.length; i++) {
    const attrs = allIdleTokens[i];
    const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
    const idleTokenName = await idleToken.name();
    console.log("creating actions for", idleTokenName, idleToken.address);
    const initMethodToCall = web3.eth.abi.encodeFunctionCall({
      name: "_init(address,address,address)",
      type: "function",
      inputs: [
        { type: "address", name: "_tokenHelper" },
        { type: "address", name: "_aToken" },
        { type: "address", name: "_newOracle" },
      ]
    }, [idleTokenHelperAddress, attrs.aTokenAddress, addresses.priceOracleV2]);

    console.log("_init params:")
    console.log("idleTokenAddress:", attrs.idleTokenAddress)
    console.log("aTokenAddress:", attrs.aTokenAddress)

    console.log("adding action upgradeAndCall calling _init");
    proposal.addAction({
      target: addresses.proxyAdmin,
      value: toBN("0"),
      signature: "upgradeAndCall(address,address,bytes)",
      calldataParams: ["address", "address", "bytes"],
      calldataValues: [attrs.idleTokenAddress, idleTokenImplementationAddress, initMethodToCall]
    });

    if (attrs.protocolTokens !== undefined) {
      // setAllAvailableTokensAndWrappers
      const wrappers = attrs.wrappers || [];
      if (wrappers.length === 0) {
        for (var ptIndex = 0; ptIndex < attrs.protocolTokens.length; ptIndex++) {
          const pt = attrs.protocolTokens[ptIndex];
          const wrapper = await idleToken.protocolWrappers(pt);
          console.log("wrapper for", pt, "is", wrapper)
          wrappers.push(wrapper);
        };
      }

      const calldataValues = [
        attrs.protocolTokens,
        wrappers,
        attrs.newGovTokens,
        attrs.newGovTokensEqualLen,
      ];

      console.log("adding action setAllAvailableTokensAndWrappers", idleTokenName, calldataValues);
      proposal.addAction({
        target: attrs.idleTokenAddress,
        value: toBN("0"),
        signature: "setAllAvailableTokensAndWrappers(address[],address[],address[],address[])",
        calldataParams: ["address[]", "address[]", "address[]", "address[]"],
        calldataValues: calldataValues,
      });
    }

    console.log("-------------------\n\n");
  }

  // call setCToken in idleWBTCV4
  console.log("adding action setCToken for idleWBTCV4");
  proposal.addAction({
    target: addresses.idleWBTCV4,
    value: toBN("0"),
    signature: "setCToken(address)",
    calldataParams: ["address"],
    calldataValues: [addresses.cWBTCV2[network]],
  });

  // if (network === "local") {
  //   await testCompGovTokens(network, accounts[0], check, "before the proposal, user's COMP balance should stay at 0");
  // }

  if (network === "live") {
    await askToContinue("continue?");
  }

  await createProposal(network, proposal);

  // if (network === "local") {
  //   await testCompGovTokens(network, accounts[1], checkIncreased, "after the proposal, user's COMP balance should increase");
  // }
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
