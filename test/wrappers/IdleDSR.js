const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleDSRNoConst = artifacts.require('IdleDSRNoConst');
const CHAIMock = artifacts.require('CHAIMock');
const PotLikeMock = artifacts.require('PotLikeMock');
const DAIMock = artifacts.require('DAIMock');
const InterestSetterMock = artifacts.require('InterestSetterMock');
const BNify = n => new BN(String(n));

contract('IdleDSR', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.oneRay = new BN('1000000000000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.PotLikeMock = await PotLikeMock.new(this.DAIMock.address, {from: creator});

    this.CHAIMock = await CHAIMock.new(
      this.DAIMock.address,
      creator,
      {from: creator}
    );

    this.CHAIWrapper = await IdleDSRNoConst.new(
      this.CHAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
    await this.CHAIWrapper.setIdleToken(nonOwner, {from: creator});
    await this.CHAIWrapper.setPotLike(this.PotLikeMock.address, {from: creator});
  });

  it('constructor set a token address', async function () {
    (await this.CHAIWrapper.token()).should.equal(this.CHAIMock.address);
  });
  it('constructor set an underlying address', async function () {
    (await this.CHAIWrapper.underlying()).should.equal(this.DAIMock.address);
  });
  it('constructor set CHAI contract infinite allowance to spend our DAI', async function () {
    (await this.DAIMock.allowance(this.CHAIWrapper.address, this.CHAIMock.address)).should.be.bignumber.equal(BNify('115792089237316195423570985008687907853269984665640564039457584007913129639935'));
  });
  it('constructor set an secondsInAYear', async function () {
    (await this.CHAIWrapper.secondsInAYear()).should.be.bignumber.equal(BNify('31536000'));
  });
  it('allows onlyOwner to setIdleToken', async function () {
    const val = this.someAddr;
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await expectRevert(
      this.CHAIWrapper.setIdleToken(val, { from: creator }),
      'idleToken addr already set'
    );

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.CHAIWrapper.setIdleToken(val, { from: nonOwner }));
  });
  it('returns next supply rate given 0 amount', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    // set mock data in yxDAIMock
    await this.PotLikeMock.setDsr(big2.mul(BNify('1000000000')).div(BNify('31536000')).div(BNify('100')).add(this.oneRay));
    const nextSupplyInterestRateDSR = await this.CHAIWrapper.nextSupplyRate.call(BNify('0'));
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDSR.should.be.bignumber.equal(BNify('1999999999999999900'));
  });
  it('returns next supply rate given amount != 0', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));
    const newAmount = one.mul(BNify('50'));

    await this.PotLikeMock.setDsr(big2.mul(BNify('1000000000')).div(BNify('31536000')).div(BNify('100')).add(this.oneRay));
    const nextSupplyInterestRateDyDx = await this.CHAIWrapper.nextSupplyRate.call(newAmount);
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(BNify('1999999999999999900'));
  });
  it('nextSupplyRateWithParams', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    // borrowPar = 100, supplyPar = 200
    await this.PotLikeMock.setDsr(big2.mul(BNify('1000000000')).div(BNify('31536000')).div(BNify('100')).add(this.oneRay));
    const newAmount = one.mul(BNify('50'));
    const nextSupplyInterestRateDyDx = await this.CHAIWrapper.nextSupplyRateWithParams.call([newAmount]);
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(BNify('1999999999999999900'));
  });
  it('getAPR', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    await this.PotLikeMock.setDsr(big2.mul(BNify('1000000000')).div(BNify('31536000')).div(BNify('100')).add(this.oneRay));
    const nextSupplyInterestRateDyDx = await this.CHAIWrapper.getAPR.call();
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    nextSupplyInterestRateDyDx.should.be.bignumber.equal(BNify('1999999999999999900'));
  });
  it('getPriceInToken when now < rho', async function () {
    const one = this.one;
    const big2 = this.one.mul(BNify('2'));

    await this.PotLikeMock.setDsr(big2.mul(BNify('1000000000')).div(BNify('31536000')).div(BNify('100')).add(this.oneRay));
    await this.PotLikeMock.setRho(big2.mul(BNify('1000000000000')));
    await this.PotLikeMock.setChi(this.oneRay.mul(BNify('2')));

    const price = await this.CHAIWrapper.getPriceInToken.call();
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    price.should.be.bignumber.equal(one.mul(BNify('2')));
  });
  // it('getPriceInToken when now > rho', async function () {
  //   const one = this.one;
  //   const big2 = this.one.mul(BNify('2'));
  //
  //   await this.PotLikeMock.setDsr(big2.mul(BNify('1000000000')).div(BNify('31536000')).div(BNify('100')).add(this.oneRay));
  //   await this.PotLikeMock.setRho(BNify('1585846799'));
  //   await this.PotLikeMock.setChi(this.oneRay.mul(BNify('2')));
  //
  //   const price = await this.CHAIWrapper.getPriceInToken.call();
  //   console.log(price.toString());
  //   // minor rounding issue due to the calculation of the rate per block for the actual annual rate
  //   price.should.be.bignumber.equal(BNify('2000003626335097686'));
  // });
  it('mint returns 0 if no tokens are present in this contract', async function () {
    const res = await this.CHAIWrapper.mint.call({ from: nonOwner });
    res.should.be.bignumber.equal(BNify('0'));
  });
  it('mint creates CHAI and it sends them to msg.sender', async function () {
    // deposit 100 DAI in CHAIWrapper
    await this.DAIMock.transfer(this.CHAIWrapper.address, BNify('100').mul(this.one), {from: creator});
    // Set price
    await this.CHAIMock.setPrice(this.one.mul(BNify('2')));
    await this.PotLikeMock.setRho(BNify('158584679900'));
    await this.PotLikeMock.setChi(this.oneRay.mul(BNify('2')));    // mints in CHAI with 100 DAI

    const callRes = await this.CHAIWrapper.mint.call({ from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(this.one.mul(BNify('50')));
    // do the effective tx
    await this.CHAIWrapper.mint({ from: nonOwner });
    (await this.CHAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('50000000000000000000'));
  });
  it('redeem creates CHAI and it sends them to msg.sender', async function () {
    await this.DAIMock.transfer(this.CHAIMock.address, BNify('100').mul(this.one), {from: creator});
    await this.CHAIMock.setPrice(this.one.mul(BNify('2')));
    // deposit 50 CHAI in CHAIWrapper
    await this.CHAIMock.transfer(this.CHAIWrapper.address, BNify('50').mul(this.one), {from: creator});
    // redeem in CHAI with 50 CHAI * 2 (price) = 100 DAI
    const callRes = await this.CHAIWrapper.redeem.call(nonOwner, { from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('100').mul(this.one));
    // do the effective tx
    await this.CHAIWrapper.redeem(nonOwner, { from: nonOwner });
    (await this.DAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('100').mul(this.one));
  });
  it('availableLiquidity', async function () {
    const availableLiquidity = await this.CHAIWrapper.availableLiquidity.call();
    // minor rounding issue due to the calculation of the rate per block for the actual annual rate
    availableLiquidity.should.be.bignumber.equal(BNify('115792089237316195423570985008687907853269984665640564039457584007913129639935'));
  });
});
