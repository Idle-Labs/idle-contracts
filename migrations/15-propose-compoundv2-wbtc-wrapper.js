const rl = require("readline");
const IdleCompoundV2 = artifacts.require("IdleCompoundV2.sol");
const Idle = artifacts.require("Idle")
const IdleTokenGovernance = artifacts.require("IdleTokenGovernance")
const IdleController = artifacts.require("IdleController")
const IERC20 = artifacts.require("IERC20Detailed.sol");
const addresses = require("./addresses");
const { createProposal } = require("./create-proposal");
const { time } = require('@openzeppelin/test-helpers');
const BigNumber = require('bignumber.js');

const toBN = v => new BigNumber(v.toString());
const timelockDelay = 172800

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const compoundV2Wrapper = await IdleCompoundV2.at('0xe5cb51e2d6682ff6b4d0b37cea7e66227dd15c4e');
  // await deployer.deploy(IdleCompoundV2, addresses.cWBTCV2.live, addresses.WBTC.live, {from: addresses.creator});
  // const compoundV2Wrapper = await IdleCompoundV2.deployed();
  // console.log("IdleCompoundV2 wbtc deployed at", compoundV2Wrapper.address);
  // await compoundV2Wrapper.setIdleToken(addresses.idleWBTCV4, {from: addresses.creator});
  // console.log('setIdleToken done');
  // console.log("************************************\n\n\n\n");

  const cTokenV2Address = addresses.cWBTCV2.live;
  const underlyingTokenAddress = addresses.WBTC.live;

  const targets = [];
  const values = [];
  const signatures = [];
  const calldatas = [];

  const idleTokens = {
    'idleWBTCV4': {
      idleTokenAddress: addresses.idleWBTCV4,
      cTokenV2Address: addresses.cWBTCV2.live,
      compoundV2WrapperAddress: compoundV2Wrapper.address,
      underlyingTokenAddress: addresses.WBTC.live
    }
  }
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

    tokens = [...tokens, attrs.cTokenV2Address];
    wrappers = [...wrappers, attrs.compoundV2WrapperAddress];

    const params = [
      ['address[]', 'address[]', 'uint256[]', 'bool'],
      [tokens, wrappers, [20000, 20000, 60000], true]
    ];

    console.log("calldatasParams", params);

    // Add one action to add the new wbtcv2 wrapper
    targets.push(attrs.idleTokenAddress);
    values.push(toBN("0"));
    signatures.push("setAllAvailableTokensAndWrappers(address[],address[],uint256[],bool)");
    calldatas.push(web3.eth.abi.encodeParameters(...params));
  }

  let proposal = {
    targets: targets,
    values: values,
    signatures: signatures,
    calldatas: calldatas,
    description: '#IIPX: add compoundV2 wrapper for idleWBTC and enable IDLE distribution for idleWETH. Pay 3500 IDLE bounty to Emiliano #IIP-4 Treasury committee and aave v2 fix \n https://gov.idle.finance/t/enable-idle-farming-for-the-weth-pool/348 - https://gov.idle.finance/t/compound-wbtc-migration-required-adjustments/351 - https://gov.idle.finance/t/bounty-to-emiliano-a-chance-to-setup-a-developer-mining-program/251',
    from: addresses.forkProposer
  }

  await createProposal(network, proposal);

  if (network === 'live') {
    return;
  }

  await web3.eth.sendTransaction({ from: addresses.whale, to: addresses.timelock, value: "1000000000000000000" });

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

  // Test stuff
  for (const idleTokenName in idleTokens) {
    const user = addresses.mintRedeemTestUser;
    const attrs = idleTokens[idleTokenName];
    console.log("\n\n********************************* testing", idleTokenName);

    const idleToken = await IdleTokenGovernance.at(attrs.idleTokenAddress);
    console.log("--------------- 50000")
    await setAllocationsAndRebalance(idleToken, 50000);
    console.log("--------------- 0")
    await setAllocationsAndRebalance(idleToken, 0);

    // test mint and redeem
    const underlying = await idleToken.token();
    console.log('underlying', underlying);
    const underlyingContract = await IERC20.at(underlying);
    const tokenDecimals = await underlyingContract.decimals();
    console.log('tokenDecimals', tokenDecimals.toString());
    const oneToken = toBN(`1e${tokenDecimals}`);
    const oneIdleToken = toBN(`1e18`);
    const amount = oneToken.times('10');
    await underlyingContract.transfer(user, amount, {from: addresses.whale}); // whale
    console.log('transfer complete');

    await underlyingContract.approve(idleToken.address, amount, {from: user});
    console.log('##### balance token user pre: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user pre: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
    await idleToken.mintIdleToken(amount, true, addresses.addr0, {from: user});
    console.log('##### balance token user post: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user post: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
    await idleToken.redeemIdleToken(await idleToken.balanceOf(user), {from: user});
    console.log('##### balance token user post 2: ', toBN(await underlyingContract.balanceOf(user)).div(oneToken).toString());
    console.log('##### balance idleToken user post 2: ', toBN(await idleToken.balanceOf(user)).div(oneIdleToken).toString());
  }
};
