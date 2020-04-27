const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleRebalancerV3 = artifacts.require('IdleRebalancerV3');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleRebalancerV3', function ([_, creator, manager, nonOwner, someone, foo, idle]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.addr1 = '0x0000000000000000000000000000000000000001';
    this.addr2 = '0x0000000000000000000000000000000000000002';
    this.addr3 = '0x0000000000000000000000000000000000000003';
    this.addr4 = '0x0000000000000000000000000000000000000004';
    this.addrNew = '0x0000000000000000000000000000000000000005';

    this.RebalancerV3 = await IdleRebalancerV3.new(
      this.addr1,
      this.addr2,
      this.addr3,
      this.addr4,
      manager,
      { from: creator }
    );
    await this.RebalancerV3.setIdleToken(idle, {from: creator});
  });

  it('constructor set rebalanceManager addr', async function () {
    (await this.RebalancerV3.rebalancerManager()).should.equal(manager);
  });
  it('constructor set default allocations', async function () {
    (await this.RebalancerV3.lastAmounts(0)).should.be.bignumber.equal(BNify('100000'));
    (await this.RebalancerV3.lastAmounts(1)).should.be.bignumber.equal(BNify('0'));
    (await this.RebalancerV3.lastAmounts(2)).should.be.bignumber.equal(BNify('0'));
    (await this.RebalancerV3.lastAmounts(3)).should.be.bignumber.equal(BNify('0'));
  });
  it('constructor set default addresses', async function () {
    (await this.RebalancerV3.lastAmountsAddresses(0)).should.equal(this.addr1);
    (await this.RebalancerV3.lastAmountsAddresses(1)).should.equal(this.addr2);
    (await this.RebalancerV3.lastAmountsAddresses(2)).should.equal(this.addr3);
    (await this.RebalancerV3.lastAmountsAddresses(3)).should.equal(this.addr4);
  });
  it('allows onlyOwner to setRebalancerManager', async function () {
    const val = this.addr1;
    await this.RebalancerV3.setRebalancerManager(manager, { from: creator });
    const newManager = await this.RebalancerV3.rebalancerManager.call();
    newManager.should.be.equal(manager);
    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.RebalancerV3.setRebalancerManager(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setIdleToken', async function () {
    const val = this.addr1;
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await expectRevert(
      this.RebalancerV3.setIdleToken(val, { from: creator }),
      'idleToken addr already set'
    );

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.RebalancerV3.setIdleToken(val, { from: nonOwner }));
  });
  it('do not allow onlyOwner to setNewToken if the token is already present', async function () {
    const val = this.addr1;
    await this.RebalancerV3.setNewToken(val, { from: creator });
    // Test length
    await expectRevert(this.RebalancerV3.lastAmountsAddresses.call(4), "invalid opcode");
    await expectRevert(this.RebalancerV3.lastAmounts.call(4), "invalid opcode");
    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.RebalancerV3.setNewToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setNewToken if the token is new', async function () {
    const val = this.addrNew;
    await this.RebalancerV3.setNewToken(val, { from: creator });
    const newVal = await this.RebalancerV3.lastAmountsAddresses.call(4);
    newVal.should.be.equal(val);
    // No exception
    const newAmount = await this.RebalancerV3.lastAmounts.call(4);
    newAmount.should.be.bignumber.equal(BNify('0'));
    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.RebalancerV3.setNewToken(val, { from: nonOwner }));
  });
  it('getAllocations', async function () {
    const alloc = await this.RebalancerV3.getAllocations();
    alloc[0].should.be.bignumber.equal(BNify('100000'));
    alloc[1].should.be.bignumber.equal(BNify('0'));
    alloc[2].should.be.bignumber.equal(BNify('0'));
    alloc[3].should.be.bignumber.equal(BNify('0'));
  });
  it('allows onlyRebalancer and Idle to setAllocations', async function () {
    await this.RebalancerV3.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.addr1, this.addr2, this.addr3, this.addr4],
      { from: manager }
    );
    (await this.RebalancerV3.lastAmounts(0)).should.be.bignumber.equal(BNify('50000'));
    (await this.RebalancerV3.lastAmounts(1)).should.be.bignumber.equal(BNify('50000'));
    (await this.RebalancerV3.lastAmounts(2)).should.be.bignumber.equal(BNify('0'));
    (await this.RebalancerV3.lastAmounts(3)).should.be.bignumber.equal(BNify('0'));

    await this.RebalancerV3.setAllocations(
      [BNify('20000'), BNify('80000'), BNify('0'), BNify('0')],
      [this.addr1, this.addr2, this.addr3, this.addr4],
      { from: idle }
    );
    (await this.RebalancerV3.lastAmounts(0)).should.be.bignumber.equal(BNify('20000'));
    (await this.RebalancerV3.lastAmounts(1)).should.be.bignumber.equal(BNify('80000'));
    (await this.RebalancerV3.lastAmounts(2)).should.be.bignumber.equal(BNify('0'));
    (await this.RebalancerV3.lastAmounts(3)).should.be.bignumber.equal(BNify('0'));

    await expectRevert(
      this.RebalancerV3.setAllocations(
        [BNify('5000'), BNify('0'), BNify('0'), BNify('0')],
        [this.addr1, this.addr2, this.addr3, this.addr4],
        { from: manager }
      ),
      'Not allocating 100%'
    );
    await expectRevert(
      this.RebalancerV3.setAllocations(
        [BNify('5000'), BNify('5000')],
        [this.addr1, this.addr2, this.addr3, this.addr4],
        { from: manager }
      ),
      'Alloc lengths are different, allocations'
    );
    await expectRevert(
      this.RebalancerV3.setAllocations(
        [BNify('5000'), BNify('0'), BNify('0'), BNify('0')],
        // swapped addresses
        [this.addr2, this.addr1, this.addr3, this.addr4],
        { from: manager }
      ),
      'Addresses do not match'
    );

    // it will revert with unspecified reason if called from a non rebalancer manager
    await expectRevert.unspecified(
      this.RebalancerV3.setAllocations([BNify('0')], [this.addr1], { from: nonOwner })
    );
  });
});
