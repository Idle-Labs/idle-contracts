const { BN } = require('@openzeppelin/test-helpers');
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const Foo = artifacts.require("Foo");

const toBN = n => new BN(n.toString());

contract("MinimalInitializableProxyFactory", ([_]) => {
  before(async () => {
    this.factory = await MinimalInitializableProxyFactory.new();
  });

  it("deploys a minimal proxy and initializes it", async () => {
    const implementation = await Foo.new(11);

    const initSig = "initialize(uint256)";
    const initData1 = web3.eth.abi.encodeParameters(['uint256'], [toBN(22)]);
    const res1 = await this.factory.createAndCall(implementation.address, initSig, initData1);
    const proxy1 = await Foo.at(res1.logs[0].args.proxy);

    const initData2 = web3.eth.abi.encodeParameters(['uint256'], [toBN(33)]);
    const res2 = await this.factory.createAndCall(implementation.address, initSig, initData2);
    const proxy2 = await Foo.at(res2.logs[0].args.proxy);

    const res3 = await this.factory.create(implementation.address);
    const proxy3 = await Foo.at(res3.logs[0].args.proxy);


    toBN(await implementation.x()).should.be.bignumber.equal(toBN("11"));
    toBN(await proxy1.x()).should.be.bignumber.equal(toBN("22"));
    toBN(await proxy2.x()).should.be.bignumber.equal(toBN("33"));
    toBN(await proxy3.x()).should.be.bignumber.equal(toBN(""));
  });
});

