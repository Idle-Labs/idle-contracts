const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');

const IdleCompound = artifacts.require('IdleCompound');
const cDAIMock = artifacts.require('cDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleCompound', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, someone, {from: creator});

    this.cDAIWrapper = await IdleCompound.new(
      this.cDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
  });

  it('constructor set a token address', async function () {
    (await this.cDAIWrapper.token()).should.equal(this.cDAIMock.address);
  });
  it('constructor set an underlying address', async function () {
    (await this.cDAIWrapper.underlying()).should.equal(this.DAIMock.address);
  });
  it('allows onlyOwner to setToken', async function () {
    const val = this.someAddr;
    await this.cDAIWrapper.setToken(val, { from: creator });
    (await this.cDAIWrapper.token()).should.equal(val);

    await expectRevert.unspecified(this.cDAIWrapper.setToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setUnderlying', async function () {
    const val = this.someAddr;
    await this.cDAIWrapper.setUnderlying(val, { from: creator });
    (await this.cDAIWrapper.underlying()).should.equal(val);

    await expectRevert.unspecified(this.cDAIWrapper.setUnderlying(val, { from: nonOwner }));
  });
});
