const rl = require("readline");
const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
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
const TOKENS_HOLDER = "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98";
const addr0 = '0x0000000000000000000000000000000000000000';

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

// take output from migration 9
const idleTokens = null;

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  if (!idleTokens) {
    console.log("The idleTokens variable should be initialized with the output of migration 9.");
    process.exit(1);
  }

  const getLatestPropsal = async (gov) => {
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
  const govInstance = await IGovernorAlpha.at('0x2256b25CFC8E35c3135664FD03E77595042fe31B')

  const aTokenAddress = addresses.aDAIV2.live;
  const underlyingTokenAddress = addresses.DAI.live;

  const idleInstance = await Idle.at(addresses.IDLE)
  const vesterFactory = await VesterFactory.at("0xbF875f2C6e4Cc1688dfe4ECf79583193B6089972")
  const founderVesting = await vesterFactory.vestingContracts.call(founder);
  const vesterFounder = await Vester.at(founderVesting);

  await idleInstance.delegate(founder, {from: founder});
  await vesterFounder.setDelegate(founder, {from: founder});

  const targets = [];
  const values = [];
  const signatures = [];
  const calldatas = [];

  for (const idleTokenName in idleTokens) {
    console.log("preparing params for", idleTokenName);
    const attrs = idleTokens[idleTokenName];
    const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
    const res = await idleToken.getAPRs();

    let tokens = res["0"].map(v => v.toString());
    let wrappers = [];

    for (var i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const wrapper = await idleToken.protocolWrappers(token);
      wrappers.push(wrapper);
    };

    tokens = [...tokens, attrs.aTokenAddress];
    wrappers = [...wrappers, attrs.aaveV2WrapperAddress];

    const params = [
      ['address[]', 'address[]', 'uint256[]', 'bool'],
      [tokens, wrappers, [20000, 20000, 10000, 50000], true]
    ];

    targets.push(attrs.idleTokenAddress);
    values.push(toBN("0"));
    signatures.push("setAllAvailableTokensAndWrappers(address[],address[],uint256[],bool)");
    calldatas.push(web3.eth.abi.encodeParameters(...params));
  }

  console.log("targets", targets)
  console.log("signatures", signatures)
  console.log("calldatas", calldatas)

  let propName = 'add aavev2 wrapper';
  let proposal = {
    targets: targets,
    values: values,
    signatures: signatures,
    calldatas: calldatas,
    description: propName,
    from: founder
  }

  await createProposal(govInstance, founder, proposal, propName);
  if (network === 'live') {
    return;
  }

  await web3.eth.sendTransaction({ from: TOKENS_HOLDER, to: addresses.timelock, value: "1000000000000000000" });

  const setAllocationsAndRebalance = async (idleToken, newWrapperAllocation) => {
    const tokens = (await idleToken.getAPRs()).addresses;
    console.log("tokens", tokens.join(", "));
    const totalAllocations = 100000;
    const oldWrappersAllocation = Math.floor((totalAllocations - newWrapperAllocation) / (tokens.length - 1));
    const allocations = new Array(tokens.length - 1).fill(oldWrappersAllocation);
    allocations.push(newWrapperAllocation);
    const tot = allocations.reduce((i, tot) => tot + i, 0);
    if (tot < totalAllocations) {
      allocations[0] += totalAllocations - tot;
    }

    const idleTokenDecimals = toBN(await idleToken.decimals());
    const idleTokenName = await idleToken.name();
    const toIdleTokenUnit = v => v.div(toBN("10").pow(idleTokenDecimals));

    console.log("new allocations", allocations)
    console.log("setting allocations for", idleTokenName);
    await idleToken.setAllocations(allocations, { from: addresses.timelock });
    const newAllocations = await idleToken.getAllocations();
    console.log("done setting allocations for", idleTokenName, "-", newAllocations.join(", "));

    console.log("rebalancing");
    await idleToken.rebalance({ from: addresses.timelock });
    console.log("rebalancing done");

    const totalSupply = toIdleTokenUnit(toBN(await idleToken.totalSupply()));
    console.log("total supply", totalSupply.toString());
    for (var i = 0; i < tokens.length; i++) {
      const token = await IERC20.at(tokens[i]);
      const tokenDecimals = toBN(await token.decimals());
      const toTokenUnit = v => v.div(toBN("10").pow(tokenDecimals));
      const name = await token.name();
      const balance = toTokenUnit(toBN(await token.balanceOf(idleToken.address)));
      console.log("token balance", name, tokens[i], balance.toString());
    };
  }

  for (const idleTokenName in idleTokens) {
    const attrs = idleTokens[idleTokenName];
    console.log("\n\n********************************* testing", idleTokenName);

    const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
    console.log("--------------- 50000")
    await setAllocationsAndRebalance(idleToken, 50000);
    console.log("--------------- 0")
    await setAllocationsAndRebalance(idleToken, 0);

    // test mint and redeem
    const user = '0xF1363D3D55d9e679cC6aa0a0496fD85BDfCF7464';
    const underlying = await idleToken.token();
    console.log('underlying', underlying);
    const underlyingContract = await IERC20.at(underlying);
    const tokenDecimals = await underlyingContract.decimals();
    console.log('tokenDecimals', tokenDecimals);
    const oneToken = toBN(`1e${tokenDecimals}`);
    const oneIdleToken = toBN(`1e18`);
    const amount = oneToken.times('100');
    await underlyingContract.transfer(user, amount, {from: TOKENS_HOLDER}); // whale
    console.log('transfer complete');

    await underlyingContract.approve(idleToken.address, amount, {from: user});
    console.log('##### balance token user pre: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user pre: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
    await idleToken.mintIdleToken(amount, true, addr0, {from: user});
    console.log('##### balance token user post: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user post: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
    await idleToken.redeemIdleToken(await idleToken.balanceOf(user), {from: user});
    console.log('##### balance token user post 2: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user post 2: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
  }
};
