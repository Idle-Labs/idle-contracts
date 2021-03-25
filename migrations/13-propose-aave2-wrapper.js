const rl = require("readline");
const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const Idle = artifacts.require("Idle")
const IdleTokenGovernance = artifacts.require("IdleTokenGovernance")
const IdleController = artifacts.require("IdleController")
const IERC20 = artifacts.require("IERC20Detailed.sol");
const VesterFactory = artifacts.require("VesterFactory.sol");
const Vester = artifacts.require("Vester");
const addresses = require("./addresses");
const { time } = require('@openzeppelin/test-helpers');
const BigNumber = require('bignumber.js');
const IGovernorAlpha = artifacts.require("IGovernorAlpha");
const { createProposal } = require("./create-proposal");

const toBN = v => new BigNumber(v.toString());
const timelockDelay = 172800
const TOKENS_HOLDER = addresses.whale;
const addr0 = '0x0000000000000000000000000000000000000000';

// output from migration 12
const idleTokens = {
  idleDAIV4: {
    idleTokenAddress: '0x3fE7940616e5Bc47b0775a0dccf6237893353bB4',
    aTokenAddress: '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
    underlyingTokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    aaveV2WrapperAddress: '0x01A3688D7d01390677e85256406B3156aCd59C64'
  },
  idleUSDCV4: {
    idleTokenAddress: '0x5274891bEC421B39D23760c04A6755eCB444797C',
    aTokenAddress: '0xBcca60bB61934080951369a648Fb03DF4F96263C',
    underlyingTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    aaveV2WrapperAddress: '0xC9f16B7496843A82e51457aA84002d55036d8aA2'
  },
  idleUSDTV4: {
    idleTokenAddress: '0xF34842d05A1c888Ca02769A633DF37177415C2f8',
    aTokenAddress: '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
    underlyingTokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    aaveV2WrapperAddress: '0x52E6CFE2f0dF1a76b4110a1F0BF79e7149eAd9db'
  },
  idleSUSDV4: {
    idleTokenAddress: '0xF52CDcD458bf455aeD77751743180eC4A595Fd3F',
    aTokenAddress: '0x6c5024cd4f8a59110119c56f8933403a539555eb',
    underlyingTokenAddress: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
    aaveV2WrapperAddress: '0x8678ACE49f9F60F19994E6A1D6D5526D162C1172'
  },
  idleTUSDV4: {
    idleTokenAddress: '0xc278041fDD8249FE4c1Aad1193876857EEa3D68c',
    aTokenAddress: '0x101cc05f4A51C0319f570d5E146a8C625198e636',
    underlyingTokenAddress: '0x0000000000085d4780B73119b644AE5ecd22b376',
    aaveV2WrapperAddress: '0xE35c52F30Ba68C77E94c4ECED51551fEA6801B8e'
  },
  idleWBTCV4: {
    idleTokenAddress: '0x8C81121B15197fA0eEaEE1DC75533419DcfD3151',
    aTokenAddress: '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
    underlyingTokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    aaveV2WrapperAddress: '0x69435730D6Af2249265C4fF578D89Ec4c827C475'
  },
  // idleDAISafeV4: {
  //   idleTokenAddress: '0xa14eA0E11121e6E951E87c66AFe460A00BCD6A16',
  //   aTokenAddress: '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  //   underlyingTokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  //   aaveV2WrapperAddress: '0xb7e6b842fdc0F2F5563c575dea271BB2F37AB09f'
  // },
  // idleUSDCSafeV4: {
  //   idleTokenAddress: '0x3391bc034f2935ef0e1e41619445f998b2680d35',
  //   aTokenAddress: '0xBcca60bB61934080951369a648Fb03DF4F96263C',
  //   underlyingTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  //   aaveV2WrapperAddress: '0x9Ceb46147dc9E9cBBdD350EC53Ab143f6F20ECCD'
  // },
  // idleUSDTSafeV4: {
  //   idleTokenAddress: '0x28fAc5334C9f7262b3A3Fe707e250E01053e07b5',
  //   aTokenAddress: '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
  //   underlyingTokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  //   aaveV2WrapperAddress: '0xf834443C84235aB0C79Da83Fa5b18e32E1A7F271'
  // }
}

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const targets = [];
  const values = [];
  const signatures = [];
  const calldatas = [];
  const pushAction = (target, value, signature, calldataPar, calldataValues) => {
    targets.push(target);
    values.push(value);
    signatures.push(signature);
    calldatas.push(
      web3.eth.abi.encodeParameters(calldataPar, calldataValues)
    );
  };

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

    pushAction(attrs.idleTokenAddress, toBN('0'),
      'setAllAvailableTokensAndWrappers(address[],address[],uint256[],bool)',
      ['address[]', 'address[]', 'uint256[]', 'bool'],
      [tokens, wrappers, [20000, 20000, 10000, 50000], true]
    );
  }

  // Add one action to withdraw 3500 Idle from ecosystem fund
  pushAction(addresses.ecosystemFund, toBN('0'),
    'transfer(address,address,uint256)', ['address', 'address', 'uint256'],
    [addresses.IDLE, addresses.bountyAddressForEB, toBN('3500').times(toBN('1e18'))]
  );

  // Add one action to support IDLE distribution to idleWETH
  pushAction(addresses.idleController, toBN('0'),
    '_supportMarkets(address[])', ['address[]'], [[addresses.idleWETHV4]]
  );

  // Add one action to activate IDLE distribution to idleWETH
  pushAction(addresses.idleController, toBN('0'),
    '_addIdleMarkets(address[])', ['address[]'], [[addresses.idleWETHV4]]
  );

  let proposal = {
    targets: targets,
    values: values,
    signatures: signatures,
    calldatas: calldatas,
    description: 'add aavev2 wrapper',
    from: addresses.forkProposer
  }

  await createProposal(network, proposal);
  if (network === 'live') {
    return;
  }

  await web3.eth.sendTransaction({ from: TOKENS_HOLDER, to: addresses.timelock, value: "1000000000000000000" });

  // Test that idleWETH has a speed
  const idleCtrl = await IdleController.at(addresses.idleController);
  const idle = await IERC20.at(addresses.IDLE);
  const user = addresses.mintRedeemTestUser;
  console.log('balance', (await idle.balanceOf(addresses.bountyAddressForEB, {from: user})).toString());
  console.log('getAllMarkets', await idleCtrl.getAllMarkets({from: user}));
  console.log('speed idleDAIV4', (await idleCtrl.idleSpeeds(addresses.idleDAIV4, {from: user})).toString());
  console.log('speed idleUSDCV4', (await idleCtrl.idleSpeeds(addresses.idleUSDCV4, {from: user})).toString());
  console.log('speed idleWBTCV4', (await idleCtrl.idleSpeeds(addresses.idleWBTCV4, {from: user})).toString());
  console.log('speed idleWETHV4', (await idleCtrl.idleSpeeds(addresses.idleWETHV4, {from: user})).toString());

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
    const user = addresses.mintRedeemTestUser;
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
