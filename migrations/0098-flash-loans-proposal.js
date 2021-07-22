const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const { time } = require('@openzeppelin/test-helpers');
const BigNumber = require('bignumber.js');
const VesterFactory = artifacts.require("VesterFactory.sol");
const Vester = artifacts.require("Vester");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const IGovernorAlpha = artifacts.require("IGovernorAlpha");
const Idle = artifacts.require("Idle")
const addresses = require("./addresses");

const BNify = v => new BigNumber(v.toString());
const timelockDelay = 172800

const advanceBlocks = async n => {
  for (var i = 0; i < n; i++) {
    if (i === 0 || i % 100 === 0) {
      process.stdout.clearLine();  // clear current text
      process.stdout.cursorTo(0);
      process.stdout.write(`waiting for ${n - i} blocks...`);
    }

    await time.advanceBlock();
  }
}

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'soliditycoverage') {
    return;
  }

  const getLatestProposal = async (gov) => {
    return gov.proposalCount.call()
  }

  const createProposal = async (gov, founder, {targets, values, signatures, calldatas, description, from}, log) => {
    console.log(`Proposing: ${log}`);
    await gov.propose(targets, values, signatures, calldatas, description,
      {from}
    );

    console.log("proposal created");

    if (network === 'live') {
      return;
    }

    // need 1 block to pass before being able to vote but less than 10
    await advanceBlocks(2);
    const proposalId = await getLatestProposal(gov);
    await gov.castVote(proposalId, true, {from: founder});
    console.log('voted');

    // Need to advance 3d in blocs + 1
    await advanceBlocks(17281);

    await gov.queue(proposalId);
    console.log('queued');

    await time.increase(timelockDelay+100)
    console.log("time increased")
    await advanceBlocks(1)
    console.log("advanced 1")

    await gov.execute(proposalId);
    console.log('executed');
    await advanceBlocks(2);
  };

  await deployer.deploy(IdleTokenGovernance);
  const newImplementation = await IdleTokenGovernance.deployed();
  console.log("implementation deployed at", newImplementation.address)

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
    addresses.idleDAISafeV4,
    addresses.idleUSDCSafeV4,
    addresses.idleUSDTSafeV4,
    // addresses.idleWETHV4,
  ]

  const propName = '#Update IdleToken implementation to support flash loans';
  const targets = allIdleTokens.map(a => addresses.proxyAdmin);
  // targets[targets.length - 1] = idleWETHProxyAdmin; // idleWETH has a different Proxy Admin
  const values = allIdleTokens.map(a => BNify('0'));

  // const initMethodToCallWithParams = web3.eth.abi.encodeFunctionCall({
  //   name: '_init()',
  //   type: 'function',
  //   inputs: [
  //     {
  //       type: 'uint256',
  //       name: 'myNumber'
  //     }
  //   ]
  // }, [BNify('9')]);

  const initMethodToCall = web3.eth.abi.encodeFunctionCall({
    name: '_init()',
    type: 'function',
    inputs: []
  }, []);
  console.log('initMethodToCall', initMethodToCall);

  const proposal = {
    targets: targets.map(t => proxyAdmin),
    values: values,
    signatures: allIdleTokens.map(a => 'upgradeAndCall(address,address,bytes)'),
    calldatas: allIdleTokens.map(a =>
      web3.eth.abi.encodeParameters(
        ['address', 'address', 'bytes'],
        [a, newImplementation.address, initMethodToCall]
      )
    ),
    description: propName,
    from: founder
  };

  await createProposal(govInstance, founder, proposal, propName);
}
