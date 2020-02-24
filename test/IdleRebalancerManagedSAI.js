const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleRebalancerManagedSAI = artifacts.require('IdleRebalancerManagedSAI');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));
const WhitePaperMock = artifacts.require('WhitePaperMock');

contract('IdleRebalancerManagedSAI', function ([_, creator, manager, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.WhitePaperMock = await WhitePaperMock.new({from: creator});
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, creator, this.WhitePaperMock.address, {from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, creator, {from: creator});

    this.IdleRebalancerManagedSAI = await IdleRebalancerManagedSAI.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      { from: creator }
    );

    await this.IdleRebalancerManagedSAI.setIdleToken(creator, {from: creator});
    await this.IdleRebalancerManagedSAI.setRebalancerManager(manager, {from: creator});
  });

  it('constructor set a cToken address', async function () {
    (await this.IdleRebalancerManagedSAI.cToken()).should.equal(this.cDAIMock.address);
  });
  it('constructor set a iToken address', async function () {
    (await this.IdleRebalancerManagedSAI.iToken()).should.equal(this.iDAIMock.address);
  });
  it('constructor set default allocations', async function () {
    (await this.IdleRebalancerManagedSAI.lastAmounts(0)).should.be.bignumber.equal(BNify('10000'));
    (await this.IdleRebalancerManagedSAI.lastAmounts(1)).should.be.bignumber.equal(BNify('0'));
  });
  it('allows onlyOwner to setIdleToken', async function () {
    const val = this.someAddr;
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await expectRevert(
      this.IdleRebalancerManagedSAI.setIdleToken(val, { from: creator }),
      'idleToken addr already set'
    );

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.IdleRebalancerManagedSAI.setIdleToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setRebalancerManager', async function () {
    const val = this.someAddr;
    await this.IdleRebalancerManagedSAI.setRebalancerManager(manager, { from: creator });
    const newManager = await this.IdleRebalancerManagedSAI.rebalancerManager.call();
    newManager.should.be.equal(manager);
    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.IdleRebalancerManagedSAI.setRebalancerManager(val, { from: nonOwner }));
  });
  it('allows onlyRebalancer to setAllocations', async function () {
    const val = this.someAddr;
    await this.IdleRebalancerManagedSAI.setAllocations([BNify('5000'), BNify('5000')], { from: manager });
    (await this.IdleRebalancerManagedSAI.lastAmounts(0)).should.be.bignumber.equal(BNify('5000'));
    (await this.IdleRebalancerManagedSAI.lastAmounts(1)).should.be.bignumber.equal(BNify('5000'));

    await expectRevert(
      this.IdleRebalancerManagedSAI.setAllocations([BNify('0'), BNify('5000')], { from: manager }),
      'Not allocating 100%'
    );

    // it will revert with unspecified reason if called from a non rebalancer manager
    await expectRevert.unspecified(
      this.IdleRebalancerManagedSAI.setAllocations([BNify('5000'), BNify('5000')], { from: nonOwner })
    );
  });
  it('calcRebalanceAmounts', async function () {
    const val = this.someAddr;
    const resCall = await this.IdleRebalancerManagedSAI.calcRebalanceAmounts.call([BNify('100').mul(this.one)], { from: creator });
    // Initial allocation
    resCall[0][0].should.be.equal(this.cDAIMock.address);
    resCall[0][1].should.be.equal(this.iDAIMock.address);
    resCall[1][0].should.be.bignumber.equal(BNify('100').mul(this.one));
    resCall[1][1].should.be.bignumber.equal(BNify('0').mul(this.one));

    await this.IdleRebalancerManagedSAI.setAllocations([BNify('5000'), BNify('5000')], { from: manager });

    const resCall2 = await this.IdleRebalancerManagedSAI.calcRebalanceAmounts.call([BNify('100').mul(this.one)], { from: creator });
    resCall2[0][0].should.be.equal(this.cDAIMock.address);
    resCall2[0][1].should.be.equal(this.iDAIMock.address);
    resCall2[1][0].should.be.bignumber.equal(BNify('50').mul(this.one));
    resCall2[1][1].should.be.bignumber.equal(BNify('50').mul(this.one));
  });
});
