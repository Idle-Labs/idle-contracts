const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleTokenV3Mock = artifacts.require('IdleTokenV3Mock');
const IdlePriceCalculator = artifacts.require('IdlePriceCalculator');
const IdleRebalancerV3 = artifacts.require('IdleRebalancerV3');
const IdleFactoryV3Mock = artifacts.require('IdleFactoryV3Mock');
const WhitePaperMock = artifacts.require('WhitePaperMock');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const cDAIWrapperMock = artifacts.require('cDAIWrapperMock');
const iDAIWrapperMock = artifacts.require('iDAIWrapperMock');
const DAIMock = artifacts.require('DAIMock');
const GasTokenMock = artifacts.require('GasTokenMock');

const yxDAIWrapperMock = artifacts.require('yxDAIWrapperMock');
const yxTokenMock = artifacts.require('yxTokenMock');
const DyDxMock = artifacts.require('DyDxMock');
const InterestSetterMock = artifacts.require('InterestSetterMock');

const aDAIWrapperMock = artifacts.require('aDAIWrapperMock');
const aDAIMock = artifacts.require('aDAIMock');
const aaveLendingPoolProviderMock = artifacts.require('aaveLendingPoolProviderMock');
const aaveLendingPoolCoreMock = artifacts.require('aaveLendingPoolCoreMock');
const aaveInterestRateStrategyMock = artifacts.require('aaveInterestRateStrategyMock');
const aaveLendingPoolMock = artifacts.require('aaveLendingPoolMock');

const BNify = n => new BN(String(n));

