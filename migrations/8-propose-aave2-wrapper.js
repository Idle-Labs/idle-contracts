const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const IIdle = artifacts.require("IIdle")
const IdleTokenV3_1 = artifacts.require("IdleTokenV3_1")
const IERC20 = artifacts.require("IERC20.sol");
const IVesterFactory = artifacts.require("IVesterFactory.sol");
const IVester = artifacts.require("IVester");
const addresses = require("./addresses");
const { time } = require('@openzeppelin/test-helpers');
const BigNumber = require('bignumber.js');
const IGovernorAlpha = artifacts.require("IGovernorAlpha");

const toBN = v => new BigNumber(v.toString());
const timelockDelay = 172800
const TOKENS_HOLDER = "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98";

const check = (a, b, message) => {
  a = a.toString();
  b = b.toString();
  let [icon, symbol] = a.toString() === b ? ["✔️", "==="] : ["🚨🚨🚨", "!=="];
  console.log(`${icon}  `, a, symbol, b, message ? message : "");
}

const checkIncreased = (a, b, message) => {
  let [icon, symbol] = b.gt(a) ? ["✔️", ">"] : ["🚨🚨🚨", "<="];
  console.log(`${icon}  `, a.toString(), symbol, b.toString(), message ? message : "");
}

const advanceBlocks = async n => {
  for (var i = 0; i < n; i++) {
    if (i === 0 || i % 100 === 0) {
      process.stdout.clearLine();  // clear current text
      process.stdout.cursorTo(0);
      process.stdout.write(`waiting for ${n - i} blocks`);
    }

    await time.advanceBlock();
  }
}

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const getLatestPropsal = async (gov) => {
    return gov.proposalCount.call()
  }

  const createProposal = async (gov, founder, {targets, values, signatures, calldatas, description, from}, log) => {
    console.log(`Proposing: ${log}`);
    await gov.propose(targets, values, signatures, calldatas, description,
      {from}
    );
    // need 1 block to pass before being able to vote but less than 10
    await advanceBlocks(2);
    const proposalId = await getLatestPropsal(gov);
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

  const founder = "0x3675D2A334f17bCD4689533b7Af263D48D96eC72";
  const idleToken = await IdleTokenV3_1.at(addresses.idleDAIV4);
  const govInstance = await IGovernorAlpha.at('0x2256b25CFC8E35c3135664FD03E77595042fe31B')

  const aTokenAddress = addresses.aDAIV2.live;
  const underlyingTokenAddress = addresses.DAI.live;
  await deployer.deploy(IdleAaveV2, aTokenAddress, underlyingTokenAddress, "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5", idleToken);
  const aaveV2Wrapper = await IdleAaveV2.deployed();

  const idleInstance = await IIdle.at(addresses.IDLE)
  const vesterFactory = await IVesterFactory.at("0xbF875f2C6e4Cc1688dfe4ECf79583193B6089972")
  const founderVesting = await vesterFactory.vestingContracts.call(founder);
  const vesterFounder = await IVester.at(founderVesting);

  await idleInstance.delegate(founder, {from: founder});
  await vesterFounder.setDelegate(founder, {from: founder});

  const res = await idleToken.getAPRs();
  let tokens = res["0"].map(v => v);
  let wrappers = [];
  for (var i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const wrapper = await idleToken.protocolWrappers(token);
    wrappers.push(wrapper);
  };

  tokens = [...tokens, addresses.aDAIV2.live];
  wrappers = [...wrappers, aaveV2Wrapper.address];

  console.log("***", tokens)
  console.log("***", wrappers)

  const params = [
    ['address[]', 'address[]', 'uint256[]', 'bool'],
    [tokens, wrappers, [20000, 20000, 20000, 20000], false]
  ];

  console.log("*******", params)

  let propName = 'add aavev2 wrapper';
  let proposal = {
    targets: [idleToken.address],
    values: [toBN("0")],
    signatures: ["setAllAvailableTokensAndWrappers(address[],address[],uint256[],bool)"],
    calldatas: [web3.eth.abi.encodeParameters(...params)],
    description: propName,
    from: founder
  }

  console.log("*********", proposal)

  await createProposal(govInstance, founder, proposal, propName);
};
