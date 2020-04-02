const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleDyDxNoConst = artifacts.require('IdleDyDxNoConst');
const yxTokenMock = artifacts.require('yxTokenMock');
const DyDxMock = artifacts.require('DyDxMock');
const DAIMock = artifacts.require('DAIMock');
const InterestSetterMock = artifacts.require('InterestSetterMock');
const BNify = n => new BN(String(n));

contract('IdleDyDx', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.DyDxMock = await DyDxMock.new(this.DAIMock.address, {from: creator});
    this.InterestSetterMock = await InterestSetterMock.new({from: creator});
    const marketId = 3;

    // this.yxDAI = await yxToken.new(
    this.yxDAIMock = await yxTokenMock.new(
      this.DAIMock.address,
      marketId,
      'yxDAI',
      'yxDAI',
      18,
      creator,
      {from: creator}
    );

    await this.yxDAIMock.setDyDxProvider(this.DyDxMock.address);

    this.yxDAIWrapper = await IdleDyDxNoConst.new(
      this.yxDAIMock.address,
      this.DAIMock.address,
      marketId,
      {from: creator}
    );
    await this.yxDAIWrapper.setIdleToken(nonOwner, {from: creator});
    await this.yxDAIWrapper.setDydxAddressesProvider(this.DyDxMock.address, {from: creator});
  });

  it('constructor set a token address', async function () {
    (await this.yxDAIWrapper.token()).should.equal(this.yxDAIMock.address);
  });
  it('constructor set an underlying address', async function () {
    (await this.yxDAIWrapper.underlying()).should.equal(this.DAIMock.address);
  });
  it('constructor set an market id', async function () {
    (await this.yxDAIWrapper.marketId()).should.be.bignumber.equal(BNify('3'));
  });
  it('constructor set an secondsInAYear', async function () {
    (await this.yxDAIWrapper.secondsInAYear()).should.be.bignumber.equal(BNify('31536000'));
  });
  it('allows onlyOwner to setIdleToken', async function () {
    const val = this.someAddr;
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await expectRevert(
      this.yxDAIWrapper.setIdleToken(val, { from: creator }),
      'idleToken addr already set'
    );

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.yxDAIWrapper.setIdleToken(val, { from: nonOwner }));
  });
  it('returns next supply rate given 0 amount', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    // set mock data in yxDAIMock
    await this.DyDxMock.setMarketTotalPar(one.mul(BNify('100')), big2.mul(BNify('100')));
    await this.DyDxMock.setMarketCurrentIndex(big2, one);
    await this.DyDxMock.setEarningsRate(BNify('950000000000000000')); // 0.95
    await this.DyDxMock.setMarketInterestSetter(this.InterestSetterMock.address);
    await this.InterestSetterMock.setInterestRate(big2.div(BNify('3153600000')));

    // borrow = 100 * 2
    // supply = 200 * 1
    // usage 1e18
    // aprBorrow = 2
    // 2 * 1 * 0.95 =  1.9%
    const nextSupplyInterestRateDyDx = await this.yxDAIWrapper.nextSupplyRate.call(BNify('0'));
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(BNify('1899999997976880000'));
  });
  it('returns next supply rate given amount != 0', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    // set mock data in DyDxMock
    // borrowPar = 100, supplyPar = 200
    await this.DyDxMock.setMarketTotalPar(one.mul(BNify('100')), big2.mul(BNify('100')));
    // borrowIndex = 2, supplyIndex = 1
    await this.DyDxMock.setMarketCurrentIndex(one, one);
    // 2 * 1e18 / 3153600000
    await this.InterestSetterMock.setInterestRate(big2.div(BNify('3153600000')));
    await this.DyDxMock.setMarketInterestSetter(this.InterestSetterMock.address);
    await this.DyDxMock.setEarningsRate(BNify('950000000000000000')); // 0.95
    const newAmount = one.mul(BNify('50'));

    // borrow = 100 * 1 = 100
    // supply = 200 * 1 + 50 = 250
    // usage with amount 0.4 * 1e18
    // aprBorrow = 2
    // 2 * 0.4 * 0.95 =  0.76
    const nextSupplyInterestRateDyDx = await this.yxDAIWrapper.nextSupplyRate.call(newAmount);
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(BNify('759999999190752000'));
  });
  it('nextSupplyRateWithParams', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    // set mock data in DyDxMock
    // borrowPar = 100, supplyPar = 200
    await this.DyDxMock.setMarketTotalPar(one.mul(BNify('100')), big2.mul(BNify('100')));
    // borrowIndex = 2, supplyIndex = 1
    await this.DyDxMock.setMarketCurrentIndex(one, one);
    // 2 * 1e18 / 3153600000
    await this.InterestSetterMock.setInterestRate(big2.div(BNify('3153600000')));
    await this.DyDxMock.setMarketInterestSetter(this.InterestSetterMock.address);
    await this.DyDxMock.setEarningsRate(BNify('950000000000000000')); // 0.95
    const newAmount = one.mul(BNify('50'));

    // borrow = 100 * 1 = 100
    // supply = 200 * 1 + 50 = 250
    // usage with amount 0.4 * 1e18
    // aprBorrow = 2
    // 2 * 0.4 * 0.95 =  0.76
    const nextSupplyInterestRateDyDx = await this.yxDAIWrapper.nextSupplyRateWithParams.call([newAmount]);
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(BNify('759999999190752000'));
  });
  it('getAPR', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    // set mock data in DyDxMock
    await this.DyDxMock.setMarketTotalPar(one.mul(BNify('100')), big2.mul(BNify('100')));
    await this.DyDxMock.setMarketCurrentIndex(big2, one);
    await this.DyDxMock.setMarketInterestSetter(this.InterestSetterMock.address);
    await this.InterestSetterMock.setInterestRate(big2.div(BNify('3153600000')));
    await this.DyDxMock.setEarningsRate(BNify('950000000000000000')); // 0.95

    // borrow = 100 * 2
    // supply = 200 * 1
    // usage 1e18
    // aprBorrow = 2
    // 2 * 1 * 0.95 =  1.9%
    const nextSupplyInterestRateDyDx = await this.yxDAIWrapper.getAPR.call();
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(BNify('1899999997976880000'));
  });
  it('getPriceInToken', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    // set mock data in yxDAIMock
    await this.DyDxMock.setMarketCurrentIndex(one, one.mul(BNify('100')));
    const nextSupplyInterestRateDyDx = await this.yxDAIWrapper.getPriceInToken.call();
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(one.mul(BNify('100')));
  });
  it('mint returns 0 if no tokens are presenti in this contract', async function () {
    const res = await this.yxDAIWrapper.mint.call({ from: nonOwner });
    res.should.be.bignumber.equal(BNify('0'));
  });
  it('mint creates yxTokens and it sends them to msg.sender', async function () {
    // deposit 100 DAI in yxDAIWrapper
    await this.DAIMock.transfer(this.yxDAIWrapper.address, BNify('100').mul(this.one), {from: creator});
    await this.DyDxMock.setMarketCurrentIndex(this.one, this.one.mul(BNify('2'))); // price 2
    await this.yxDAIMock.setPriceForTest(this.one.mul(BNify('2')));
    // mints in DyDx with 100 DAI
    const callRes = await this.yxDAIWrapper.mint.call({ from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(this.one.mul(BNify('50')));
    // do the effective tx
    await this.yxDAIWrapper.mint({ from: nonOwner });
    (await this.yxDAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('50000000000000000000'));
  });
  it('redeem creates yxTokens and it sends them to msg.sender', async function () {
    // fund DyDxMock with 100 DAI
    await this.DAIMock.transfer(this.yxDAIMock.address, BNify('100').mul(this.one), {from: creator});
    await this.DyDxMock.setMarketCurrentIndex(this.one, this.one.mul(BNify('2'))); // price 2
    await this.yxDAIMock.setPriceForTest(this.one.mul(BNify('2')));
    // deposit 50 yxDAI in yxDAIWrapper
    await this.yxDAIMock.transfer(this.yxDAIWrapper.address, BNify('50').mul(this.one), {from: creator});
    // redeem in DyDx with 50 yxDAI * 2 (price) = 100 DAI
    const callRes = await this.yxDAIWrapper.redeem.call(nonOwner, { from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('100').mul(this.one));
    // do the effective tx
    await this.yxDAIWrapper.redeem(nonOwner, { from: nonOwner });
    (await this.DAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('100').mul(this.one));
  });
  it('availableLiquidity', async function () {
    // fund DyDxMock with 100 DAI
    await this.DAIMock.transfer(this.DyDxMock.address, BNify('100').mul(this.one), {from: creator});
    const availableLiquidity = await this.yxDAIWrapper.availableLiquidity.call();
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    availableLiquidity.should.be.bignumber.equal(this.one.mul(BNify('100')));
  });
});
