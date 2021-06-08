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

  let idleTokenImplementationAddress;
  let idleTokenImplementation;

  const proposer = network === 'live' ?
    addresses.mainnetProposer : addresses.forkProposer;

  console.log('Proposer: ', proposer);


  if (network == 'live') {
    idleTokenImplementationAddress = addresses.lastIdleTokenImplementation;
    idleTokenImplementation = await IdleTokenGovernance.at(idleTokenImplementationAddress);
    console.log('Using IdleTokenGovernance at ', idleTokenImplementationAddress)
    if (!idleTokenImplementationAddress) {
      return;
    }
  } else {
    await deployer.deploy(IdleTokenGovernance);
    idleTokenImplementation = await IdleTokenGovernance.deployed();
    idleTokenImplementationAddress = idleTokenImplementation.address;
    console.log('Deployed new IdleTokenGovernance at ', idleTokenImplementationAddress);
  }

  const idleTokenHelperAddress = addresses.idleTokenHelper;
  const idleTokenHelper = await IdleTokenHelper.at(idleTokenHelperAddress);
  console.log('Using IdleTokenHelper at ', idleTokenHelperAddress)

  const allIdleTokens = [
    {
      upgrade: true,
      initialize: false,
      idleTokenAddress: addresses.idleWETHV4,
      aTokenAddress: addresses.aWETH[network],
      protocolTokens: [
        addresses.cWETH[network],
        addresses.aWETH[network],
      ],
      wrappers: [
        "0x9A7aCA7618801ca90f91BeAa5a1A2E90a55605CA", // cWETH
        "0x3C5a5D7832e9084fD88885823aFA8Cd99250a70c", // aWETH
      ],
      newGovTokens: [
        addresses.COMP[network],
        addresses.stkAAVE[network],
        addresses.IDLE,
      ],
      newGovTokensEqualLen: [
        addresses.COMP[network], // for cWETH
        addresses.stkAAVE[network], // for aWETH
        addresses.IDLE,
      ]
    },
    {
      upgrade: true,
      initialize: true,
      idleTokenAddress: addresses.idleSUSDV4,
      aTokenAddress: addresses.aSUSDV2[network],
    },
    {
      upgrade: true,
      initialize: true,
      idleTokenAddress: addresses.idleTUSDV4,
      aTokenAddress: addresses.aTUSDV2[network],
    },
    // Following tokens should be upgrade but no need to initialize
    {
      upgrade: true,
      initialize: false,
      idleTokenAddress: addresses.idleDAIV4,
    },
    {
      upgrade: true,
      initialize: false,
      idleTokenAddress: addresses.idleUSDCV4,
    },
    {
      upgrade: true,
      initialize: false,
      idleTokenAddress: addresses.idleUSDTV4,
    },
    {
      upgrade: true,
      initialize: false,
      idleTokenAddress: addresses.idleWBTCV4,
    },
  ]

  const description = '#IIP-7 [Part 2] Activate stkAAVE in WETH, upgrade IdleTokenGovernance best yield contract, transfer leagues funds \n Upgrade of IdleTokenGovernance contract to include rebalance optimizations, activate stkAAVE distribution and get IDLE and WETH for the Dev and treasury Leagues. For more info: https://gov.idle.finance/t/iip-7-idletoken-upgrade-stkaave-distribution/466';
  const proposal = new Proposal(web3, description, proposer);

  // call upgradeAndCall on proxyAdmin
  for (var i = 0; i < allIdleTokens.length; i++) {
    const attrs = allIdleTokens[i];
    const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
    const idleTokenName = await idleToken.name();
    console.log("creating actions for", idleTokenName, idleToken.address);

    if (attrs.upgrade && attrs.initialize) {
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
    } else if (attrs.upgrade) {
      proposal.addAction({
        target: addresses.proxyAdmin,
        value: toBN("0"),
        signature: "upgrade(address,address)",
        calldataParams: ["address", "address"],
        calldataValues: [attrs.idleTokenAddress, idleTokenImplementationAddress]
      });
    }

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

  // Kept for reference
  //
  // proposal.addAction({
  //   target: addresses.idleController,
  //   value: toBN("0"),
  //   signature: "_setPriceOracle(address)",
  //   calldataParams: ["address"],
  //   calldataValues: [addresses.priceOracleV2],
  // });

  const weth = await IERC20Detailed.at(addresses.WETH[network]);
  const idle = await IERC20Detailed.at(addresses.IDLE);

  const devMultisigWETHBalance = toBN(await weth.balanceOf(addresses.devLeagueMultisig));
  const treasuryMultisigIDLEBalance = toBN(await idle.balanceOf(addresses.treasuryMultisig));

  const IDLEtoTransfer = toBN(web3.utils.toWei("11008", "ether")); // 11,008 IDLE
  const WETHtoTransfer = toBN(web3.utils.toWei("6.38", "ether")); // 6.38 ETH
  console.log("IDLEtoTransfer", IDLEtoTransfer.toString());
  console.log("WETHtoTransfer", WETHtoTransfer.toString());

  proposal.addAction({
    target: addresses.feeTreasury,
    value: toBN("0"),
    signature: "transfer(address,address,uint256)",
    calldataParams: ["address", "address", "uint256"],
    calldataValues: [weth.address, addresses.devLeagueMultisig, WETHtoTransfer],
  });

  proposal.addAction({
    target: addresses.ecosystemFund,
    value: toBN("0"),
    signature: "transfer(address,address,uint256)",
    calldataParams: ["address", "address", "uint256"],
    calldataValues: [idle.address, addresses.treasuryMultisig, IDLEtoTransfer],
  });

  if (network === "live") {
    await askToContinue("continue?");
  }

  const aprsBefore = {};

  // APR
  if (network === "local") {
    for (var i = 0; i < allIdleTokens.length; i++) {
      const attrs = allIdleTokens[i];
      if (attrs.protocolTokens && attrs.protocolTokens.length > 0) {
        const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
        const idleTokenName = await idleToken.name();
        const apr = toBN(await idleToken.getAvgAPR());
        aprsBefore[attrs.idleTokenAddress] = apr;
      }
    };
  }

  // CREATE PROPOSAL
  await createProposal(network, proposal, {
    skipTimelock: false,
    deployer: deployer,
    ownedContracts: [
      ...allIdleTokens.map(attrs => attrs.idleTokenAddress),
      addresses.proxyAdmin,
      addresses.feeTreasury,
      addresses.ecosystemFund,
    ],
  });

  checkIncreased(devMultisigWETHBalance, toBN(await weth.balanceOf(addresses.devLeagueMultisig)), "treasury multisig WETH balance should increase");
  checkIncreased(treasuryMultisigIDLEBalance, toBN(await idle.balanceOf(addresses.treasuryMultisig)), "treasury multisig IDLE balance should increase");

  // APR
  if (network === "local") {
    for (var i = 0; i < allIdleTokens.length; i++) {
      const attrs = allIdleTokens[i];
      if (attrs.protocolTokens && attrs.protocolTokens.length > 0) {
        const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
        const idleTokenName = await idleToken.name();
        const apr = toBN(await idleToken.getAvgAPR());
        checkIncreased(aprsBefore[attrs.idleTokenAddress], apr, `apr for ${idleTokenName} should increase after the proposal.`);
      }
    };
  }

  // stkAAVE
  if (network === "local") {
    for (var i = 0; i < allIdleTokens.length; i++) {
      const attrs = allIdleTokens[i];
      if (attrs.protocolTokens && attrs.protocolTokens.length > 0) {
        await testStkAAVEGovTokens(network, accounts[1], checkIncreased, allIdleTokens[i], "after the proposal, user's stkAAVE balance should increase");
      }
    };
  }
}

