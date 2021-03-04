const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const Foo = artifacts.require("Foo");
const addresses = require("./addresses");
const { BN } = require('@openzeppelin/test-helpers');

const toBN = n => new BN(n.toString());

const check = (a, b, message) => {
  a = a.toString();
  b = b.toString();
  let [icon, symbol] = a.toString() === b ? ["✔️", "==="] : ["🚨🚨🚨", "!=="];
  console.log(`${icon}  `, a, symbol, b, message ? message : "");
}

module.exports = async (deployer, network) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  await deployer.deploy(MinimalInitializableProxyFactory);
  const factory = await MinimalInitializableProxyFactory.deployed();
  console.log(`factory deployed at https://kovan.etherscan.io/address/${factory.address}`);

  await deployer.deploy(Foo, [toBN(11)]);
  const implementation = await Foo.deployed();
  console.log(`implementation deployed at https://kovan.etherscan.io/address/${implementation.address}`);

  const initSig = "initialize(uint256)";
  const initData1 = web3.eth.abi.encodeParameters(['uint256'], [toBN(22)]);
  const result1 = await factory.createAndCall(implementation.address, initSig, initData1);
  const proxy1 = await Foo.at(result1.logs[0].args.proxy);
  console.log(`proxy1 deployed at https://kovan.etherscan.io/address/${proxy1.address}`);

  const initData2 = web3.eth.abi.encodeParameters(['uint256'], [toBN(33)]);
  const result2 = await factory.createAndCall(implementation.address, initSig, initData2);
  const proxy2 = await Foo.at(result2.logs[0].args.proxy);
  console.log(`proxy2 deployed at https://kovan.etherscan.io/address/${proxy2.address}`);

  const result3 = await factory.create(implementation.address);
  const proxy3 = await Foo.at(result3.logs[0].args.proxy);
  console.log(`proxy3 deployed at https://kovan.etherscan.io/address/${proxy3.address}`);

  check(toBN(await implementation.x()), toBN("11"));
  check(toBN(await proxy1.x()), toBN("22"));
  check(toBN(await proxy2.x()), toBN("33"));
  check(toBN(await proxy3.x()), toBN("0"));
}
