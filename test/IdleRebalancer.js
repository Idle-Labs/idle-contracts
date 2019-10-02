const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');

const IdleRebalancer = artifacts.require('IdleRebalancer');
const IdleCompound = artifacts.require('IdleCompound');
const IdleFulcrum = artifacts.require('IdleFulcrum');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleRebalancer', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, someone, {from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, someone, {from: creator});

    this.cDAIWrapper = await IdleCompound.new(
      this.cDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
    this.iDAIWrapper = await IdleFulcrum.new(
      this.iDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );

    this.IdleRebalancer = await IdleRebalancer.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.cDAIWrapper.address,
      this.iDAIWrapper.address,
      { from: creator }
    );
  });

  it('constructor set a token (DAI) address', async function () {
    (await this.IdleRebalancer.cToken()).should.equal(this.cDAIMock.address);
  });
  it('constructor set a iToken (iDAI) address', async function () {
    (await this.IdleRebalancer.iToken()).should.equal(this.iDAIMock.address);
  });
  it('constructor set a token (DAI) address', async function () {
    (await this.IdleRebalancer.cWrapper()).should.equal(this.cDAIWrapper.address);
  });
  it('constructor set a iToken (iDAI) address', async function () {
    (await this.IdleRebalancer.iWrapper()).should.equal(this.iDAIWrapper.address);
  });
  it('allows onlyOwner to setCToken', async function () {
    const val = this.someAddr;
    await this.IdleRebalancer.setCToken(val, { from: creator });
    (await this.IdleRebalancer.cToken()).should.equal(val);

    await expectRevert.unspecified(this.IdleRebalancer.setCToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setIToken', async function () {
    const val = this.someAddr;
    await this.IdleRebalancer.setIToken(val, { from: creator });
    (await this.IdleRebalancer.iToken()).should.equal(val);

    await expectRevert.unspecified(this.IdleRebalancer.setIToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setCTokenWrapper', async function () {
    const val = this.someAddr;
    await this.IdleRebalancer.setCTokenWrapper(val, { from: creator });
    (await this.IdleRebalancer.cWrapper()).should.equal(val);

    await expectRevert.unspecified(this.IdleRebalancer.setCTokenWrapper(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setITokenWrapper', async function () {
    const val = this.someAddr;
    await this.IdleRebalancer.setITokenWrapper(val, { from: creator });
    (await this.IdleRebalancer.iWrapper()).should.equal(val);

    await expectRevert.unspecified(this.IdleRebalancer.setITokenWrapper(val, { from: nonOwner }));
  });
});