const testStkAAVEGovTokens = async (network, user, checkFunc, attrs, testMessage) => {
  const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
  const idleTokenName = await idleToken.name();
  console.log("testing stkAAVE gov tokens for ", idleTokenName);

  let aTokenIndex = -1;
  for (var i = 0; i < attrs.protocolTokens.length; i++) {
    if (attrs.protocolTokens[i] === attrs.aTokenAddress) {
      aTokenIndex = i;
      break;
    }
  };

  if (aTokenIndex < 0) {
    throw("aToken not found");
  }

  console.log("aToken index", aTokenIndex);
  const allocations = new Array(attrs.protocolTokens.length).fill(toBN("0"));
  allocations[aTokenIndex] = toBN("100000");
  console.log("allocations", allocations.map(a => a.toString()));

  const underlying = await IERC20Detailed.at(await idleToken.token());

  const decimals = toBN(await underlying.decimals());
  const ONE = toBN("10").pow(toBN(decimals));
  const fromUnits = u => toBN(u).times(ONE);

  await web3.eth.sendTransaction({ from: addresses.whale, to: addresses.timelock, value: "1000000000000000000" });
  const amount = fromUnits("10");
  await idleToken.setAllocations(allocations, { from: addresses.timelock });

  const stkAAVE = await IERC20.at(addresses.stkAAVE[network]);

  // whale sends amount to user
  await underlying.transfer(user, amount, { from: addresses.whale });

  await idleToken.rebalance({ from: addresses.whale })

  const govTokensBalanceBefore = toBN(await stkAAVE.balanceOf(user));

  await underlying.approve(idleToken.address, amount, {from: user});
  await idleToken.mintIdleToken(amount, true, addresses.addr0, {from: user});
  await advanceBlocks(10);
  await idleToken.redeemIdleToken(await idleToken.balanceOf(user), {from: user});

  const govTokensBalanceAfter = toBN(await stkAAVE.balanceOf(user));

  checkFunc(govTokensBalanceBefore, govTokensBalanceAfter, testMessage);
  console.log("---------------------------------");
}
