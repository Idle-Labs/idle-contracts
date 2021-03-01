const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleCompoundETH = artifacts.require('IdleCompoundETH');
const WhitePaperMock = artifacts.require('WhitePaperMock');
const cWETHMock = artifacts.require('cWETHMock');
const WETHMock = artifacts.require('WETHMock');
const BNify = n => new BN(String(n));

contract('IdleCompoundETH', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.oneCToken = new BN('100000000'); // 8 decimals
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.WETHMock = await WETHMock.new({from: creator});
    await this.WETHMock.deposit({from: creator, value: this.one.mul(BNify('2'))})
    this.WhitePaperMock = await WhitePaperMock.new({from: creator});
    this.cWETHMock = await cWETHMock.new(this.WETHMock.address, creator, this.WhitePaperMock.address, {from: creator});
    this.cWETHWrapper = await IdleCompoundETH.new(
      this.cWETHMock.address,
      this.WETHMock.address,
      nonOwner,
      {from: creator}
    );
  });

  it('constructor set a token address', async function () {
    (await this.cWETHWrapper.token()).should.equal(this.cWETHMock.address);
  });
  it('constructor set an underlying address', async function () {
    (await this.cWETHWrapper.underlying()).should.equal(this.WETHMock.address);
  });
  it('constructor set an underlying address', async function () {
    (await this.cWETHWrapper.idleToken()).should.equal(nonOwner);
  });
  it('allows onlyOwner to setBlocksPerYear', async function () {
    const val = BNify('2425846');
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await this.cWETHWrapper.setBlocksPerYear(val, { from: creator });
    (await this.cWETHWrapper.blocksPerYear()).should.be.bignumber.equal(val);

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.cWETHWrapper.setBlocksPerYear(val, { from: nonOwner }));
  });
  it('returns next supply rate given amount', async function () {
    const val = [];
    val[0] = BNify('1000000000000000000'), // 10 ** 18;
    val[1] = BNify('50000000000000000'), // white.baseRate();
    val[2] = BNify('23235999897534012338929659'), // cToken.totalBorrows();
    val[3] = BNify('120000000000000000'), // white.multiplier();
    val[4] = BNify('107742405685625342683992'), // cToken.totalReserves();
    val[5] = BNify('950000000000000000'), // j.sub(cToken.reserveFactorMantissa());
    val[6] = BNify('11945633145364637018215366'), // cToken.getCash();
    val[7] = BNify('2371428'), // cToken.blocksPerYear();
    val[8] = BNify('100'), // 100;
    val[9] = BNify('10000000000000000000000') // 10**22 -> 10000 DAI newAmountSupplied;

    // set mock data in cWETHMock
    await this.cWETHMock.setParams(val);

    const nextSupplyInterestRateCompound = await this.cWETHWrapper.nextSupplyRate.call(val[9]);

    // rename params for compound formula
    const j = val[0]; // 10 ** 18;
    const a = val[1]; // white.baseRate(); // from WhitePaper
    const b = val[2]; // cToken.totalBorrows();
    const c = val[3]; // white.multiplier(); // from WhitePaper
    const d = val[4]; // cToken.totalReserves();
    const e = val[5]; // j.sub(cToken.reserveFactorMantissa());
    const s = val[6]; // cToken.getCash();
    const k = val[7]; // cToken.blocksPerYear();
    const f = val[8]; // 100;
    const x = val[9]; // newAmountSupplied;

    // q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f -> to get yearly rate
    const expectedRes = a.add(b.mul(c).div(b.add(s).add(x))).div(k).mul(e).mul(b).div(
      s.add(x).add(b).sub(d)
    ).div(j).mul(k).mul(f); // to get the yearly rate

    nextSupplyInterestRateCompound.should.not.be.bignumber.equal(BNify('0'));
    nextSupplyInterestRateCompound.should.be.bignumber.equal(expectedRes);
  });
  it('returns next supply rate given params (counting fee)', async function () {
    // tested with data and formula from task idleDAI:rebalanceCalc -> targetSupplyRateWithFeeCompound
    const val = [];
    val[0] = BNify('1000000000000000000'), // 10 ** 18;
    val[1] = BNify('50000000000000000'), // white.baseRate();
    val[2] = BNify('23235999897534012338929659'), // cToken.totalBorrows();
    val[3] = BNify('120000000000000000'), // white.multiplier();
    val[4] = BNify('107742405685625342683992'), // cToken.totalReserves();
    val[5] = BNify('950000000000000000'), // j.sub(cToken.reserveFactorMantissa());
    val[6] = BNify('11945633145364637018215366'), // cToken.getCash();
    val[7] = BNify('2102400'), // cToken.blocksPerYear();
    val[8] = BNify('100'), // 100;
    val[9] = BNify('10000000000000000000000') // 10**22 -> 10000 DAI newAmountSupplied;

    const res = await this.cWETHWrapper.nextSupplyRateWithParams.call(val, { from: nonOwner });

    const j = val[0]; // 10 ** 18;
    const a = val[1]; // white.baseRate(); // from WhitePaper
    const b = val[2]; // cToken.totalBorrows();
    const c = val[3]; // white.multiplier(); // from WhitePaper
    const d = val[4]; // cToken.totalReserves();
    const e = val[5]; // j.sub(cToken.reserveFactorMantissa());
    const s = val[6]; // cToken.getCash();
    const k = val[7]; // cToken.blocksPerYear();
    const f = val[8]; // 100;
    const x = val[9]; // newAmountSupplied;

    // q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f -> to get yearly rate
    const expectedRes = a.add(b.mul(c).div(b.add(s).add(x))).div(k).mul(e).mul(b).div(
      s.add(x).add(b).sub(d)
    ).div(j).mul(k).mul(f); // to get the yearly rate

    res.should.not.be.bignumber.equal(BNify('0'));
    res.should.be.bignumber.equal(expectedRes);
  });
  it('getPriceInToken returns cToken price', async function () {
    const res = await this.cWETHWrapper.getPriceInToken.call({ from: nonOwner });
    const expectedRes = BNify(await this.cWETHMock.exchangeRateStored.call());
    res.should.be.bignumber.equal(expectedRes);
    res.should.be.bignumber.equal('200000000000000000000000000');
  });
  it('getAPR returns current yearly rate (counting fee)', async function () {
    const res = await this.cWETHWrapper.getAPR.call({ from: nonOwner });

    const rate = await this.cWETHMock.supplyRatePerBlock.call();
    const blocksPerYear = 2371428;
    const expectedRes = BNify(rate).mul(BNify(blocksPerYear)).mul(BNify('100'));
    res.should.not.be.bignumber.equal(BNify('0'));
    res.should.be.bignumber.equal(expectedRes);
  });
  it('mint returns 0 if no tokens are present in this contract', async function () {
    const res = await this.cWETHWrapper.mint.call({ from: nonOwner });
    res.should.be.bignumber.equal(BNify('0'));
  });
  it('mint creates cTokens and it sends them to msg.sender', async function () {
    // deposit 1 WETH in cWETHWrapper
    await this.WETHMock.transfer(this.cWETHWrapper.address, BNify('1').mul(this.one), {from: creator});
    // mints in Compound with 1 ETH
    const callRes = await this.cWETHWrapper.mint.call({ from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('5000000000'));
    // do the effective tx
    await this.cWETHWrapper.mint({ from: nonOwner });
    (await this.cWETHMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('5000000000'));
  });
  it('redeem creates cTokens and it sends them to msg.sender', async function () {
    await web3.eth.sendTransaction({from: creator, value: this.one.mul(BNify('2')), to: this.cWETHMock.address});
    // deposit 5000 cDAI in cWETHWrapper
    await this.cWETHMock.transfer(this.cWETHWrapper.address, BNify('50').mul(this.oneCToken), {from: creator});
    // redeem in Compound with 50 cDAI * 0.02 (price) = 1 ETH
    const callRes = await this.cWETHWrapper.redeem.call(nonOwner, { from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('1').mul(this.one));
    // do the effective tx
    await this.cWETHWrapper.redeem(nonOwner, { from: nonOwner });
    (await this.WETHMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('1').mul(this.one));
  });
});
