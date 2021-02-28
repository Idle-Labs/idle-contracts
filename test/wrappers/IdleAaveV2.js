const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleAaveV2 = artifacts.require('IdleAaveV2');
const DAIMock = artifacts.require('DAIMock');
const aDAIMock = artifacts.require('aDAIMock');
const aaveLendingPoolProviderMock = artifacts.require('aaveLendingPoolProviderMock');
const aaveLendingPoolCoreMock = artifacts.require('aaveLendingPoolCoreMock');
const AaveInterestRateStrategyMock = artifacts.require('AaveInterestRateStrategyMockV2');
const AaveStableDebtTokenMock = artifacts.require('AaveStableDebtTokenMock');
const AaveVariableDebtTokenMock = artifacts.require('AaveVariableDebtTokenMock');
const aaveLendingPoolMockV2 = artifacts.require('aaveLendingPoolMockV2');
const BNify = n => new BN(String(n));

contract('IdleAave', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.oneRay = new BN('1000000000000000000000000000');
    this.oneAToken = this.one; // TODO should be equal to underlying decimals
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.aDAIMock = await aDAIMock.new(this.DAIMock.address, creator, {from: creator});
    this.aaveLendingPoolProviderMock = await aaveLendingPoolProviderMock.new();
    this.aaveLendingPoolCoreMock = await aaveLendingPoolCoreMock.new();
    this.aaveInterestRateStrategyMock = await AaveInterestRateStrategyMock.new();
    this.aaveLendingPoolMock = await aaveLendingPoolMockV2.new(this.DAIMock.address, this.aDAIMock.address);
    await this.aaveLendingPoolProviderMock._setLendingPoolCore(this.aaveLendingPoolCoreMock.address);
    await this.aaveLendingPoolProviderMock._setLendingPool(this.aaveLendingPoolMock.address);
    await this.aaveLendingPoolCoreMock._setReserve(this.aaveInterestRateStrategyMock.address);

    await this.aaveLendingPoolCoreMock.setReserveCurrentLiquidityRate(this.oneRay.div(BNify('100')).mul(BNify('2')));
    await this.aaveInterestRateStrategyMock._setSupplyRate(this.oneRay.div(BNify('100')).mul(BNify('2')));
    await this.aaveInterestRateStrategyMock._setBorrowRate(this.oneRay.div(BNify('100')).mul(BNify('3')));

    this.aaveStableDebtTokenMock = await AaveStableDebtTokenMock.new(0, 0);
    this.aaveVariableDebtTokenMock = await AaveVariableDebtTokenMock.new(0);

    await this.aaveLendingPoolMock.setStableDebtTokenAddress(this.aaveStableDebtTokenMock.address);
    await this.aaveLendingPoolMock.setVariableDebtTokenAddress(this.aaveVariableDebtTokenMock.address);
    await this.aaveLendingPoolMock.setInterestRateStrategyAddress(this.aaveInterestRateStrategyMock.address);
    await this.aaveLendingPoolMock.setCurrentLiquidityRate(this.oneRay.div(BNify('100')).mul(BNify('2')));

    this.aDAIWrapper = await IdleAaveV2.new(
      this.aDAIMock.address,
      this.aaveLendingPoolProviderMock.address,
      nonOwner,
      {from: creator}
    );
  });

  it('constructor set a token address', async function () {
    (await this.aDAIWrapper.token()).should.equal(this.aDAIMock.address);
  });

  it('constructor set an underlying address', async function () {
    (await this.aDAIWrapper.underlying()).should.equal(this.DAIMock.address);
  });

  it('returns next supply rate given amount', async function () {
    const nextSupplyInterestRateAave = await this.aDAIWrapper.nextSupplyRate.call(BNify('1'));
    nextSupplyInterestRateAave.should.not.be.bignumber.equal(BNify('0'));
    nextSupplyInterestRateAave.should.be.bignumber.equal(this.one.mul(BNify('2')));
  });

  it('getPriceInToken returns aToken price', async function () {
    const res = await this.aDAIWrapper.getPriceInToken.call({ from: nonOwner });
    res.should.be.bignumber.equal(this.one);
  });

  it('getAPR returns current yearly rate (counting fee)', async function () {
    const res = await this.aDAIWrapper.getAPR.call({ from: nonOwner });
    res.should.be.bignumber.equal(this.one.mul(BNify('2')));
  });

  it('mint returns 0 if no tokens are presenti in this contract', async function () {
    const res = await this.aDAIWrapper.mint.call({ from: nonOwner });
    res.should.be.bignumber.equal(BNify('0'));
  });

  it('mint creates aTokens and it sends them to msg.sender', async function () {
    // deposit 100 DAI in aDAIWrapper
    await this.DAIMock.transfer(this.aDAIWrapper.address, BNify('100').mul(this.one), {from: creator});
    await this.aDAIMock.transfer(this.aaveLendingPoolMock.address, BNify('100').mul(this.one), {from: creator});

    // mints in Aave with 100 DAI
    const callRes = await this.aDAIWrapper.mint.call({ from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('100').mul(this.one));
    // do the effective tx
    await this.aDAIWrapper.mint({ from: nonOwner });
    (await this.aDAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('100').mul(this.one));
  });

  it('redeem creates aTokens and it sends them to msg.sender', async function () {
    // fund aDAIMock with 100 DAI
    await this.DAIMock.transfer(this.aDAIMock.address, BNify('100').mul(this.one), {from: creator});
    // deposit 100 aDAI in aDAIWrapper
    await this.aDAIMock.transfer(this.aDAIWrapper.address, BNify('100').mul(this.oneAToken), {from: creator});
    const callRes = await this.aDAIWrapper.redeem.call(nonOwner, { from: nonOwner });
    // check return value
    BNify(callRes).should.be.bignumber.equal(BNify('100').mul(this.one));
    // do the effective tx
    await this.aDAIWrapper.redeem(nonOwner, { from: nonOwner });
    (await this.DAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('100').mul(this.one));
  });
});
