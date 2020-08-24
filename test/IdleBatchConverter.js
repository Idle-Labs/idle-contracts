const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleBatchConverter = artifacts.require('IdleBatchConverter');
const idleNewBatchMock = artifacts.require('IdleNewBatchMock');
const idleBatchMock = artifacts.require('IdleBatchMock');
const BNify = n => new BN(String(n));

contract('IdleBatchConverter', function ([_, creator, manager, nonOwner, someone, foo, idle]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.addr1 = '0x0000000000000000000000000000000000000001';
    this.addr2 = '0x0000000000000000000000000000000000000002';
    this.addr3 = '0x0000000000000000000000000000000000000003';
    this.addr4 = '0x0000000000000000000000000000000000000004';
    this.addrNew = '0x0000000000000000000000000000000000000005';

    this.oldIdle = await idleBatchMock.new({from: creator});
    this.newIdle = await idleNewBatchMock.new({from: creator});

    this.converter = await IdleBatchConverter.new({ from: creator });

    await this.converter.initialize(this.oldIdle.address, this.newIdle.address, {from: creator});
  });

  it('constructor set rebalanceManager addr', async function () {
    (await this.converter.idleToken()).should.equal(this.oldIdle.address);
    (await this.converter.newIdleToken()).should.equal(this.newIdle.address);
  });
  it('cannot withdraw before first migration', async function () {
    await this.oldIdle.transfer(manager, this.one.mul(BNify('100')), {from: creator});
    await this.newIdle.setAmountToMint(this.one.mul(BNify('200')));

    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: manager});
    await this.converter.deposit({from: manager});
    await expectRevert(
      this.converter.withdraw(BNify('0'), {from: manager}),
      'Batch id invalid'
    )
    await expectRevert(
      this.converter.withdraw(BNify('1'), {from: manager}),
      'Batch id invalid'
    )
  });
  it('single user migration', async function () {
    await this.oldIdle.transfer(manager, this.one.mul(BNify('100')), {from: creator});
    await this.newIdle.setAmountToMint(this.one.mul(BNify('200')));

    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: manager});
    await this.converter.deposit({from: manager});
    await this.converter.migrateFromToIdle(true, {from: creator});
    await this.converter.withdraw(BNify('0'), {from: manager});

    const bal = BNify(await this.newIdle.balanceOf(manager));
    bal.should.be.bignumber.equal(this.one.mul(BNify('200')));
  });
  it('multiple user migration, single batch', async function () {
    await this.oldIdle.transfer(manager, this.one.mul(BNify('100')), {from: creator});
    await this.oldIdle.transfer(someone, this.one.mul(BNify('200')), {from: creator});
    await this.newIdle.setAmountToMint(this.one.mul(BNify('600')));

    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: manager});
    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: someone});

    await this.converter.deposit({from: manager});
    await this.converter.deposit({from: someone});
    await this.converter.migrateFromToIdle(true, {from: creator});
    await this.converter.withdraw(BNify('0'), {from: manager});
    await this.converter.withdraw(BNify('0'), {from: someone});

    const bal = BNify(await this.newIdle.balanceOf(manager));
    bal.should.be.bignumber.equal(this.one.mul(BNify('200')));
    const bal2 = BNify(await this.newIdle.balanceOf(someone));
    bal2.should.be.bignumber.equal(this.one.mul(BNify('400')));
  });
  it('multiple user migration, multiple batch', async function () {
    await this.oldIdle.transfer(manager, this.one.mul(BNify('100')), {from: creator});
    await this.oldIdle.transfer(someone, this.one.mul(BNify('200')), {from: creator});
    await this.oldIdle.transfer(foo, this.one.mul(BNify('200')), {from: creator});
    await this.oldIdle.transfer(nonOwner, this.one.mul(BNify('400')), {from: creator});

    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: manager});
    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: someone});
    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: foo});
    await this.oldIdle.approve(this.converter.address, BNify('-1'), {from: nonOwner});

    await this.converter.deposit({from: manager});
    await this.converter.deposit({from: someone});
    await this.newIdle.setAmountToMint(this.one.mul(BNify('600')));
    await this.converter.migrateFromToIdle(true, {from: creator});
    await this.converter.withdraw(BNify('0'), {from: manager});
    await this.converter.deposit({from: foo});
    await this.converter.deposit({from: nonOwner});
    await this.newIdle.setAmountToMint(this.one.mul(BNify('300')));
    await this.converter.migrateFromToIdle(true, {from: creator});
    await this.converter.withdraw(BNify('0'), {from: foo});
    await this.converter.withdraw(BNify('0'), {from: nonOwner});
    // foo and nonOwner deposited on batch 1 so should redeem 0 here
    const balFoo = BNify(await this.newIdle.balanceOf(foo));
    balFoo.should.be.bignumber.equal(this.one.mul(BNify('0')));
    const balNonOwner = BNify(await this.newIdle.balanceOf(nonOwner));
    balNonOwner.should.be.bignumber.equal(this.one.mul(BNify('0')));

    await this.converter.withdraw(BNify('0'), {from: someone});
    await this.converter.withdraw(BNify('1'), {from: nonOwner});
    await this.converter.withdraw(BNify('1'), {from: foo});

    const bal = BNify(await this.newIdle.balanceOf(manager));
    bal.should.be.bignumber.equal(this.one.mul(BNify('200')));
    const bal2 = BNify(await this.newIdle.balanceOf(someone));
    bal2.should.be.bignumber.equal(this.one.mul(BNify('400')));
    const bal3 = BNify(await this.newIdle.balanceOf(foo));
    bal3.should.be.bignumber.equal(this.one.mul(BNify('100')));
    const bal4 = BNify(await this.newIdle.balanceOf(nonOwner));
    bal4.should.be.bignumber.equal(this.one.mul(BNify('200')));
  });
});
