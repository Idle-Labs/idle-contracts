const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");

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
} = require("./utils");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  let idleTokenImplementationAddress = '';

  await deployer.deploy(IdleTokenHelper);
  const idleTokenHelper = await IdleTokenHelper.deployed();
  const idleTokenHelperAddress = idleTokenHelper.address;
  console.log("idle token helper deployed at", idleTokenHelperAddress);

  if (network === "local") {
    await deployer.deploy(IdleTokenGovernance);
    const idleTokenImplementation = await IdleTokenGovernance.deployed();
    idleTokenImplementationAddress = idleTokenImplementation.address;
    console.log("implementation deployed at", idleTokenImplementationAddress)
  }

  const allIdleTokens = [
    addresses.idleDAIV4,
    addresses.idleUSDCV4,
    addresses.idleUSDTV4,
    addresses.idleSUSDV4,
    addresses.idleTUSDV4,
    addresses.idleWBTCV4,
    addresses.idleWETHV4,
  ]

  const description = '#Update IdleToken implementation to update gov tokens management';
  const proposal = new Proposal(web3, description, addresses.forkProposer);

  // call upgradeAndCall on proxyAdmin
  allIdleTokens.forEach(idleTokenAddress => {
    const initMethodToCall = web3.eth.abi.encodeFunctionCall({
      name: "_init(address)",
      type: "function",
      inputs: [{ type: "address", name: "_tokenHelper" }]
    }, [idleTokenHelperAddress]);

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
        addresses.IDLE,
      ],
      // _newGovTokensEqualLen
      [
        addresses.COMP[network], // for cWBTCV2
        "0x0000000000000000000000000000000000000000", // for aWBTC
        "0x0000000000000000000000000000000000000000", // for aWBTCV2
        addresses.IDLE,
      ]
    ],
  });

  await askToContinue("continue?");
  await createProposal(network, proposal.toObject());
}
