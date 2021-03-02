const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const IERC20 = artifacts.require("IERC20.sol");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");

const toBN = v => new BigNumber(v.toString());
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

const test = async (deployer, token, underlying, decimals) => {
  await deployer.deploy(MinimalInitializableProxyFactory);
  const proxyFactory = await MinimalInitializableProxyFactory.deployed();
  console.log("MinimalInitializableProxyFactory deployed at", proxyFactory.address);

  await deployer.deploy(IdleAaveV2)
  const wrapperImplementation = await IdleAaveV2.deployed();

  const initSig = "initialize(address,address,address)";
  const initData = web3.eth.abi.encodeParameters(
    ["address", "address", "address"],
    [token, "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5", TOKENS_HOLDER]
  );

  const receipt = await proxyFactory.create(wrapperImplementation.address, initSig, initData);
  const wrapper = await IdleAaveV2.at(receipt.logs[0].args.proxy);

  const DAI = await IERC20.at(underlying);
  const aDAI = await IERC20.at(token);

  const ONE_DECIMALS = toBN("10").pow(decimals);
  const fromUnderlyingTokenUnits = u => toBN(u).times(ONE_DECIMALS);
  const toUnit = v => v.div(ONE_DECIMALS);
  const toUnitString = v => toUnit(v).toString();

  const depositValue = fromUnderlyingTokenUnits("100");

  const initialLiquidity = toBN(await wrapper.availableLiquidity());
  console.log("initialLiquidity", toUnitString(initialLiquidity));
  check(toBN(await DAI.balanceOf(token)), initialLiquidity, "availableLiquidity should return IERC20(underlying).balanceOf(aDAI)");

  const nsr = toBN(await wrapper.nextSupplyRate(depositValue));
  console.log("nextSupplyRate", toUnitString(nsr))

  const cp = toBN(await wrapper.getPriceInToken());
  console.log("getPriceInToken", toUnitString(cp));

  const apr = toBN(await wrapper.getAPR());
  console.log("getAPR", toUnitString(apr));

  const amounts = [0, 1e3, 1e5, 1e6, 1e7];
  for (var i = 0; i < amounts.length; i++) {
    const amount = fromUnderlyingTokenUnits(amounts[i]);
    const nsr = toBN(await wrapper.nextSupplyRate(amount));
    console.log(`nextSupplyRate(${toUnitString(amount)})`, toUnitString(nsr));
  };


  const initialWrapperADAIBalance = toBN(await aDAI.balanceOf(wrapper.address));
  const initialWrapperDAIBalance = toBN(await DAI.balanceOf(wrapper.address));

  // TOKENS_HOLDER sends 100 DAI to wrapper
  await DAI.transfer(wrapper.address, depositValue, { from: TOKENS_HOLDER });
  check((await DAI.balanceOf(wrapper.address)), initialWrapperADAIBalance.plus(depositValue), `wrapper should have ${toUnitString(depositValue)} DAI`);

  // TOKENS_HOLDER calls mint
  const aDAIBalanceBeforeMint = toBN(await aDAI.balanceOf(TOKENS_HOLDER));
  const mintedValue = toBN(await DAI.balanceOf(wrapper.address));
  console.log("mint")
  await wrapper.mint({ from: TOKENS_HOLDER });

  check(toBN(await DAI.balanceOf(token)), initialLiquidity.plus(mintedValue), "liquidity should increase");
  const aDAIBalanceAfterMint = toBN(await aDAI.balanceOf(TOKENS_HOLDER));
  check(aDAIBalanceAfterMint, aDAIBalanceBeforeMint.plus(mintedValue), `TOKENS_HOLDER's aDAI balance should increase by ${toUnitString(mintedValue)}`);
  check(await aDAI.balanceOf(wrapper.address), "0", "wrapper should have 0 aDAI");

  // TOKENS_HOLDER sends aDAI to wrapper
  await aDAI.transfer(wrapper.address, aDAIBalanceAfterMint, { from: TOKENS_HOLDER });
  check(await aDAI.balanceOf(wrapper.address), aDAIBalanceAfterMint, `wrapper should have received ${toUnitString(aDAIBalanceAfterMint)} aDAI`);

  // TOKENS_HOLDER calls redeem
  console.log("redeem")
  await wrapper.redeem(TOKENS_HOLDER, { from: TOKENS_HOLDER });
  check(await aDAI.balanceOf(wrapper.address), "0", `wrapper should have 0 aDAI`);

  checkIncreased(aDAIBalanceAfterMint, await aDAI.balanceOf(TOKENS_HOLDER), "TOKENS_HOLDER should have received aDAI");
};

module.exports = async (deployer, network) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  await test(deployer, addresses.aDAIV2.live, addresses.DAI.live, 18);
  await test(deployer, addresses.aUSDCV2.live, addresses.USDC.live, 6);
}
