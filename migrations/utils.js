const rl = require("readline");
const Idle = artifacts.require("Idle")
const IERC20 = artifacts.require("IERC20Detailed.sol");
const VesterFactory = artifacts.require("VesterFactory.sol");
const Vester = artifacts.require("Vester");
const IOwnable = artifacts.require("IOwnable");
const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const FakeTimelock = artifacts.require("FakeTimelock");
const addresses = require("./addresses");
const { time } = require('@openzeppelin/test-helpers');
const BigNumber = require('bignumber.js');
const IGovernorAlpha = artifacts.require("IGovernorAlpha");

const toBN = v => new BigNumber(v.toString());
const timelockDelay = 172800

const prompt = (question) => {
  const r = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  return new Promise((resolve, error) => {
    r.question(question, answer => {
      r.close()
      resolve(answer)
    });
  })
}

const askToContinue = async (question) => {
  const answer = await prompt(`${question} [Y/n]`);
  if (answer !== "" && answer !== "y" && answer !== "yes") {
    console.log("exiting...");
    process.exit(1);
  }
}

const check = (a, b, message) => {
  a = a.toString();
  b = b.toString();
  let [icon, symbol] = a.toString() === b ? ["✔️", "==="] : ["🚨🚨🚨", "!=="];
  console.log(`${icon}  `, a, symbol, b, message ? message : "");
}

const checkIncreased = (a, b, message) => {
  let [icon, symbol] = b.gt(a) ? ["✔️", ">"] : ["🚨🚨🚨", "<="];
  console.log(`${icon}  `, b.toString(), symbol, a.toString(), message ? message : "");
}

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

const executeProposalDirectly = async (network, ownedContracts, deployer, proposal) => {
  console.log("\n\n**********************************************");
  console.log("Executing proposal directly skipping timelock");
  console.log("**********************************************\n\n");
  if (network !== "local") {
    throw("you can execute proposal directly only in local network");
  }

  await proposal.web3.eth.sendTransaction({from: addresses.whale, to: addresses.timelock, value: "1000000000000000000"});

  await deployer.deploy(FakeTimelock);
  const fakeTimelock = await FakeTimelock.deployed();

  console.log("\n\n********************************************************");
  console.log("Changing owner of ownedContracts to fakeTimelock");
  console.log("********************************************************\n\n");
  for (var i = 0; i < ownedContracts.length; i++) {
    const c = await IOwnable.at(ownedContracts[i]);
    await c.transferOwnership(fakeTimelock.address, { from: addresses.timelock });
  };

  for (var i = 0; i < proposal.targets.length; i++) {
    console.log(`skipping timelock and executing directly proposal action ${i+1} of ${proposal.targets.length}`);
    const target = proposal.targets[i];
    const value = proposal.values[i];
    const signature = proposal.signatures[i];
    const calldata = proposal.calldatas[i];

    await fakeTimelock.executeTransaction(target, value, signature, calldata, { from: addresses.timelock });
    console.log("done.");
  };

  console.log("\n\n********************************************************");
  console.log("Changing owner of ownedContracts back to real timelock");
  console.log("********************************************************\n\n");
  for (var i = 0; i < ownedContracts.length; i++) {
    await fakeTimelock.transferOwnership(ownedContracts[i], addresses.timelock);
  };
}

const createProposal = async (network, proposal, options) => {
  options = options || {
    skipTimelock: false,
    deployer: null,
    ownedContracts: [],
  };

  if (network !== "local" && options.skipTimelock === true) {
    throw("you can skip timelock only in local network");
  }

  const getLatestPropsal = async gov => gov.proposalCount.call();

  const _createProposal = async (gov, {targets, values, signatures, calldatas, description, from}) => {
    let proposer = proposal.from;
    console.log(`Proposing: ${description} (${targets.length} actions)`);
    console.log("targets", targets);
    console.log("signatures", signatures);
    console.log("calldatas", calldatas);
    console.log("calling gov.propose");
    await gov.propose(targets, values, signatures, calldatas, description,
      {from}
    );

    console.log("proposal created");

    if (network === 'live') {
      return;
    }

    // need 1 block to pass before being able to vote but less than 10
    await advanceBlocks(2);
    const proposalId = await getLatestPropsal(gov);
    await gov.castVote(proposalId, true, {from: proposer});
    console.log('voted');

    // Need to advance 3d in blocs + 1
    await advanceBlocks(17281);

    await gov.queue(proposalId);
    console.log('queued');

    await time.increase(timelockDelay+100)
    console.log("time increased")
    await advanceBlocks(1)
    console.log("advanced 1")

    console.log("calling gov.execute");
    await gov.execute(proposalId);
    console.log('executed');
    await advanceBlocks(2);
  };

  if (options.skipTimelock === true) {
    await executeProposalDirectly(network, options.ownedContracts, options.deployer, proposal);
  } else {
    const govInstance = await IGovernorAlpha.at(addresses.governorAlpha);
    let proposer = proposal.from;
    if (network != 'live') {
      proposal.from = addresses.forkProposer;
      const idleInstance = await Idle.at(addresses.IDLE)
      const vesterFactory = await VesterFactory.at(addresses.vesterFactory);
      const proposerVesting = await vesterFactory.vestingContracts.call(proposal.from);
      const vesterFounder = await Vester.at(proposerVesting);
      await idleInstance.delegate(proposal.from, {from: proposal.from});
      await vesterFounder.setDelegate(proposal.from, {from: proposal.from});
    }

    await _createProposal(govInstance, proposal.toObject());
  }
}

class Proposal {
  constructor(web3, description, from) {
    this.web3 = web3;
    this.description = description;
    this.from = from;

    this.targets = [];
    this.values = [];
    this.signatures = [];
    this.calldataParams = [];
    this.calldataValues = [];
    this.calldatas = [];
  }

  addAction({target, value, signature, calldataParams, calldataValues}) {
    this.targets.push(target);
    this.values.push(value);
    this.signatures.push(signature);
    this.calldataParams.push(calldataParams);
    this.calldataValues.push(calldataValues);
    this.calldatas.push(
      this.web3.eth.abi.encodeParameters(calldataParams, calldataValues)
    );
  }

  toObject() {
    return {
      description: this.description,
      from: this.from,
      targets: this.targets,
      values: this.values,
      signatures: this.signatures,
      calldatas: this.calldatas,
    }
  }
}

module.exports = {
  prompt,
  check,
  checkIncreased,
  toBN,
  timelockDelay,
  createProposal,
  advanceBlocks,
  askToContinue,
  Proposal,
};
