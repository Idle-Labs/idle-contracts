const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleFulcrumV2 = artifacts.require('IdleFulcrumV2');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleFulcrumV2', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, creator, {from: creator});

    this.iDAIWrapper = await IdleFulcrumV2.new(
      this.iDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
    await this.iDAIWrapper.setIdleToken(nonOwner, {from: creator});
  });

  it('constructor set a token address', async function () {
    (await this.iDAIWrapper.token()).should.equal(this.iDAIMock.address);
  });
  it('constructor set a underlying address', async function () {
    (await this.iDAIWrapper.underlying()).should.equal(this.DAIMock.address);
  });
  it('allows onlyOwner to setIdleToken', async function () {
    const val = this.someAddr;
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await expectRevert(
      this.iDAIWrapper.setIdleToken(val, { from: creator }),
      'idleToken addr already set'
    );

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.iDAIWrapper.setIdleToken(val, { from: nonOwner }));
  });
  it('returns next supply rate given amount', async function () {
    const val = BNify(10**18);
    const res = await this.iDAIWrapper.nextSupplyRate.call(val, { from: nonOwner });

    const nextSupplyInterestRateFulcrum = await this.iDAIMock.nextSupplyInterestRate.call(val);
    const expectedRes = BNify(nextSupplyInterestRateFulcrum);
    res.should.be.bignumber.equal(expectedRes);
  });
  it('returns next supply rate given params', async function () {
    // tested with data and formula from task iDAI:manualNextRateData
    const val = [
      BNify("419766782897339371903563"), // b, totalAssetBorrow
      BNify("995495112439158951883651"), // s, totalAssetSupply
      BNify(10**23) //  x, _amount
    ];
    await this.iDAIMock.setSupplyInterestRateForTest(BNify('1'));
    const res = await this.iDAIWrapper.nextSupplyRateWithParams.call(val, { from: nonOwner });
    res.should.be.bignumber.equal(BNify('1'));
  });
  it('getPriceInToken returns iToken price', async function () {
    const res = await this.iDAIWrapper.getPriceInToken.call({ from: nonOwner });
    const expectedRes = BNify(await this.iDAIMock.tokenPrice.call());
    res.should.be.bignumber.equal(expectedRes);
    res.should.be.bignumber.equal('1100000000000000000');
  });
  it('getAPR returns current yearly rate (counting fee ie spreadMultiplier)', async function () {
    const res = await this.iDAIWrapper.getAPR.call({ from: nonOwner });

    const currSupplyInterestRateFulcrum = await this.iDAIMock.supplyInterestRate.call();
    const spreadMultiplier = await this.iDAIMock.spreadMultiplier.call();
    const expectedRes = BNify(currSupplyInterestRateFulcrum);
    res.should.be.bignumber.equal(expectedRes);
  });
  it('mint returns 0 if no tokens are presenti in this contract', async function () {
    const res = await this.iDAIWrapper.mint.call({ from: nonOwner });
    res.should.be.bignumber.equal(BNify(0));
  });
  it('mint creates iTokens and it sends them to msg.sender', async function () {
    // deposit 100 DAI in iDAIWrapper
    await this.DAIMock.transfer(this.iDAIWrapper.address, BNify('100').mul(this.one), {from: creator});
    // mints in Fulcrum with 100 DAI
    const callRes = await this.iDAIWrapper.mint.call({ from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('90909090909090909090'));
    // do the effective tx
    await this.iDAIWrapper.mint({ from: nonOwner });
    (await this.iDAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('90909090909090909090'));
  });
  it('redeem creates iTokens and it sends them to msg.sender', async function () {
    // fund iDAIMock with 110 DAI
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('110').mul(this.one), {from: creator});
    // deposit 100 iDAI in iDAIWrapper
    await this.iDAIMock.transfer(this.iDAIWrapper.address, BNify('100').mul(this.one), {from: creator});
    // redeem in Fulcrum with 100 iDAI * 1.1 (price) = 110 DAI
    const callRes = await this.iDAIWrapper.redeem.call(nonOwner, { from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('110').mul(this.one));
    // do the effective tx
    await this.iDAIWrapper.redeem(nonOwner, { from: nonOwner });
    (await this.DAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('110').mul(this.one));
  });
  it('redeem reverts if not all amount is available', async function () {
    // fund iDAIMock with only 10 DAI (not enough to redeem everything)
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('10').mul(this.one), {from: creator});
    // deposit 100 iDAI in iDAIWrapper
    await this.iDAIMock.transfer(this.iDAIWrapper.address, BNify('100').mul(this.one), {from: creator});
    // redeem in Fulcrum with 100 iDAI * 1.1 (price) = 110 DAI
    // not all DAI are present
    await this.iDAIMock.setFakeBurn({ from: nonOwner });

    await expectRevert(
      this.iDAIWrapper.redeem(nonOwner, { from: nonOwner }),
      'Not enough liquidity on Fulcrum'
    );
  });
});
