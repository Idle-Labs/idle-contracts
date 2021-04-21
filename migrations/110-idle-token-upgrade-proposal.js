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
  let idleTokenHelperAddress = '';

  if (network === "local") {
    await deployer.deploy(IdleTokenGovernance);
    const idleTokenImplementation = await IdleTokenGovernance.deployed();
    idleTokenImplementationAddress = idleTokenImplementation.address;
    console.log("implementation deployed at", idleTokenImplementationAddress)

    await deployer.deploy(IdleTokenHelper);
    const idleTokenHelper = await IdleTokenHelper.deployed();
    idleTokenHelperAddress = idleTokenHelper.address;
    console.log("idle token helper deployed at", idleTokenHelperAddress);
  }

  const founder = "0x3675D2A334f17bCD4689533b7Af263D48D96eC72";
  const proxyAdmin = '0x7740792812A00510b50022D84e5c4AC390e01417';
  const idleWETHProxyAdmin = '0xc2ff102E62027DE1205a7EDd4C8a8F58C1E5e3e8';
  const govInstance = await IGovernorAlpha.at('0x2256b25CFC8E35c3135664FD03E77595042fe31B')

  const idleInstance = await Idle.at(addresses.IDLE)
  const vesterFactory = await VesterFactory.at("0xbF875f2C6e4Cc1688dfe4ECf79583193B6089972")
  const founderVesting = await vesterFactory.vestingContracts.call(founder);
  const vesterFounder = await Vester.at(founderVesting);

  await idleInstance.delegate(founder, {from: founder});
  await vesterFounder.setDelegate(founder, {from: founder});

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
  let initMethodToCall = web3.eth.abi.encodeFunctionCall({
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
    targets: targets.map(t => proxyAdmin),
    values: values,
    signatures: signatures,
    calldatas: callDatas,
    description: propName,
    from: founder,
  };



  await askToContinue("continue?");
  await createProposal(govInstance, proposal);
}
