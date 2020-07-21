const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleRebalancer = artifacts.require('IdleRebalancer');
const IdleCompound = artifacts.require('IdleCompound');
const IdleFulcrum = artifacts.require('IdleFulcrum');
const IdleRebalancerMock = artifacts.require('IdleRebalancerMock');
const iDAIWrapperMock = artifacts.require('iDAIWrapperMock');
const cDAIWrapperMock = artifacts.require('cDAIWrapperMock');
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
    this.iDAIWrapperMock = await iDAIWrapperMock.new(
      this.iDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
    this.cDAIWrapperMock = await cDAIWrapperMock.new(
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

    this.IdleRebalancerMock = await IdleRebalancerMock.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.cDAIWrapper.address,
      this.iDAIWrapper.address,
      { from: creator }
    );

    this.IdleRebalancerMockWithMockedWrappers = await IdleRebalancerMock.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.cDAIWrapperMock.address,
      this.iDAIWrapperMock.address,
      { from: creator }
    );

    await this.IdleRebalancer.setIdleToken(creator, {from: creator});
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
  it('constructor set a maxIterations', async function () {
    (await this.IdleRebalancer.maxIterations()).should.be.bignumber.equal(BNify('30'));
  });
  it('constructor set a maxRateDifference', async function () {
    (await this.IdleRebalancer.maxRateDifference()).should.be.bignumber.equal(BNify('100000000000000000'));
  });
  it('constructor set a maxSupplyedParamsDifference', async function () {
    (await this.IdleRebalancer.maxSupplyedParamsDifference()).should.be.bignumber.equal(BNify('100000'));
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
  it('allows onlyOwner to setMaxSupplyedParamsDifference', async function () {
    const val = BNify('100000');
    await this.IdleRebalancer.setMaxSupplyedParamsDifference(val, { from: creator });
    (await this.IdleRebalancer.maxSupplyedParamsDifference()).should.be.bignumber.equal(val);

    await expectRevert.unspecified(this.IdleRebalancer.setMaxSupplyedParamsDifference(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setIdleToken', async function () {
    const val = this.someAddr;
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await expectRevert(
      this.IdleRebalancer.setIdleToken(val, { from: creator }),
      'idleToken addr already set'
    );

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.IdleRebalancer.setIdleToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setBlocksPerYear', async function () {
    const val = BNify('2425846');
    // it will revert with reason `idleToken addr already set` because it has already been set in beforeEach
    await this.IdleRebalancer.setBlocksPerYear(val, { from: creator });
    (await this.IdleRebalancer.blocksPerYear()).should.be.bignumber.equal(val);

    // it will revert with unspecified reason for nonOwner
    await expectRevert.unspecified(this.IdleRebalancer.setBlocksPerYear(val, { from: nonOwner }));
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
    val[7] = BNify('2102400'), // white.blocksPerYear();
    val[8] = BNify('100'), // 100;

    // set mock data in cDAIMock
    await this.cDAIMock.setParams(val);

    // set Params for iDAIMock
    const valFulcrum = [];
    valFulcrum[0] = BNify('15477397326696356896'), // iToken.protocolInterestRate()
    valFulcrum[1] = BNify('126330399262842122707083'), // totalAssetBorrow;
    valFulcrum[2] = BNify('838941079486105304319308'), // totalAssetSupply();

    // set mock data in cDAIMock
    await this.iDAIMock.setParams(valFulcrum);
    const res = await this.IdleRebalancer.calcRebalanceAmounts([newDAIAmount], { from: creator });

    res.tokenAddresses[0].should.be.equal(this.cDAIMock.address);
    res.tokenAddresses[1].should.be.equal(this.iDAIMock.address);
    res.amounts[0].should.be.bignumber.equal(BNify('99194115210224665493614436')); // 99704548 DAI compound
    res.amounts[1].should.be.bignumber.equal(BNify('805884789775334506385564')); // 295451 DAI fulcrum
  });
  it('calcRebalanceAmounts with given params which are lower than the expected one', async function () {
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
    val[7] = BNify('2102400'), // white.blocksPerYear();
    val[8] = BNify('100'), // 100;

    // set mock data in cDAIMock
    await this.cDAIMock.setParams(val);

    // set Params for iDAIMock
    const valFulcrum = [];
    valFulcrum[0] = BNify('15477397326696356896'), // iToken.protocolInterestRate()
    valFulcrum[1] = BNify('126330399262842122707083'), // totalAssetBorrow;
    valFulcrum[2] = BNify('838941079486105304319308'), // totalAssetSupply();

    // set mock data in cDAIMock
    await this.iDAIMock.setParams(valFulcrum);
    // here we are passing 3 params, with params calculated off-chain which are slightly
    // different than the exact ones and slightly less than the total
    const res = await this.IdleRebalancer.calcRebalanceAmounts([
      newDAIAmount,
      BNify('1'),
      BNify('1')
      // total is 99952000000000000000000000
      // so there is less than 0.001% of difference
      // there is 9e+21 to allocate (50% on compound and 50% on fulcrum)

    ], { from: creator });

    res.tokenAddresses[0].should.be.equal(this.cDAIMock.address);
    res.tokenAddresses[1].should.be.equal(this.iDAIMock.address);
    res.amounts[0].should.be.bignumber.equal(BNify('99194115210224665493614436'));
    res.amounts[1].should.be.bignumber.equal(BNify('805884789775334506385564'));
  });
  it('calcRebalanceAmounts with given params which are higher than the expected one', async function () {
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
    val[7] = BNify('2102400'), // white.blocksPerYear();
    val[8] = BNify('100'), // 100;

    // set mock data in cDAIMock
    await this.cDAIMock.setParams(val);

    // set Params for iDAIMock
    const valFulcrum = [];
    valFulcrum[0] = BNify('15477397326696356896'), // iToken.protocolInterestRate()
    valFulcrum[1] = BNify('126330399262842122707083'), // totalAssetBorrow;
    valFulcrum[2] = BNify('838941079486105304319308'), // totalAssetSupply();

    // set mock data in cDAIMock
    await this.iDAIMock.setParams(valFulcrum);
    // here we are passing 3 params, with params calculated off-chain which are slightly
    // different than the exact ones and slightly less than the total
    const res = await this.IdleRebalancer.calcRebalanceAmounts([
      newDAIAmount,
      BNify('1000000000').mul(this.one), // 1.000.000.000
      BNify('1000000000').mul(this.one), // 1.000.000.000
      // total is 99952000000000000000000000
      // so there is less than 0.001% of difference
      // there is 9e+21 to allocate (50% on compound and 50% on fulcrum)

    ], { from: creator });

    res.tokenAddresses[0].should.be.equal(this.cDAIMock.address);
    res.tokenAddresses[1].should.be.equal(this.iDAIMock.address);
    res.amounts[0].should.be.bignumber.equal(BNify('99194115210224665493614436'));
    res.amounts[1].should.be.bignumber.equal(BNify('805884789775334506385564'));
  });

  it('bisectionRec (fake public method in IdleRebalancerMock)', async function () {
    const toRebalance = BNify('100000000').mul(this.one); // 100.000.000 DAI

    // set Params for cDAIMock
    const paramsCompound = [];
    paramsCompound[0] = BNify('1000000000000000000'), // 10 ** 18;
    paramsCompound[1] = BNify('50000000000000000'), // white.baseRate();
    paramsCompound[2] = BNify('23226177266611090600484812'), // cToken.totalBorrows();
    paramsCompound[3] = BNify('120000000000000000'), // white.multiplier();
    paramsCompound[4] = BNify('108083361138278343025995'), // cToken.totalReserves();
    paramsCompound[5] = BNify('950000000000000000'), // j.sub(cToken.reserveFactorMantissa());
    paramsCompound[6] = BNify('12471299241106729195006665'), // cToken.getCash();
    paramsCompound[7] = BNify('2102400'), // white.blocksPerYear();
    paramsCompound[8] = BNify('100'); // 100;
    // fake param to get array with length == 10
    paramsCompound[9] = BNify('10');

    // set Params for iDAIMock
    const paramsFulcrum = [];
    paramsFulcrum[0] = BNify('15477397326696356896'), // iToken.protocolInterestRate()
    // fake borrow to be > 90%
    // paramsFulcrum[1] = BNify('806330399262842122707083'), // totalAssetBorrow;
    paramsFulcrum[1] = BNify('126330399262842122707083'), // totalAssetBorrow;
    paramsFulcrum[2] = BNify('838941079486105304319308'), // totalAssetSupply();
    // fake param to get array with length == 4
    paramsFulcrum[3] = BNify('10');

    // set next rate with utilization rate > 90%
    // await this.iDAIWrapper._setNextSupplyRate(BNify(this.one).mul(BNify('2'))); // 2%
    // await this.iDAIWrapper._setNextSupplyRateWithParams(BNify(this.one).mul(BNify('2'))); // 2%
    // await this.cDAIWrapper._setNextSupplyRate(BNify(this.one).mul(BNify('2'))); // 2%

    const amountFulcrum = toRebalance.mul(paramsFulcrum[2].add(paramsFulcrum[1])).div(
      paramsFulcrum[2].add(paramsFulcrum[1]).add(paramsCompound[6].add(paramsCompound[2]).add(paramsCompound[2]))
    );
    const amountCompound = toRebalance.sub(amountFulcrum);
    const resCall = await this.IdleRebalancerMock.bisectionRecPublic.call(
      amountCompound,
      amountFulcrum,
      BNify('100000000000000000'), // tolerance
      BNify('0'),
      BNify('30'),
      toRebalance,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    await this.IdleRebalancerMock.bisectionRecPublic(
      amountCompound,
      amountFulcrum,
      BNify('100000000000000000'), // tolerance
      BNify('0'),
      BNify('30'),
      toRebalance,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    resCall[0].should.be.bignumber.equal(BNify('99194115210224665493614436')); // 99704548 DAI compound
    resCall[1].should.be.bignumber.equal(BNify('805884789775334506385564')); // 295451 DAI fulcrum
  });

  it('bisectionRec wih fulcrum utilizationRate > 90% (fake public method in IdleRebalancerMock)', async function () {
    const toRebalance = BNify('100000000').mul(this.one); // 100.000.000 DAI

    // set Params for cDAIMock
    const paramsCompound = [];
    paramsCompound[0] = BNify('1000000000000000000'), // 10 ** 18;
    paramsCompound[1] = BNify('50000000000000000'), // white.baseRate();
    paramsCompound[2] = BNify('23226177266611090600484812'), // cToken.totalBorrows();
    paramsCompound[3] = BNify('120000000000000000'), // white.multiplier();
    paramsCompound[4] = BNify('108083361138278343025995'), // cToken.totalReserves();
    paramsCompound[5] = BNify('950000000000000000'), // j.sub(cToken.reserveFactorMantissa());
    paramsCompound[6] = BNify('12471299241106729195006665'), // cToken.getCash();
    paramsCompound[7] = BNify('2102400'), // white.blocksPerYear();
    paramsCompound[8] = BNify('100'); // 100;
    // fake param to get array with length == 10
    paramsCompound[9] = BNify('10');

    // set Params for iDAIMock
    const paramsFulcrum = [];
    paramsFulcrum[0] = BNify('15477397326696356896'), // iToken.protocolInterestRate()
    // fake borrow to be > 90%
    // paramsFulcrum[1] = BNify('806330399262842122707083'), // totalAssetBorrow;
    paramsFulcrum[1] = BNify('826330399262842122707083'), // totalAssetBorrow;
    paramsFulcrum[2] = BNify('838941079486105304319308'), // totalAssetSupply();
    // fake param to get array with length == 4
    paramsFulcrum[3] = BNify('10');

    // set next rate with utilization rate > 90%
    await this.iDAIWrapperMock._setNextSupplyRate(BNify(this.one).mul(BNify('3'))); // 2%

    const amountFulcrum = toRebalance.mul(paramsFulcrum[2].add(paramsFulcrum[1])).div(
      paramsFulcrum[2].add(paramsFulcrum[1]).add(paramsCompound[6].add(paramsCompound[2]).add(paramsCompound[2]))
    );
    const amountCompound = toRebalance.sub(amountFulcrum);
    const resCall = await this.IdleRebalancerMockWithMockedWrappers.bisectionRecPublic.call(
      amountCompound,
      amountFulcrum,
      BNify('100000000000000000'), // tolerance
      BNify('0'),
      BNify('30'),
      toRebalance,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    await this.IdleRebalancerMockWithMockedWrappers.bisectionRecPublic(
      amountCompound,
      amountFulcrum,
      BNify('100000000000000000'), // tolerance
      BNify('0'),
      BNify('30'),
      toRebalance,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    resCall[0].should.be.bignumber.equal(amountCompound); // 972515249 DAI
    resCall[1].should.be.bignumber.equal(amountFulcrum);  // 27484750 DAI
  });
  it('checkRebalanceAmounts with amount > than actual amount to rebalance (fake public method in IdleRebalancerMock)', async function () {
    const rebalanceParams = [
      BNify('1000').mul(this.one),
      BNify('7900').mul(this.one), // amountCompound
      BNify('2090').mul(this.one) // amountFulcrum
    ];
    const paramsCompound = [];
    const paramsFulcrum = [];
    const resCall = await this.IdleRebalancerMockWithMockedWrappers.checkRebalanceAmountsPublic.call(
      rebalanceParams,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    resCall[0].should.be.equal(false);
  });
  it('checkRebalanceAmounts with amount too much lower than the actual amount to rebalance (fake public method in IdleRebalancerMock)', async function () {
    const rebalanceParams = [
      BNify('1000').mul(this.one),
      BNify('79').mul(this.one), // amountCompound
      BNify('20').mul(this.one) // amountFulcrum
    ];
    const paramsCompound = [];
    const paramsFulcrum = [];
    const resCall = await this.IdleRebalancerMockWithMockedWrappers.checkRebalanceAmountsPublic.call(
      rebalanceParams,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    resCall[0].should.be.equal(false);
  });
  it('checkRebalanceAmounts with ok amounts (fake public method in IdleRebalancerMock)', async function () {
    const rebalanceParams = [
      BNify('1000').mul(this.one),
      BNify('790499000000000000000'), // 790.499
      BNify('209499000000000000000'), // 209.499
    ];
    // tot passed by user = 999.998
    // interest to be splitted = 0,002
    // final amount should be [709.5, 209.5]

    // fake useless data
    const paramsCompound = [this.one,this.one,this.one,this.one,this.one,this.one,this.one,this.one,this.one,this.one];
    // third param is divided by 10 to have n utiliztion rate < 90 %
    const paramsFulcrum = [this.one,this.one.div(BNify('10')),this.one,this.one,this.one,this.one];
    const resCall = await this.IdleRebalancerMockWithMockedWrappers.checkRebalanceAmountsPublic.call(
      rebalanceParams,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    await this.IdleRebalancerMockWithMockedWrappers.checkRebalanceAmountsPublic(
      rebalanceParams,
      paramsCompound,
      paramsFulcrum,
      { from: creator }
    );
    // iDAIWrapper nextSupplyRateWithParams == 2.85 %
    // cDAIWrapper nextSupplyRateWithParams == 2.9 %
    resCall[0].should.be.equal(true);
    resCall[1][0].should.be.bignumber.equal(BNify('790500000000000000000'));
    resCall[1][1].should.be.bignumber.equal(BNify('209500000000000000000'));
  });
});
