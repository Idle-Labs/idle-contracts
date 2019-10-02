const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');

const IdleFulcrum = artifacts.require('IdleFulcrum');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleFulcrum', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, someone, {from: creator});

    this.iDAIWrapper = await IdleFulcrum.new(
      this.iDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
  });

  it('constructor set a token address', async function () {
    (await this.iDAIWrapper.token()).should.equal(this.iDAIMock.address);
  });
  it('constructor set a underlying address', async function () {
    (await this.iDAIWrapper.underlying()).should.equal(this.DAIMock.address);
  });
  it('allows onlyOwner to setToken', async function () {
    const val = this.someAddr;
    await this.iDAIWrapper.setToken(val, { from: creator });
    (await this.iDAIWrapper.token()).should.equal(val);

    await expectRevert.unspecified(this.iDAIWrapper.setToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setUnderlying', async function () {
    const val = this.someAddr;
    await this.iDAIWrapper.setUnderlying(val, { from: creator });
    (await this.iDAIWrapper.underlying()).should.equal(val);

    await expectRevert.unspecified(this.iDAIWrapper.setUnderlying(val, { from: nonOwner }));
  });
});
