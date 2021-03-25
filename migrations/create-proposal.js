const rl = require("readline");
const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const IdleCompoundV2 = artifacts.require("IdleCompoundV2.sol");
const Idle = artifacts.require("Idle")
const IdleTokenGovernance = artifacts.require("IdleTokenGovernance")
const IERC20 = artifacts.require("IERC20Detailed.sol");
const VesterFactory = artifacts.require("VesterFactory.sol");
const Vester = artifacts.require("Vester");
const addresses = require("./addresses");
const { time } = require('@openzeppelin/test-helpers');
const BigNumber = require('bignumber.js');
const IGovernorAlpha = artifacts.require("IGovernorAlpha");

const toBN = v => new BigNumber(v.toString());
const timelockDelay = 172800
const TOKENS_HOLDER = addresses.whale;

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
      process.stdout.write(`waiting for ${n - i} blocks...`);
    }

    await time.advanceBlock();
  }
}

module.exports = {
  createProposal: async (network, proposal) => {
    const getLatestPropsal = async gov => gov.proposalCount.call()
    const createProposal = async (gov, {targets, values, signatures, calldatas, description, from}) => {
      let proposer = proposal.from;
      console.log(`Proposing: ${description}`);
      console.log("targets", targets);
      console.log("signatures", signatures);
      console.log("calldatas", calldatas);
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

      await gov.queue(proposalId, {from: proposer});
      console.log('queued');

      await time.increase(timelockDelay+100)
      console.log("time increased")
      await advanceBlocks(1)
      console.log("advanced 1")

      await gov.execute(proposalId, {from: proposer});
      console.log('executed');
      await advanceBlocks(2);
    };

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

    await createProposal(govInstance, proposal);
  }
};
