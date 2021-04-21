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

  const propName = '#Update IdleToken implementation to update gov tokens management';

  // call upgradeAndCall on proxyAdmin
  let targets = allIdleTokens.map(a => addresses.proxyAdmin);
  let values = allIdleTokens.map(a => toBN("0"));
  let signatures = allIdleTokens.map(a => "upgradeAndCall(address,address,bytes)");
  const initMethodToCall = web3.eth.abi.encodeFunctionCall({
    name: "_init(address)",
    type: "function",
    inputs: [
    {
      type: "address",
      name: "_tokenHelper"
    }
    ]
  }, [idleTokenHelperAddress]);
  const callDatas = allIdleTokens.map(addr =>
    web3.eth.abi.encodeParameters(
      ["address", "address", "bytes"],
      [addr, idleTokenImplementationAddress, initMethodToCall]
    )
  );

  // call setCToken in idleWBTCV4
  targets.push(addresses.idleWBTCV4);
  values.push(toBN("0"));
  signatures.push("setCToken(address)");
  callDatas.push(
    web3.eth.abi.encodeParameters(["address"], [addresses.cWBTCV2[network]])
  );

  console.log("targets", targets);
  console.log("values", values);
  console.log("signatures", signatures);
  console.log("initMethodToCall", initMethodToCall);
  console.log("callDatas", callDatas);

  const proposal = {
    targets: targets.map(t => addresses.proxyAdmin),
    values: values,
    signatures: signatures,
    calldatas: callDatas,
    description: propName,
    from: addresses.forkProposer,
  };

  await askToContinue("continue?");
  await createProposal(network, proposal);
}
