const IERC20 = artifacts.require("./IERC20Detailed.sol");
const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20Mintable = artifacts.require("./IERC20Mintable.sol");
const IdleTokenHelper = artifacts.require("./IdleTokenHelper.sol");
const IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const AaveLendingPoolProviderV2 = artifacts.require("AaveLendingPoolProviderV2");
const addresses = require('./addresses.js');
const { tokenUtils, log, toBN } = require("./utils");

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage') {
    return;
  }


  //TODO: REMOVE
  network = "matic";

  const chainId = await web3.eth.getChainId();
  const creator = addresses.creator;
  const whale = creator;
  const timelock = creator;
  log("creator", creator)

  // -----------------------------------
  // const erc20Utils = tokenUtils("18");
  // const maticUtils = tokenUtils("18");
  // log("account balance: ", maticUtils.toUnits(await web3.eth.getBalance(creator)));
  // const idleTokenAddress = addresses.maticIdleDAIV4;
  // const idleToken = await IdleTokenGovernance.at(idleTokenAddress);


  // // TEST using wrapper
  // const wmatic = await IERC20.at(addresses.WMATIC[network]);
  // const dai = await IERC20.at(addresses.DAI[network]);
  // const aDAI = await AToken.at(addresses.aDAIV2[network]);

  // daiUtils = tokenUtils(await dai.decimals());

  // log(await wmatic.name());
  // log(daiUtils.toUnits(await wmatic.balanceOf(idleToken.address)));

  // log(await dai.name());
  // log(daiUtils.toUnits(await dai.balanceOf(idleToken.address)));

  // // log(await aDAI.name());
  // // log(daiUtils.toUnits(await aDAI.balanceOf(idleToken.address)));

  // // console.log("rebalance...")
  // // await idleToken.rebalance({from: creator, chainId})
  // // console.log("done.")

  // log("creator dai", daiUtils.toUnits(await dai.balanceOf(creator)));
  // log("creator idleToken", daiUtils.toUnits(await idleToken.balanceOf(creator)));
  // log("creator wmatic", daiUtils.toUnits(await wmatic.balanceOf(creator)));
  // log("creator idleTokens", daiUtils.toUnits(await idleToken.balanceOf(creator)));
  // log("idleToken supply", daiUtils.toUnits(await idleToken.totalSupply()));
  // log("idleToken wmatic", daiUtils.toUnits(await wmatic.balanceOf(idleToken.address)));
  // log("idleToken dai", daiUtils.toUnits(await dai.balanceOf(idleToken.address)));
  // log("idleToken adai", daiUtils.toUnits(await aDAI.balanceOf(idleToken.address)));

  // return;
  // -----------------------------------

  ///////////////////
  // const deployWrapperProxy = async (proxyFactory, implementationAddress, tokenAddress, aaveV2AddressesProvider, idleTokenAddress, from) => {
  //   const initSig = "initialize(address,address,address)";
  //   const initData = web3.eth.abi.encodeParameters(
  //     ["address", "address", "address"],
  //     [tokenAddress, aaveV2AddressesProvider, idleTokenAddress]
  //   );

  //   console.log("initSig", initSig);
  //   console.log("initData", initData);

  //   const result = await proxyFactory.createAndCall(implementationAddress, initSig, initData, { from: from, chainId: chainId });
  //   const wrapperAddress = result.logs[0].args.proxy;
  //   return wrapperAddress;
  // }
  // const proxyFactory = await MinimalInitializableProxyFactory.at(addresses.minimalInitializableProxyFactory[network]);
  // let idleAaveV2Instance;
  // console.log("deploying IdleAaveV2 instance");
  // await deployer.deploy(IdleAaveV2, {from: creator, chainId: chainId}).then(instance => idleAaveV2Instance = instance)
  // console.log("idleAaveV2Instance instance deployed ", idleAaveV2Instance.address);


  // const provider = await AaveLendingPoolProviderV2.at(addresses.aaveAddressesProvider[network]);
  // console.log("->", addresses.aaveAddressesProvider[network])
  // console.log("+> ", await provider.getLendingPool())

  // console.log("deploying aave wrapper via proxy factory");
  // const aaveV2WrapperAddress = await deployWrapperProxy(proxyFactory, idleAaveV2Instance.address,
  //   addresses.aDAIV2[network], addresses.aaveAddressesProvider[network], addresses.maticIdleDAIV4, creator);
  // console.log("aaveV2WrapperAddress", aaveV2WrapperAddress);

  // const idleAaveV2 = await IdleAaveV2.at(aaveV2WrapperAddress);

  // await deployer.deploy(IdleTokenHelper);
  // const helper = await IdleTokenHelper.deployed();
  // console.log("helper", helper.address)
  // const aprs = await helper.getAPRs(addresses.maticIdleDAIV4);
  // console.log("aprs", aprs)
  ///////////////////
  // return;

  const maticUtils = tokenUtils("18");

  log("account balance: ", maticUtils.toUnits(await web3.eth.getBalance(creator)));
  const idleTokenAddress = addresses.maticIdleDAIV4;

  const dai = await IERC20Mintable.at(addresses.DAI[network]);
  const daiUtils = tokenUtils(await dai.decimals())
  // await dai.mint(daiUtils.fromUnits("20000"), { from: creator, chainId });
  log("dai balance", daiUtils.toUnits(await dai.balanceOf(creator)));

  const idleTokens = [
    addresses.maticIdleDAIV4,
  ]

  const setAllocationsAndRebalance = async (idleToken, allocations, unlent) => {
    const underlying = await idleToken.token();
    const underlyingContract = await IERC20.at(underlying);
    const tokenDecimals = await underlyingContract.decimals();
    const uUtils = tokenUtils(tokenDecimals);
    // console.log('tokenDecimals', tokenDecimals.toString());
    const oneToken = uUtils.fromUnits("1");
    console.log(`decimals: ${tokenDecimals}`)
    console.log("total supply", (await idleToken.totalSupply()).toString());

    // if (unlent) {
    //   console.log('whale transfer, balance is', (await underlyingContract.balanceOf(whale)).toString());
    //   const amount = uUtils.fromUnits(unlent);
    //   log("amount:", amount);
    //   await underlyingContract.transfer(idleToken.address, amount, {from: whale, chainId}); // whale
    //   console.log('whale transfer complete');
    // }

    log('# unlent balance: ', uUtils.toUnits(await underlyingContract.balanceOf(idleToken.address)));
    const tokens = (await idleToken.getAPRs())["0"];
    console.log("tokens", tokens.join(", "));
    const idleTokenName = await idleToken.name();
    console.log("curr allocations", allocations.toString());

    allocations = allocations.map(toBN);
    // add 1% to first protocol and remove 1% from last protocol
    if (allocations.length > 1) {
      allocations = allocations.map((a, i) => {
        if (i == 0 && allocations[allocations.length-1] > 0) return a.plus(toBN('1000'));
        if (i == allocations.length-1 && a > 0) return a.minus(toBN('1000'));
        return a;
      });
    }
    console.log("new allocations", allocations.toString());


    await idleToken.setAllocations(allocations, { from: timelock, chainId });
    const newAllocations = await idleToken.getAllocations();
    console.log("done setting allocations for", idleTokenName, "-", newAllocations.join(", "));
    console.log("rebalancing");
    const tx = await idleToken.rebalance({ from: timelock, chainId });
    console.log("⛽ rebalancing done GAS SPENT: ", tx.receipt.cumulativeGasUsed.toString())

    log('# unlent balance: ', uUtils.toUnits(await underlyingContract.balanceOf(idleToken.address)));
    for (var i = 0; i < tokens.length; i++) {
      const token = await IERC20.at(tokens[i]);
      const tokenDecimals = toBN(await token.decimals());
      const tUtils = tokenUtils(tokenDecimals);
      const name = await token.name();
      const balance = tUtils.toUnits(await token.balanceOf(idleToken.address));
      console.log("token balance", name, balance.toString());
      // console.log("token balance", name, tokens[i], balance.toString());
    };
  }

  for (let i = 0; i < idleTokens.length; i++) {
    const idleTokenAddress = idleTokens[i];
    const idleToken = await IdleTokenGovernance.at(idleTokenAddress);
    const underlyingToken = await IERC20.at(await idleToken.token());
    const idleTokenUtils = tokenUtils(await idleToken.decimals());
    const underlyingTokenUtils = tokenUtils(await underlyingToken.decimals());

    log("contract balance", underlyingTokenUtils.toUnit(await underlyingToken.balanceOf(idleTokenAddress)))
    log("total supply", idleTokenUtils.toUnit(await idleToken.totalSupply()))
    log("token price", idleTokenUtils.toUnit(await idleToken.tokenPrice()))

    // await underlyingToken.approve(idleTokenAddress, daiUtils.fromUnits("100000"), { from: creator, chainId });
    // await idleToken.mintIdleToken(daiUtils.fromUnits("10"), false, addresses.addr0, { from: creator, chainId });

    // log("contract balance", underlyingTokenUtils.toUnit(await underlyingToken.balanceOf(idleTokenAddress)))
    // log("total supply", idleTokenUtils.toUnit(await idleToken.totalSupply()))
    // log("token price", idleTokenUtils.toUnit(await idleToken.tokenPrice()))

    console.log("\n\n********************************* testing", await idleToken.name());
    console.log('idleToken price pre', (await idleToken.tokenPrice()).toString());
    await setAllocationsAndRebalance(idleToken, [100000], 0);
    // const amount = 10;
    // await setAllocationsAndRebalance(idleToken, await idleToken.getAllocations(), amount);
    // console.log('idleToken price after', (await idleToken.tokenPrice()).toString());
  }
}
