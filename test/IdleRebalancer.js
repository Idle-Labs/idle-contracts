const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');

const IdleRebalancer = artifacts.require('IdleRebalancer');
const IdleCompound = artifacts.require('IdleCompound');
const IdleFulcrum = artifacts.require('IdleFulcrum');
const WhitePaperMock = artifacts.require('WhitePaperMock');
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
    this.WhitePaperMock = await WhitePaperMock.new({from: creator});
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, creator, this.WhitePaperMock.address, {from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, creator, {from: creator});

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
  it('allows onlyOwner to setMaxIterations', async function () {
    const val = BNify('50');
    await this.IdleRebalancer.setMaxIterations(val, { from: creator });
    (await this.IdleRebalancer.maxIterations()).should.be.bignumber.equal(val);

    await expectRevert.unspecified(this.IdleRebalancer.setMaxIterations(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setMaxRateDifference', async function () {
    const val = BNify('50');
    await this.IdleRebalancer.setMaxRateDifference(val, { from: creator });
    (await this.IdleRebalancer.maxRateDifference()).should.be.bignumber.equal(val);

    await expectRevert.unspecified(this.IdleRebalancer.setMaxRateDifference(val, { from: nonOwner }));
  });

  it('calcRebalanceAmounts', async function () {
    const newDAIAmount = BNify('100000000').mul(this.one); // 100.000.000 DAI

    // set Params for cDAIMock
    const val = [];
    val[0] = BNify('1000000000000000000'), // 10 ** 18;
    val[1] = BNify('50000000000000000'), // white.baseRate();
    val[2] = BNify('23226177266611090600484812'), // cToken.totalBorrows();
    val[3] = BNify('120000000000000000'), // white.multiplier();
    val[4] = BNify('108083361138278343025995'), // cToken.totalReserves();
    val[5] = BNify('950000000000000000'), // j.sub(cToken.reserveFactorMantissa());
    val[6] = BNify('12471299241106729195006665'), // cToken.getCash();
    val[7] = BNify('2102400'), // cToken.blocksInAYear();
    val[8] = BNify('100'), // 100;

    // set mock data in cDAIMock
    await this.cDAIMock.setParams(val);

    // set Params for iDAIMock
    const valFulcrum = [];
    valFulcrum[0] = BNify('15477397326696356896'), // iToken.avgBorrowInterestRate()
    valFulcrum[1] = BNify('126330399262842122707083'), // totalAssetBorrow;
    valFulcrum[2] = BNify('838941079486105304319308'), // totalAssetSupply();
    valFulcrum[3] = BNify('90000000000000000000'), // spreadMultiplier();

    // set mock data in cDAIMock
    await this.iDAIMock.setParams(valFulcrum);
    const res = await this.IdleRebalancer.calcRebalanceAmounts(newDAIAmount, { from: creator });

    res.tokenAddresses[0].should.be.equal(this.cDAIMock.address);
    res.tokenAddresses[1].should.be.equal(this.iDAIMock.address);
    res.amounts[0].should.be.bignumber.equal(BNify('99697793203834249560105414')); // 99704548 DAI compound
    res.amounts[1].should.be.bignumber.equal(BNify('302206796165750439894586')); // 295451 DAI fulcrum
  });
});