contract('IdleTokenV3', function ([_, creator, nonOwner, someone, foo, manager, feeReceiver]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.oneCToken = new BN('100000000'); // 8 decimals
    this.oneRay = new BN('1000000000000000000000000000');
    this.oneAToken = this.one; // TODO should be equal to underlying decimals
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    // 1000 DAI are given to creator in DAIMock constructor
    this.DAIMock = await DAIMock.new({from: creator});
    this.GSTMock = await GasTokenMock.new({from: creator});
    this.WhitePaperMock = await WhitePaperMock.new({from: creator});
    // 100.000 cDAI are given to creator in cDAIMock constructor
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, creator, this.WhitePaperMock.address, {from: creator});
    // 10000 iDAI are given to creator in iDAIMock constructor
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, creator, {from: creator});

    // Use mocked wrappers
    this.cDAIWrapper = await cDAIWrapperMock.new(
      this.cDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
    this.iDAIWrapper = await iDAIWrapperMock.new(
      this.iDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );

    // Aave
    // 100.000 aDAI to creator
    this.aDAIMock = await aDAIMock.new(this.DAIMock.address, creator, {from: creator});
    this.aaveLendingPoolProviderMock = await aaveLendingPoolProviderMock.new();
    this.aaveLendingPoolCoreMock = await aaveLendingPoolCoreMock.new();
    this.aaveInterestRateStrategyMock = await aaveInterestRateStrategyMock.new();
    this.aaveLendingPoolMock = await aaveLendingPoolMock.new(this.DAIMock.address, this.aDAIMock.address);
    await this.aDAIMock.transfer(this.aaveLendingPoolMock.address, BNify('10000').mul(this.one), {from: creator});

    await this.aaveLendingPoolProviderMock._setLendingPoolCore(this.aaveLendingPoolCoreMock.address);
    await this.aaveLendingPoolProviderMock._setLendingPool(this.aaveLendingPoolMock.address);
    await this.aaveLendingPoolCoreMock._setReserve(this.aaveInterestRateStrategyMock.address);

    await this.aaveLendingPoolCoreMock.setReserveCurrentLiquidityRate(this.oneRay.div(BNify('100')).mul(BNify('2')));
    await this.aaveInterestRateStrategyMock._setSupplyRate(this.oneRay.div(BNify('100')).mul(BNify('2')));
    await this.aaveInterestRateStrategyMock._setBorrowRate(this.oneRay.div(BNify('100')).mul(BNify('3')));

    this.aDAIWrapper = await aDAIWrapperMock.new(
      this.aDAIMock.address,
      this.DAIMock.address,
      {from: creator}
    );
    await this.aDAIWrapper.setAaveAddressesProvider(this.aaveLendingPoolProviderMock.address, {from: creator});
    // end Aave

    // DyDx
    this.DyDxMock = await DyDxMock.new(this.DAIMock.address, {from: creator});
    this.InterestSetterMock = await InterestSetterMock.new({from: creator});
    const marketId = 3;

    // 1000 yxDAI to creator
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

    this.yxDAIWrapper = await yxDAIWrapperMock.new(
      this.yxDAIMock.address,
      this.DAIMock.address,
      marketId,
      {from: creator}
    );
    await this.yxDAIWrapper.setDydxAddressesProvider(this.DyDxMock.address, {from: creator});
    // end DyDx

    this.IdleRebalancer = await IdleRebalancerV3.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.aDAIMock.address,
      this.yxDAIMock.address,
      manager,
      { from: creator }
    );
    this.PriceCalculator = await IdlePriceCalculator.new({ from: creator });
    this.Factory = await IdleFactoryV3Mock.new({ from: creator });
    this.idleTokenAddr = await this.Factory.newIdleToken.call(
      'IdleDAI',
      'IDLEDAI',
      18,
      this.DAIMock.address, this.cDAIMock.address, this.iDAIMock.address,
      this.IdleRebalancer.address,
      this.PriceCalculator.address,
      this.cDAIWrapper.address, this.iDAIWrapper.address,
      { from: creator }
    );
    await this.Factory.newIdleToken(
      'IdleDAI',
      'IDLEDAI',
      18,
      this.DAIMock.address, this.cDAIMock.address, this.iDAIMock.address,
      this.IdleRebalancer.address,
      this.PriceCalculator.address,
      this.cDAIWrapper.address, this.iDAIWrapper.address,
      { from: creator }
    );
    await this.Factory.setTokenOwnershipAndPauser(this.idleTokenAddr, {from: creator});
    await this.cDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.iDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.aDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.yxDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.IdleRebalancer.setIdleToken(this.idleTokenAddr, {from: creator});

    this.token = await IdleTokenV3Mock.at(this.idleTokenAddr);
    await this.token.setProtocolWrapper(this.aDAIMock.address, this.aDAIWrapper.address, {from: creator});
    await this.token.setProtocolWrapper(this.yxDAIMock.address, this.yxDAIWrapper.address, {from: creator});
    await this.token.setGST(this.GSTMock.address);

    // helper methods
    this.mintIdle = async (amount, who, skipRebalance = false) => {
      // Give DAI to `who`
      await this.DAIMock.transfer(who, amount, { from: creator });
      await this.DAIMock.approve(this.token.address, amount, { from: who });
      const allowance = await this.DAIMock.allowance(who, this.token.address);
      return await this.token.mintIdleToken(amount, skipRebalance, { from: who });
    };

    this.sendProtocolTokensToIdle = async (amounts, idleTokens) => {
      await this.cDAIMock.transfer(this.token.address, BNify(amounts[0]).mul(this.oneCToken), {from: creator});
      await this.iDAIMock.transfer(this.token.address, BNify(amounts[1]).mul(this.one), {from: creator});
      await this.aDAIMock.transfer(this.token.address, BNify(amounts[2]).mul(this.one), {from: creator});
      await this.yxDAIMock.transfer(this.token.address, BNify(amounts[3]).mul(this.one), {from: creator});
      if (idleTokens) {
        await this.token.createTokens(BNify(idleTokens).mul(this.one), {from: creator});
      }
    };
    this.testIdleBalance = async amounts => {
      BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify(amounts[0]).mul(this.oneCToken));
      BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify(amounts[1]).mul(this.one));
      BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify(amounts[2]).mul(this.one));
      BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify(amounts[3]).mul(this.one));
    };
    this.testIdleAllocations = async allocs => {
      for (let i = 0; i < allocs.length; i++) {
        BNify(await this.token.lastAllocations(i, {from: creator})).should.be.bignumber.equal(BNify(allocs[i]));
      }
    };
    this.setPrices = async prices => {
      // Set prices
      await this.cDAIMock._setExchangeRateStored(BNify(prices[0]));
      await this.cDAIWrapper._setPriceInToken(BNify(prices[0]));
      await this.iDAIMock.setPriceForTest(BNify(prices[1]));
      await this.iDAIWrapper._setPriceInToken(BNify(prices[1]));
      await this.aDAIMock.setPriceForTest(BNify(prices[2]));
      await this.aDAIWrapper._setPriceInToken(BNify(prices[2]));
      await this.yxDAIMock.setPriceForTest(BNify(prices[3]));
      await this.yxDAIWrapper._setPriceInToken(BNify(prices[3]));
    }
    this.setAPRs = async aprs => {
      // Set prices
      await this.cDAIWrapper._setAPR(BNify(aprs[0]).mul(this.one));
      await this.iDAIWrapper._setAPR(BNify(aprs[1]).mul(this.one));
      await this.aDAIWrapper._setAPR(BNify(aprs[2]).mul(this.one));
      await this.yxDAIWrapper._setAPR(BNify(aprs[3]).mul(this.one));
    }
    this.setLiquidity = async liquidity => {
      // Set liquidity
      await this.cDAIWrapper._setAvailableLiquidity(BNify(liquidity[0]).mul(this.one));
      await this.iDAIWrapper._setAvailableLiquidity(BNify(liquidity[1]).mul(this.one));
      await this.aDAIWrapper._setAvailableLiquidity(BNify(liquidity[2]).mul(this.one));
      await this.yxDAIWrapper._setAvailableLiquidity(BNify(liquidity[3]).mul(this.one));
    }

    this.daiMultiTransfer = async (tos, amounts) => {
      for (let i = 0; i < tos.length; i++) {
        await this.DAIMock.transfer(tos[i], BNify(amounts[i]).mul(this.one), {from: creator});
      }
    };

    this.allocToWei = alloc => alloc.map(el => BNify(el).mul(this.one));
    this.setRebAllocations = async (allocs) => {
      await this.IdleRebalancer.setAllocations(
        [BNify(allocs[0]), BNify(allocs[1]), BNify(allocs[2]), BNify(allocs[3])],
        [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
        {from: manager}
      );
    }
  });

  it('constructor set a name', async function () {
    (await this.token.name()).should.equal('IdleDAI');
  });
  it('constructor set a symbol', async function () {
    (await this.token.symbol()).should.equal('IDLEDAI');
  });
  it('constructor set a decimals', async function () {
    (await this.token.decimals()).should.be.bignumber.equal(BNify('18'));
  });
  it('constructor set a token (DAI) address', async function () {
    (await this.token.token()).should.equal(this.DAIMock.address);
  });
  it('constructor set a iToken (iDAI) address', async function () {
    (await this.token.iToken()).should.equal(this.iDAIMock.address);
  });
  it('constructor set a tokenDecimals', async function () {
    (await this.token.tokenDecimals()).should.be.bignumber.equal(BNify('18'));
  });
  it('constructor set a rebalancer address', async function () {
    (await this.token.rebalancer()).should.equal(this.IdleRebalancer.address);
  });
  it('constructor set a priceCalculator address', async function () {
    (await this.token.priceCalculator()).should.equal(this.PriceCalculator.address);
  });
  it('constructor set a protocolWrapper for cToken', async function () {
    (await this.token.protocolWrappers(this.cDAIMock.address)).should.equal(this.cDAIWrapper.address);
  });
  it('constructor set a protocolWrapper for iToken', async function () {
    (await this.token.protocolWrappers(this.iDAIMock.address)).should.equal(this.iDAIWrapper.address);
  });
  it('constructor set allAvailableTokens', async function () {
    (await this.token.allAvailableTokens(0)).should.equal(this.cDAIMock.address);
    (await this.token.allAvailableTokens(1)).should.equal(this.iDAIMock.address);
  });
  it('constructor set manualPlay', async function () {
    (await this.token.manualPlay()).should.equal(false);
  });
  it('constructor set isNewProtocolDelayed', async function () {
    (await this.token.isNewProtocolDelayed()).should.equal(false);
  });
  it('allows onlyOwner to setManualPlay', async function () {
    const val = true;
    await this.token.setManualPlay(val, { from: creator });
    (await this.token.manualPlay()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setManualPlay(val, { from: nonOwner }));
  });
  it('allows onlyOwner to delayNewProtocols', async function () {
    const val = true;
    await this.token.delayNewProtocols({ from: creator });
    (await this.token.isNewProtocolDelayed()).should.be.equal(val);

    await expectRevert.unspecified(this.token.delayNewProtocols({ from: nonOwner }));
  });
  it('allows onlyOwner to setRebalancer', async function () {
    const val = this.someAddr;
    await this.token.setRebalancer(val, { from: creator });
    (await this.token.rebalancer()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setRebalancer(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setPriceCalculator (when isNewProtocolDelayed is false)', async function () {
    const val = this.someAddr;
    await this.token.setPriceCalculator(val, { from: creator });
    (await this.token.priceCalculator()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setPriceCalculator(val, { from: nonOwner }));
  });
  it('onlyOwner cannot instantly setPriceCalculator (when isNewProtocolDelayed is true)', async function () {
    await this.token.delayNewProtocols({ from: creator });

    const _token = this.someAddr;
    await this.token.setPriceCalculator(_token, { from: creator });
    (await this.token.priceCalculator()).should.equal(this.PriceCalculator.address); // addr not changed
  });
  it('onlyOwner can setPriceCalculator after some time (when isNewProtocolDelayed is true)', async function () {
    await this.token.delayNewProtocols({ from: creator });

    const _token = this.someAddr;
    await this.token.setPriceCalculator(_token, { from: creator });
    (await this.token.priceCalculator()).should.equal(this.PriceCalculator.address); // addr not changed

    await this.token.mockBackInTime(_token, 60*60*24*4); // 4 days

    await this.token.setPriceCalculator(_token, { from: creator });
    (await this.token.priceCalculator()).should.equal(_token);
  });
  it('allows onlyOwner to setFeeAddress', async function () {
    const val = this.someAddr;
    await this.token.setFeeAddress(val, { from: creator });
    (await this.token.feeAddress()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setFeeAddress(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setFee', async function () {
    const val = BNify('10000');
    await this.token.setFee(val, { from: creator });
    (await this.token.fee()).should.be.bignumber.equal(val);

    await expectRevert.unspecified(this.token.setFee(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setProtocolWrapper (when isNewProtocolDelayed is false)', async function () {
    const _token = this.someAddr;
    const _wrapper = this.someOtherAddr;
    await this.token.setProtocolWrapper(_token, _wrapper, { from: creator });
    (await this.token.protocolWrappers(_token)).should.equal(_wrapper);
    (await this.token.allAvailableTokens(4)).should.equal(_token);
    await expectRevert.assertion(this.token.allAvailableTokens(5)); // array out-of-bound
    // retest to see that it does not push _token another time
    await this.token.setProtocolWrapper(_token, foo, { from: creator });
    (await this.token.protocolWrappers(_token)).should.equal(foo);
    (await this.token.allAvailableTokens(4)).should.equal(_token);
    await expectRevert.assertion(this.token.allAvailableTokens(5)); // array out-of-bound
    // nonOwner
    await expectRevert.unspecified(this.token.setProtocolWrapper(_token, _wrapper, { from: nonOwner }));
  });
  it('onlyOwner cannot instantly setProtocolWrapper (when isNewProtocolDelayed is true)', async function () {
    await this.token.delayNewProtocols({ from: creator });

    const _token = this.someAddr;
    const _wrapper = this.someOtherAddr;
    await this.token.setProtocolWrapper(_token, _wrapper, { from: creator });
    (await this.token.protocolWrappers(_token)).should.equal(this.ETHAddr); // addr(0)
    await expectRevert.assertion(this.token.allAvailableTokens(4)); // array out-of-bound
  });
  it('onlyOwner can setProtocolWrapper after some time (when isNewProtocolDelayed is true)', async function () {
    await this.token.delayNewProtocols({ from: creator });

    const _token = this.someAddr;
    const _wrapper = this.someOtherAddr;
    await this.token.setProtocolWrapper(_token, _wrapper, { from: creator });
    (await this.token.protocolWrappers(_token)).should.equal(this.ETHAddr); // addr(0)
    await expectRevert.assertion(this.token.allAvailableTokens(4)); // array out-of-bound

    await this.token.mockBackInTime(_wrapper, 60*60*24*4); // 4 days

    await this.token.setProtocolWrapper(_token, _wrapper, { from: creator });
    (await this.token.protocolWrappers(_token)).should.equal(_wrapper);
    (await this.token.allAvailableTokens(4)).should.equal(_token);
    await expectRevert.assertion(this.token.allAvailableTokens(5)); // array out-of-bound
  });

  it('calculates current tokenPrice when IdleToken supply is 0', async function () {
    const res = await this.token.tokenPrice.call();
    const expectedRes = this.one;
    res.should.be.bignumber.equal(expectedRes);
  });
  it('calculates current tokenPrice when funds are all in one pool', async function () {
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1100000000000000000', this.one, '2000000000000000000']);
    // all funds will be sent to one protocol (Compound)
    await this.setRebAllocations(['100000', '0', '0', '0']);
    // First mint with tokenPrice = 1
    // Approve and Mint 10 DAI, all on Compound so 10 / 0.02 = 500 cDAI in idle pool
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // and 500 cDAI will be minted to IdleDAI contract
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('500').mul(this.oneCToken));

    // After some time price of cDAI has increased
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025 DAI
    // Used for when wrapper calls mint on cDAIMock
    // NOTE: for Fulcrum rate should be higher then _setPriceInToken due to fee
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    // when redeeming now we redeem more DAI of what cDAIMock has so we transfer DAI to the contract
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('2500000000000000000'), { from: creator });
    // await this.DAIMock.transfer(this.cDAIMock.address, BNify('15').mul(this.one), { from: creator });

    const res1 = await this.token.tokenPrice.call();
    // current nav is 500 * 0.025 = 12.5 DAI
    // idleToken supply 10
    // currTokenPrice = 12.5 / 10 = 1.25
    res1.should.be.bignumber.equal(BNify('1250000000000000000'));

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('1100000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    // everything will go to Compound because next supply rate of compound is > of current Fulcrum rate

    // Approve and Mint 20 DAI, all on Compound so 20 / 0.025 = 800 cDAI in idle pool
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);

    // total cDAI pool 1300 cDAI
    // tokenPrice is still 1.25 here
    // so 20 / 1.25 = 16 IdleDAI minted
    const price2 = await this.token.tokenPrice.call();
    // current nav is 1300 * 0.025 = 32.5 DAI
    // idleToken supply 26
    // currTokenPrice = 32.5 / 26 = 1.25
    price2.should.be.bignumber.equal(BNify('1250000000000000000'));

    await this.cDAIMock._setExchangeRateStored(BNify('300000000000000000000000000')); // 0.03DAI
    await this.cDAIWrapper._setPriceInToken(BNify('300000000000000000000000000')); // 0.03

    const res = await this.token.tokenPrice.call();
    // 1300 * 0.03 = 39 DAI (nav of cDAI pool)
    // totNav = 39 DAI
    // totSupply = 26 IdleDAI
    const expectedRes = BNify('1500000000000000000'); // 1.5
    res.should.be.bignumber.equal(expectedRes);
  });
  it('calculates current tokenPrice when funds are in different pools', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    await this.iDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('4').mul(this.one));

    // After some time price of cDAI has increased
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025 DAI
    // Used for when wrapper calls `mint` on cDAIMock
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    // when redeeming now we redeem more DAI of what cDAIMock has so we transfer DAI to the contract
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('2500000000000000000'), { from: creator });

    // After some time price of iDAI has increased
    await this.iDAIWrapper._setPriceInToken(BNify('1500000000000000000')); // 1.5 DAI
    // Used for when wrapper calls `mint` on iDAIMock
    // NOTE: for Fulcrum rate should be higher then _setPriceInToken due to fee
    // await this.iDAIMock._setPriceForTest(BNify('1650000000000000000')); // 1.65 DAI
    await this.iDAIMock.setPriceForTest(BNify('1500000000000000000')); // 1.65 DAI
    // when redeeming now we redeem more DAI of what cDAIMock has so we transfer DAI to the contract
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('1').mul(this.one), { from: creator });

    const res1 = await this.token.tokenPrice.call();
    // current nav cDAI pool is 250 * 0.025 = 6.25 DAI
    // current nav iDAI pool is 4 * 1.5 = 6 DAI
    // idleToken supply 10
    // currTokenPrice = (6.25 + 6) / 10 = 1.225
    res1.should.be.bignumber.equal(BNify('1225000000000000000'));

    await this.IdleRebalancer.setAllocations(
      [BNify('37980'), BNify('62020'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 20 DAI
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);

    // total cDAI pool 12.25 / 0.025 = 490 cDAI
    // total iDAI pool 20 / 1.5 = 13.33333 iDAI

    // tokenPrice is still 1.225 here
    // so 20 / 1.225 = 16.3265306122 IdleDAI minted
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    const resBalance3 = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    const resBalanceSupply = await this.token.totalSupply.call({ from: nonOwner });
    const price2 = await this.token.tokenPrice.call();

    // cDAI balance 553.84000000
    // iDAI balance 12.2693

    // 553.84 * 0.025 = 13.846
    // 12.269333 * 1.5 = 18.404
    // idleToken supply 26.3265306122
    // currTokenPrice = 32.25 / 26.3265306122 = 1.225
    price2.should.be.bignumber.equal(BNify('1224999999999999999'));

    await this.cDAIWrapper._setPriceInToken(BNify('300000000000000000000000000')); // 0.03

    const res = await this.token.tokenPrice.call();
    // 553.84 * 0.03 = 16.6152 DAI (nav of cDAI pool)
    // totNav = 16.6152 + 20 = 36.6152 DAI
    // totSupply = 26.3265306122 IdleDAI
    const expectedRes = BNify('1330186666666666666'); // 1.318...
    res.should.be.bignumber.equal(expectedRes);
  });
  it('get all APRs from every protocol', async function () {
    // Prepare fake data for getAPR
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('1100000000000000000')); // 1.1%

    const res = await this.token.getAPRs.call();
    res.addresses[0].should.be.equal(this.cDAIMock.address);
    res.addresses[1].should.be.equal(this.iDAIMock.address);
    res.aprs[0].should.be.bignumber.equal(BNify('2200000000000000000'));
    res.aprs[1].should.be.bignumber.equal(BNify('1100000000000000000'));
  });
  it('get current avg apr of idle', async function () {
    await this.cDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%
    await this.iDAIWrapper._setAPR(BNify('2000000000000000000')); // 2%
    await this.aDAIWrapper._setAPR(BNify('3000000000000000000')); // 3%
    await this.yxDAIWrapper._setAPR(BNify('4000000000000000000')); // 4%

    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1100000000000000000')); // 1.1DAI
    await this.aDAIWrapper._setPriceInToken(BNify('1000000000000000000')); // 1DAI
    await this.yxDAIWrapper._setPriceInToken(BNify('1000000000000000000')); // 1DAI

    // 500 * 0.02 = 10
    await this.cDAIMock.transfer(this.token.address, BNify('500').mul(this.oneCToken), {from: creator});
    // 10 * 1.1 = 11
    await this.iDAIMock.transfer(this.token.address, BNify('10').mul(this.one), {from: creator});
    // 5 *  1 = 5
    await this.aDAIMock.transfer(this.token.address, BNify('5').mul(this.one), {from: creator});
    // 5 *  1 = 5
    await this.yxDAIMock.transfer(this.token.address, BNify('5').mul(this.one), {from: creator});

    // tot = 31

    // 10/31 * 1 + 11/31 * 2 + 5/31 * 3 + 5/31 * 4 = 2.16129032 %
    const res = await this.token.getAvgAPR.call();
    res.should.be.bignumber.equal(BNify('2161290322580645157'));
  });
  it('mints idle tokens', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1100000000000000000')); // 1.1DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    await this.iDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );
    // Approve and Mint 10 DAI, all on Compound so 10 / 0.02 = 500 cDAI in idle pool
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 DAI will be transferred from nonOwner
    const resBalanceDAI = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('0').mul(this.one));
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // and 500 cDAI will be minted to IdleDAI contract
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('500').mul(this.oneCToken));

    // After some time price of cDAI has increased
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025 DAI
    // Used for when wrapper calls mint on cDAIMock
    // NOTE: for Fulcrum rate should be higher then _setPriceInToken due to fee
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    // when redeeming now we redeem more DAI of what cDAIMock has so we transfer DAI to the contract
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('2500000000000000000'), { from: creator });
    // currTokenPrice = 12.5 / 10 = 1.25

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('1100000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    // everything will go to Compound because next supply rate of compound is > of current Fulcrum rate

    // Approve and Mint 20 DAI, all on Compound so 20 / 0.025 = 800 cDAI in idle pool
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);

    // so 20 DAI will be transferred from nonOwner
    const resBalanceDAI2 = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI2.should.be.bignumber.equal(BNify('0').mul(this.one));
    // total cDAI pool 1300 cDAI
    // tokenPrice is still 1.25 here
    // so 20 / 1.25 = 16 IdleDAI minted to nonOwner
    const resBalanceIdle2 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle2.should.be.bignumber.equal(BNify('26').mul(this.one));
    // and 500 cDAI will be minted to IdleDAI contract
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('1300').mul(this.oneCToken));
  });
  it('getCurrentAllocations', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1100000000000000000')); // 1.1DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    await this.iDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.IdleRebalancer.setAllocations(
      [BNify('68750'), BNify('31250'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // tokenPrice is 1 here
    await this.mintIdle(BNify('32').mul(this.one), nonOwner);

    const resGetParams = await this.token.getCurrentAllocations.call({ from: nonOwner });
    resGetParams[0][0].should.be.equal(this.cDAIMock.address);
    resGetParams[0][1].should.be.equal(this.iDAIMock.address);
    resGetParams[0][2].should.be.equal(this.aDAIMock.address);
    resGetParams[0][3].should.be.equal(this.yxDAIMock.address);

    resGetParams[1][0].should.be.bignumber.equal(BNify('22').mul(this.one));
    // rounding issue
    resGetParams[1][1].should.be.bignumber.equal(BNify('10').mul(this.one).sub(BNify('1')));
    resGetParams[1][2].should.be.bignumber.equal(BNify('0').mul(this.one));
    resGetParams[1][3].should.be.bignumber.equal(BNify('0').mul(this.one));
  });
  it('cannot mints if iToken price has decreased', async function () {
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('1100000000000000000')); // 1.1%

    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    const price = await this.token.lastITokenPrice.call();
    price.should.be.bignumber.equal(BNify('1250000000000000000'));
    await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.25DAI
    await expectRevert(
      this.mintIdle(BNify('10').mul(this.one), nonOwner),
      'Paused: iToken price decreased'
    );
  });
  it('can mints if iToken price has decreased and contract has been manually played', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    await this.iDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%

    // all funds will be sent to one protocol (Compound)
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    const price = await this.token.lastITokenPrice.call();
    price.should.be.bignumber.equal(BNify('1250000000000000000'));
    await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.25DAI

    await this.token.setManualPlay(true, {from: creator});
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // lastITokenPrice should not be updated
    const price2 = await this.token.lastITokenPrice.call();
    price2.should.be.bignumber.equal(BNify('1250000000000000000'));
  });
  it('after mints lastITokenPrice is updated if has increased', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    await this.iDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%

    // all funds will be sent to one protocol (Compound)
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    const price = await this.token.lastITokenPrice.call();
    price.should.be.bignumber.equal(BNify('1250000000000000000'));

    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000'));
    await this.iDAIWrapper._setPriceInToken(BNify('1300000000000000000')); // 1.25DAI
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    const price2 = await this.token.lastITokenPrice.call();
    price2.should.be.bignumber.equal(BNify('1300000000000000000'));
  });
  it('cannot mints idle tokens when paused', async function () {
    await this.token.pause({from: creator});
    await this.DAIMock.transfer(nonOwner, BNify('10').mul(this.one), { from: creator });
    await this.DAIMock.approve(this.token.address, BNify('10').mul(this.one), { from: nonOwner });
    await expectRevert.unspecified(this.token.mintIdleToken(BNify('10').mul(this.one), [], { from: nonOwner }));
  });
  it('does not redeem if idleToken total supply is 0', async function () {
    await expectRevert.unspecified(this.token.redeemIdleToken(BNify('10').mul(this.one), false, [], { from: nonOwner }));
  });
  it('redeems idle tokens', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    await this.iDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%

    // First mint with tokenPrice = 1
    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('4').mul(this.one));

    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), false, [], {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('10').mul(this.one));

    await this.token.redeemIdleToken(BNify('10').mul(this.one), false, [], {from: nonOwner});
    // so nonOwner has no IdleDAI
    const resBalanceIdle2 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle2.should.be.bignumber.equal(BNify('0').mul(this.one));
    // IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('0').mul(this.one));
    // there are no cDAI in Idle contract
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('0').mul(this.oneCToken));
    // there are no iDAI in Idle contract
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI2.should.be.bignumber.equal(BNify('0').mul(this.one));
    // 10 DAI are given back to nonOwner
    const resBalanceDAI = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('10').mul(this.one));
  });
  it('redeems idle tokens and rebalances', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
    // First mint with tokenPrice = 1
    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );
    // Approve and Mint 10 DAI for nonOwner,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('4').mul(this.one));

    // update prices
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1300000000000000000')); // 1.30DAI
    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    // 250 * 0.025 = 6.25 DAI nav of cDAI pool
    // so we transfer 1.25 DAI to cDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('1250000000000000000'), { from: creator });
    // 4 * 1.3 = 5.2 DAI nav of iDAI pool
    // so we transfer 0.2 DAI to iDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('200000000000000000'), { from: creator });
    // tokenPrice is now (6.25 + 5.2) / 10 = 1.145 DAI per idleDAI
    const resBalanceIDAIWrapper = await this.DAIMock.balanceOf.call(this.iDAIMock.address, { from: nonOwner });
    resBalanceIDAIWrapper.should.be.bignumber.equal(BNify('5200000000000000000'));

    // 11.45 total DAI nav + 10 DAI minted now
    // we set them all on Compound
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // 250 * 0.025 = 6.25 DAI nav of cDAI pool
    // 4 * 1.3 = 5.2 DAI nav of iDAI pool
    // totNav = 11.45

    // with 10DAI initially mints 200 cDAI and 3.84615384615 iDAI (old alloc was 50% and 50%)

    // so 450 cDAI * 0.025 = 11.25
    // 7.84615384615 iDAI * 1.3 = 10.2
    // TOT = 21.45
    // then should rebalance()
    //  so first redeems all from iDAI
    //  and then mints 10.2 / 7.846... = 408 cDAI

    // so in the end 858 cDAI should be present

    // Approve and Mint 10 DAI,
    // tokenPrice is 1.145 here
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // so 10 / 1.145 IdleDAI will be minted to nonOwner
    const resBalanceIdle2 = await this.token.balanceOf.call(someone, { from: someone });
    resBalanceIdle2.should.be.bignumber.equal(BNify('8733624454148471615')); // 8.73362445415
    // 21.45 / 0.025 = 858 cDAI
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: someone });
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalance2.should.be.bignumber.equal(BNify('858').mul(this.oneCToken));
    // iDAI pool is empty now
    resBalanceIDAI2.should.be.bignumber.equal(BNify('0').mul(this.one));

    await this.IdleRebalancer.setAllocations(
      [BNify('0'), BNify('100000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // tot pool is now 858 cDAI * 0.025 = 21.45 DAI
    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), false, [], {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45 DAI

    // after redeem before rebalance there are still 400 cDAI
    // worth 400 * 0.025 = 10 DAI
    // and we buy 10 / 1.3 = 7.69230769231 iDAI
    await this.token.redeemIdleToken(BNify('10').mul(this.one), false, [], {from: nonOwner});
    // so nonOwner has no IdleDAI
    const resBalanceIdle3 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle3.should.be.bignumber.equal(BNify('0').mul(this.one));
    // 10 IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('8733624454148471615'));
    // there are no cDAI in Idle contract
    const resBalance3 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance3.should.be.bignumber.equal(BNify('0').mul(this.oneCToken));

    const resBalanceIDAI3 = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    const resBalanceDAI3 = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });

    resBalanceIDAI3.should.be.bignumber.equal(BNify('7692307692307692307'));
    // 11.45 DAI are given back to nonOwner
    resBalanceDAI3.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45
  });
  it('redeems idle tokens and does not rebalances if paused', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%

    // First mint with tokenPrice = 1
    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI for nonOwner,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('4').mul(this.one));

    // update prices
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1300000000000000000')); // 1.30DAI
    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI

    // 250 * 0.025 = 6.25 DAI nav of cDAI pool
    // so we transfer 1.25 DAI to cDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('1250000000000000000'), { from: creator });
    // 4 * 1.3 = 5.2 DAI nav of iDAI pool
    // so we transfer 1.2 DAI to iDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('1200000000000000000'), { from: creator });
    // tokenPrice is now (6.25 + 5.2) / 10 = 1.145 DAI per idleDAI

    // 11.45 total DAI nav + 10 DAI minted now
    // we set them all on Compound
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );
    // Approve and Mint 10 DAI,
    // tokenPrice is 1.145 here
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // so 10 / 1.145 IdleDAI will be minted to nonOwner
    const resBalanceIdle2 = await this.token.balanceOf.call(someone, { from: someone });
    resBalanceIdle2.should.be.bignumber.equal(BNify('8733624454148471615')); // 8.73362445415
    // 21.45 / 0.025 = 858 cDAI
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalance2.should.be.bignumber.equal(BNify('858').mul(this.oneCToken));
    // iDAI pool is empty now
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalanceIDAI2.should.be.bignumber.equal(BNify('0').mul(this.one));

    // Pause contract
    await this.token.pause({from: creator});

    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), false, [], {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45 DAI

    await this.token.redeemIdleToken(BNify('10').mul(this.one), false, [], {from: nonOwner});
    // so nonOwner has no IdleDAI
    const resBalanceIdle3 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle3.should.be.bignumber.equal(BNify('0').mul(this.one));
    // 10 IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('8733624454148471615'));

    // iDAI pool is still empty given that no rebalance happened
    const resBalanceIDAI3 = await this.iDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalanceIDAI3.should.be.bignumber.equal(BNify('0').mul(this.one));

    // 11.45 DAI are given back to nonOwner
    const resBalanceDAI3 = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI3.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45

    // there are cDAI in Idle contract
    const resBalance3 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance3.should.be.bignumber.equal(BNify('400').mul(this.oneCToken));
  });
  it('redeems idle tokens and does not rebalances if paused', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    // First mint with tokenPrice = 1
    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI for nonOwner,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('4').mul(this.one));

    // update prices
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1300000000000000000')); // 1.30DAI
    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI

    // 250 * 0.025 = 6.25 DAI nav of cDAI pool
    // so we transfer 1.25 DAI to cDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('1250000000000000000'), { from: creator });
    // 4 * 1.3 = 5.2 DAI nav of iDAI pool
    // so we transfer 1.2 DAI to iDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('1200000000000000000'), { from: creator });
    // tokenPrice is now (6.25 + 5.2) / 10 = 1.145 DAI per idleDAI

    // 11.45 total DAI nav + 10 DAI minted now
    // we set them all on Compound
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1.145 here
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // so 10 / 1.145 IdleDAI will be minted to nonOwner
    const resBalanceIdle2 = await this.token.balanceOf.call(someone, { from: someone });
    resBalanceIdle2.should.be.bignumber.equal(BNify('8733624454148471615')); // 8.73362445415
    // 21.45 / 0.025 = 858 cDAI
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalance2.should.be.bignumber.equal(BNify('858').mul(this.oneCToken));
    // iDAI pool is empty now
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalanceIDAI2.should.be.bignumber.equal(BNify('0').mul(this.one));

    // Lower iToken price
    await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.0DAI

    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), false, [], {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45 DAI

    await this.token.redeemIdleToken(BNify('10').mul(this.one), false, [], {from: nonOwner});
    // so nonOwner has no IdleDAI
    const resBalanceIdle3 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle3.should.be.bignumber.equal(BNify('0').mul(this.one));
    // 10 IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('8733624454148471615'));

    // iDAI pool is still empty given that no rebalance happened
    const resBalanceIDAI3 = await this.iDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalanceIDAI3.should.be.bignumber.equal(BNify('0').mul(this.one));

    // 11.45 DAI are given back to nonOwner
    const resBalanceDAI3 = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI3.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45

    // there are cDAI in Idle contract
    const resBalance3 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance3.should.be.bignumber.equal(BNify('400').mul(this.oneCToken));
  });
  it('redeems idle tokens and does not rebalances if _skipRebalance is true', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%

    // First mint with tokenPrice = 1
    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI for nonOwner,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('4').mul(this.one));

    // update prices
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1300000000000000000')); // 1.30DAI
    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI

    // 250 * 0.025 = 6.25 DAI nav of cDAI pool
    // so we transfer 1.25 DAI to cDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('1250000000000000000'), { from: creator });
    // 4 * 1.3 = 5.2 DAI nav of iDAI pool
    // so we transfer 1.2 DAI to iDAI mock to cover new interests earned
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('1200000000000000000'), { from: creator });
    // tokenPrice is now (6.25 + 5.2) / 10 = 1.145 DAI per idleDAI

    // 11.45 total DAI nav + 10 DAI minted now
    // we set them all on Compound
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );
    // Approve and Mint 10 DAI,
    // tokenPrice is 1.145 here
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // so 10 / 1.145 IdleDAI will be minted to nonOwner
    const resBalanceIdle2 = await this.token.balanceOf.call(someone, { from: someone });
    resBalanceIdle2.should.be.bignumber.equal(BNify('8733624454148471615')); // 8.73362445415
    // 21.45 / 0.025 = 858 cDAI
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalance2.should.be.bignumber.equal(BNify('858').mul(this.oneCToken));
    // iDAI pool is empty now
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalanceIDAI2.should.be.bignumber.equal(BNify('0').mul(this.one));

    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), true, [], {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45 DAI

    await this.token.redeemIdleToken(BNify('10').mul(this.one), true, [], {from: nonOwner});
    // so nonOwner has no IdleDAI
    const resBalanceIdle3 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle3.should.be.bignumber.equal(BNify('0').mul(this.one));
    // 10 IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('8733624454148471615'));

    // iDAI pool is still empty given that no rebalance happened
    const resBalanceIDAI3 = await this.iDAIMock.balanceOf.call(this.token.address, { from: someone });
    resBalanceIDAI3.should.be.bignumber.equal(BNify('0').mul(this.one));

    // 11.45 DAI are given back to nonOwner
    const resBalanceDAI3 = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI3.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45

    // there are cDAI in Idle contract
    const resBalance3 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance3.should.be.bignumber.equal(BNify('400').mul(this.oneCToken));
  });
  it('redeemInterestBearingTokens', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('2200000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    await this.iDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%

    // First mint with tokenPrice = 1
    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('4').mul(this.one));

    // Redeems 10 IdleDAI
    await this.token.redeemInterestBearingTokens(BNify('10').mul(this.one), {from: nonOwner});
    // so nonOwner has no IdleDAI
    const resBalanceIdle2 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle2.should.be.bignumber.equal(BNify('0').mul(this.one));
    // IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('0').mul(this.one));
    // there are no cDAI in Idle contract
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('0').mul(this.oneCToken));
    // there are no iDAI in Idle contract
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI2.should.be.bignumber.equal(BNify('0').mul(this.one));

    // interest bearing assets are given directly to the user without redeeming the underlying DAI
    const resBalanceCDAIOwner = await this.cDAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceCDAIOwner.should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    const resBalanceIDAIOwner = await this.iDAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIDAIOwner.should.be.bignumber.equal(BNify('4').mul(this.one));
  });
  it('cannot rebalance when paused', async function () {
    await this.token.pause({from: creator});
    await expectRevert.unspecified(this.token.rebalance());
  });
  it('cannot rebalance if iToken price has decreased', async function () {
    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.0DAI
    await expectRevert(
      this.token.rebalance(BNify('0').mul(this.one), [], { from: creator }),
      'Paused: iToken price decreased'
    );
  });
  it('can rebalance if iToken price has decreased and contract has been manually played', async function () {
    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.0DAI
    await this.token.setManualPlay(true, { from: creator });
    await this.token.rebalance(BNify('0').mul(this.one), [], { from: creator });
  });
  it('after rebalance lastITokenPrice is updated if it increased', async function () {
    await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    const price = await this.token.lastITokenPrice.call();
    price.should.be.bignumber.equal(BNify('1300000000000000000'));

    await this.iDAIMock.setPriceForTest(BNify('1500000000000000000')); // 1.30DAI
    await this.token.rebalance(BNify('0').mul(this.one), [], { from: creator });
    const price2 = await this.token.lastITokenPrice.call();
    price2.should.be.bignumber.equal(BNify('1500000000000000000'));
  });
  it('rebalances when _newAmount > 0 and only one protocol is used', async function () {
    await this.IdleRebalancer.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    // Approve and Mint 10 DAI for nonOwner, everything on Compound
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    await this.DAIMock.transfer(this.token.address, BNify('10').mul(this.one), { from: creator });

    const res = await this.token.rebalance.call(BNify('10').mul(this.one), [], { from: creator });
    res.should.be.equal(false);
    // it should mint 10 / 0.02 = 500cDAI
    // plus 500 cDAI from before
    const receipt = await this.token.rebalance(BNify('10').mul(this.one), [], { from: creator });

    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('1000').mul(this.oneCToken));

  });
  it('rebalances and multiple protocols are used', async function () {
    // update prices
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25 DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25 DAI

    // set same rates so to use _calcAmounts from IdleRebalancer
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    await this.IdleRebalancer.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('4').mul(this.one));
    (await this.token.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('10').mul(this.one));

    await this.IdleRebalancer.setAllocations(
      [BNify('20000'), BNify('80000'), BNify('0'), BNify('0')],
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      {from: manager}
    );

    const res = await this.token.rebalance.call();
    res.should.be.equal(true);
    await this.token.rebalance(BNify('10').mul(this.one), [], { from: creator });

    // IdleToken should have 2 / 0.02 = 100cDAI
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('100').mul(this.oneCToken));
    // IdleToken should have 8 / 1.25 = 6.4 iDAI
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('6400000000000000000'));
  });
  it('_amountsFromAllocations (public version)', async function () {
    const allocations = [BNify('50000'), BNify('30000'), BNify('20000'), BNify('0')];
    const res = await this.token.amountsFromAllocations.call(allocations, BNify('100').mul(this.one));
    res[0].should.be.bignumber.equal(BNify('50').mul(this.one));
    res[1].should.be.bignumber.equal(BNify('30').mul(this.one));
    res[2].should.be.bignumber.equal(BNify('20').mul(this.one));
    res[3].should.be.bignumber.equal(BNify('0').mul(this.one));
  });
  it('_mintWithAmounts (public version)', async function () {
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25 DAI
    await this.aDAIMock.setPriceForTest(this.one); // 1 DAI
    await this.yxDAIMock.setPriceForTest(BNify('2000000000000000000')); // 2 DAI
    // transfer to contract total of 30DAI
    await this.DAIMock.transfer(this.token.address, BNify('30').mul(this.one), {from: creator});
    await this.aDAIMock.transfer(this.aaveLendingPoolMock.address, BNify('10').mul(this.one), {from: creator});

    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    const allocations = [BNify('5').mul(this.one), BNify('5').mul(this.one), BNify('10').mul(this.one), BNify('10').mul(this.one)];
    // const allocations = [BNify('5').mul(this.one), BNify('5').mul(this.one), BNify('10').mul(this.one), BNify('10').mul(this.one)];
    const res = await this.token.mintWithAmounts(tokens, allocations);
    BNify(await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    BNify(await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('4').mul(this.one));
    BNify(await this.aDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('10').mul(this.one));
    BNify(await this.yxDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('5').mul(this.one));
  });
  it('_redeemAllNeeded (public version) reverts if amounts and newAmounts have different lengths', async function () {
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    const allocations = this.allocToWei(['5', '5']);
    const newAllocations = this.allocToWei(['30', '0', '0', '0']);
    await expectRevert(
      this.token.redeemAllNeeded(tokens, allocations, newAllocations),
      'Lengths not equal'
    );
  });
  it('_redeemAllNeeded (public version) when liquidity is available', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransfer(
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      ['5', '5', '10', '10']
    );

    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    const allocations = this.allocToWei(['5', '5', '10', '10']);
    const newAllocations = this.allocToWei(['30', '0', '0', '0']);
    const res = await this.token.redeemAllNeeded.call(tokens, allocations, newAllocations);
    await this.token.redeemAllNeeded(tokens, allocations, newAllocations);

    // check what should be minted
    BNify(res.toMintAllocations[0]).should.be.bignumber.equal(BNify('25').mul(this.one));
    BNify(res.toMintAllocations[1]).should.be.bignumber.equal(BNify('0').mul(this.one));
    BNify(res.toMintAllocations[2]).should.be.bignumber.equal(BNify('0').mul(this.one));
    BNify(res.toMintAllocations[3]).should.be.bignumber.equal(BNify('0').mul(this.one));
    // and in the contract
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('25').mul(this.one));

    // Check also totalToMint return value
    BNify(res.totalToMint).should.be.bignumber.equal(BNify('25').mul(this.one));
  });
  it('_redeemAllNeeded (public version) when liquidity is available and with reallocation of everything', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransfer(
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      ['0', '0', '10', '10']
    );
    const DAIbalanceInitial = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalanceInitial).should.be.bignumber.equal(BNify('0').mul(this.one));

    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    const allocations = this.allocToWei(['5', '5', '10', '10']);
    const newAllocations = this.allocToWei(['10', '10', '5', '5']);
    const res = await this.token.redeemAllNeeded.call(tokens, allocations, newAllocations);
    await this.token.redeemAllNeeded(tokens, allocations, newAllocations);

    // check what should be minted
    BNify(res.toMintAllocations[0]).should.be.bignumber.equal(BNify('5').mul(this.one));
    BNify(res.toMintAllocations[1]).should.be.bignumber.equal(BNify('5').mul(this.one));
    BNify(res.toMintAllocations[2]).should.be.bignumber.equal(BNify('0').mul(this.one));
    BNify(res.toMintAllocations[3]).should.be.bignumber.equal(BNify('0').mul(this.one));
    // and in the contract

    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('10').mul(this.one));

    // Check also totalToMint return value
    BNify(res.totalToMint).should.be.bignumber.equal(BNify('10').mul(this.one));

    // remember that it's still not minted
    // await this.testIdleBalance(['250', '4', '5', BNify('5').div(BNify('2'))]);
    BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('4').mul(this.one));
    BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('5').mul(this.one));
    BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('2500000000000000000'));
  });
  it('_redeemAllNeeded (public version) with low liquidity available', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1', '4']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransfer(
      [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address],
      ['0', '0', '1', '4']
    );

    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    const allocations = this.allocToWei(['5', '5', '10', '10']);
    const newAllocations = this.allocToWei(['10', '10', '5', '5']);
    const res = await this.token.redeemAllNeeded.call(tokens, allocations, newAllocations);
    await this.token.redeemAllNeeded(tokens, allocations, newAllocations);

    // check what should be minted
    BNify(res.toMintAllocations[0]).should.be.bignumber.equal(BNify('5').mul(this.one));
    BNify(res.toMintAllocations[1]).should.be.bignumber.equal(BNify('5').mul(this.one));
    BNify(res.toMintAllocations[2]).should.be.bignumber.equal(BNify('0').mul(this.one));
    BNify(res.toMintAllocations[3]).should.be.bignumber.equal(BNify('0').mul(this.one));
    // and in the contract
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('5').mul(this.one));

    // Check also totalToMint return value
    BNify(res.totalToMint).should.be.bignumber.equal(BNify('10').mul(this.one));

    // remember that it's still not minted
    BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('250').mul(this.oneCToken));
    BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('4').mul(this.one));
    BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('9').mul(this.one));
    BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('3000000000000000000'));
  });
  it('rebalance when liquidity is availabler', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    // Set rebalancer allocations
    await this.setRebAllocations(['33333', '33333', '16667', '16667']);

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['0', '0', '5', '5']);

    const res = await this.token.rebalance.call();
    await this.token.rebalance();
    res.should.equal(true);

    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('49999500000'));
    // BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('49995000000').mul(this.oneCToken));
    BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('7999920000000000000'));
    // BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('8').mul(this.one));
    BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('5000100000000000000'));
    BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('2500050000000000000'));

    // Allocations are correct
    await this.testIdleAllocations(['33333', '33333', '16667', '16667']);
  });
  it('rebalance when liquidity is not available', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1', '4']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    await this.token.setAllocations([BNify('25000'), BNify('25000'), BNify('25000'), BNify('25000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['33333', '33333', '16667', '16667']);

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['0', '0', '1', '4']);

    const res = await this.token.rebalance.call();
    await this.token.rebalance();
    res.should.equal(true);

    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('37500000000'));
    BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('6000000000000000000'));
    BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('9000000000000000000'));
    BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('3000000000000000000'));

    // Allocations are correct (ie not updated)
    await this.testIdleAllocations(['25000', '25000', '25000', '25000']);
  });
  it('rebalance when underlying tokens are in contract (ie after mint) and rebalance and idle allocations are equal', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    // Simulate rebalance called on min when contract has DAI
    await this.DAIMock.transfer(this.token.address, BNify('10').mul(this.one), {from: creator});

    const res = await this.token.rebalance.call();
    await this.token.rebalance();
    res.should.equal(false);

    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    // remember that it's still not minted
    BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('40000000000'));
    BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('6400000000000000000'));
    BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('12000000000000000000'));
    BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('6000000000000000000'));

    // Allocations are correct
    await this.testIdleAllocations(['30000', '30000', '20000', '20000']);
  });
  it('rebalance with no new amount and allocations are equal', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    const res = await this.token.rebalance.call();
    await this.token.rebalance();
    res.should.equal(false);

    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    await this.testIdleBalance(['250', '4', '10', '5']);
    await this.testIdleAllocations(['30000', '30000', '20000', '20000']);
  });
  it('rebalance when prev rebalance was not able to redeem all liquidity because a protocol has low liquidity', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '2', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['0', '0', '10', '0']); // [cToken, iToken, aToken, yxToken]
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['0', '0', '2', '0']);
    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('0'), BNify('0'), BNify('100000'), BNify('0')]);
    // All is in aave

    // Set rebalancer allocations to have everything on DyDx
    await this.setRebAllocations(['0', '0', '0', '100000']);

    const res = await this.token.rebalance.call();
    await this.token.rebalance();
    res.should.equal(true);

    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    // We redeemd everything that was available
    await this.testIdleBalance(['0', '0', '8', '1']);
    // Idle allocations still points to the old allocations (ie all on aave)
    await this.testIdleAllocations(['0', '0', '100000', '0']);

    await this.daiMultiTransfer(tokens, ['0', '0', '2', '0']);
    // If we do another rebalance then we will move all the available liquidity (still 2 not updated)
    await this.token.rebalance.call();
    await this.token.rebalance();

    // We redeemd everything that was available
    await this.testIdleBalance(['0', '0', '6', '2']);
    // Idle allocations still points to the old allocations (ie all on aave)
    await this.testIdleAllocations(['0', '0', '100000', '0']);

    // Liquidity is now available
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    await this.daiMultiTransfer(tokens, ['0', '0', '6', '0']);

    await this.token.rebalance.call();
    await this.token.rebalance();

    // We redeemd everything that was available
    await this.testIdleBalance(['0', '0', '0', '5']);
    // Idle allocations now have been updated (ie all on dydx)
    await this.testIdleAllocations(['0', '0', '0', '100000']);
  });
  it('openRebalance with allocations gives a better apr', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    // in dai [5, 5, 10, 10]
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    await this.setAPRs(['10', '5', '11', '5']);
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['5', '5', '0', '10']);
    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    const res = await this.token.openRebalance.call([BNify('0'), BNify('0'), BNify('100000'), BNify('0')]);
    await this.token.openRebalance([BNify('0'), BNify('0'), BNify('100000'), BNify('0')]);
    res[0].should.equal(true);
    res[1].should.be.bignumber.equal(BNify('11').mul(this.one));

    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    await this.testIdleBalance(['0', '0', '30', '0']);
    await this.testIdleAllocations(['0', '0', '100000', '0']);
  });
  it('openRebalance reverts with allocations that give a worse apr', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    // in dai [5, 5, 10, 10]
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    await this.setAPRs(['10', '5', '4', '5']);
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['5', '5', '0', '10']);
    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('100000'), BNify('0')]),
      'APR not improved'
    );
  });
  it('openRebalance reverts with newAllocations length != lastAllocations.length', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    // in dai [5, 5, 10, 10]
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    await this.setAPRs(['10', '5', '4', '5']);
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['5', '5', '0', '10']);
    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('100000')]),
      'Alloc lengths are different'
    );
  });
  it('openRebalance reverts if it\'s risk adjusted instance', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    // in dai [5, 5, 10, 10]
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    await this.setAPRs(['10', '5', '4', '5']);
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['5', '5', '0', '10']);
    await this.token.setIsRiskAdjusted(true, {from: creator});
    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('100000')]),
      'Setting allocations not allowed'
    );
  });
  it('openRebalance reverts when not allocating 100%', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    // in dai [5, 5, 10, 10]
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    await this.setAPRs(['10', '5', '4', '5']);
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['5', '5', '0', '10']);
    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('50000'), BNify('0')]),
      'Not allocating 100%'
    );
  });
  it('calculates fee correctly when minting / redeeming', async function () {
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), someone);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // price is now 2
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['10', '10', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), true, [], {from: nonOwner});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('19').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('1').mul(this.one));
    // price is still one
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
  });
  it('calculates fee correctly when minting multiple times and redeeming', async function () {
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), someone);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);

    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);

    // Second mint at price == 2
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);

    // avg price is 1.5 (nonOwner has 20 IdleDAI * 1.5 DAI = 30 DAI invested)
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('1500000000000000000'));
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Set prices in DAI => [0.08, 5, 1, 2]
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);

    // price is now 4
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('4')));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['80', '80', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), true, [], {from: nonOwner});

    // bought 10 @ 1.5, sell 10@4 = 40 - 15 = 25 gain => 22.5 gain (plus 10 * 1.5 deposited) and 2.5 fee
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('37500000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('2500000000000000000'));
    // price is still one
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('1500000000000000000'));
  });
  it('calculates fee correctly when redeeming a transferred idleToken amount', async function () {
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), foo);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.transfer(someone, BNify('10').mul(this.one), {from: nonOwner});

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(this.one);
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // price is now 2
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['10', '10', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), true, [], {from: someone});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.DAIMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('19').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(this.one);
    // price is still one
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(this.one);
  });
  it('calculates fee correctly when redeeming a transferred idleToken amount after having previosly deposited', async function () {
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), foo);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);

    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one.mul(BNify('1')));
    // Set prices and calculates
    // Set prices in DAI => [0.04, 2.5, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // someone has 5 idleToken

    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(this.one.mul(BNify('2')));

    await this.token.transfer(someone, BNify('10').mul(this.one), {from: nonOwner});
    // someone has 15 idleToken

    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('1333333333333333332'));
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Set prices in DAI => [0.08, 5, 1, 2]
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);
    // price is now 4
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('4')));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['20', '20', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), true, [], {from: someone});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('4')));
    BNify(await this.DAIMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('37333333333333333332'));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('2666666666666666668'));
    // price is still one
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('1333333333333333332'));
  });
  it('calculates fee correctly when using transferFrom', async function () {
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), foo);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);

    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // Set prices in DAI => [0.04, 2.5, 1, 2]
    // idle price is 2
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // someone has 5 idleToken

    await this.token.approve(someone, BNify('10').mul(this.one), {from: nonOwner});
    await this.token.transferFrom(nonOwner, someone,  BNify('10').mul(this.one), {from: someone});
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one.mul(BNify('1')));
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('1333333333333333332'));
    BNify(await this.token.balanceOf.call(someone)).should.be.bignumber.equal(this.one.mul(BNify('15')));
    BNify(await this.token.balanceOf.call(nonOwner)).should.be.bignumber.equal(this.one.mul(BNify('0')));
    BNify(await this.token.allowance.call(nonOwner, someone)).should.be.bignumber.equal(this.one.mul(BNify('0')));
  });
  it('charges no fee to whom previously deposited when there was not fee', async function () {
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), foo);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['10', '10', '0', '0']);
    await this.token.redeemIdleToken(BNify('10').mul(this.one), true, [], {from: nonOwner});
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('20').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('0'));
  });
  it('charges fee only to some part to whom previously deposited when there was not fee and deposited also when there was a fee', async function () {
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), foo);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);

    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // nonOwner has 15 idleDAI

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['30', '30', '0', '0']);
    // total dai deposited 20, total IdleDAI 15, totValue now 30, totGain 10, fee should be 0
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);
    // price is 4 now so totValue 60, initially nonOwner had 10 idle with no fee so 10 * 4 = 40 no fee
    // of the 20 DAI remained, we have 5 idleToken paid 10 so gain is 20-10 = 10 and fee is 1
    await this.token.redeemIdleToken(BNify('15').mul(this.one), true, [], {from: nonOwner});
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('2000000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('59').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(this.one);
  });
  it('mintIdletoken skips rebalance if _skipWholeRebalance is true', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    // in dai [5, 5, 10, 10]
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5'], '30'); // [cToken, iToken, aToken, yxToken]
    // Set equal allocations
    // Set idle allocations
    await this.token.setAllocations([BNify('16667'), BNify('16668'), BNify('33333'), BNify('33333')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['100000', '0', '0', '0']);

    await this.mintIdle(BNify('10').mul(this.one), nonOwner, true);
    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);
    BNify(await this.token.totalSupply.call()).should.be.bignumber.equal(this.one.mul(BNify('40')));
    await this.testIdleBalance(['750', '4', '10', '5']);
    await this.testIdleAllocations(['16667', '16668', '33333', '33333']);
  });
  it('tokenPrice is correct after a first mint that skips rebalance and allocations were not set', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    // // in dai [5, 5, 0, 0]
    // await this.sendProtocolTokensToIdle(['250', '4', '0', '0']); // [cToken, iToken, aToken, yxToken]
    //
    // // Set idle allocations
    // await this.token.setAllocations([BNify('50000'), BNify('50000'), BNify('0'), BNify('0')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['0', '0', '0', '100000']);

    await this.mintIdle(BNify('10').mul(this.one), nonOwner, true);
    // Check that no DAI are in the contract at the end
    const DAIbalance = await this.DAIMock.balanceOf.call(this.token.address);
    BNify(DAIbalance).should.be.bignumber.equal(BNify('0').mul(this.one));

    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);
    await this.testIdleBalance(['0', '0', '0', '5']);
    await this.testIdleAllocations(['0', '0', '0', '100000']);
  });
});
