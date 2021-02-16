const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleTokenV3_1Mock = artifacts.require('IdleTokenV3_1Mock');
const IdleRebalancerV3_1 = artifacts.require('IdleRebalancerV3_1');
const WhitePaperMock = artifacts.require('WhitePaperMock');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const cDAIWrapperMock = artifacts.require('cDAIWrapperMock');
const iDAIWrapperMock = artifacts.require('iDAIWrapperMock');
const DAIMock = artifacts.require('DAIMock');
const ComptrollerMock = artifacts.require('ComptrollerMock');
const IdleControllerMock = artifacts.require('IdleControllerMock');
const PriceOracleMock = artifacts.require('PriceOracleMock');
const COMPMock = artifacts.require('COMPMock');
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

contract('IdleTokenV3_1', function ([_, creator, nonOwner, someone, foo, manager, feeReceiver, bar]) {
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
    this.COMPMock = await COMPMock.new({from: creator});
    this.IDLEMock = await COMPMock.new({from: creator});
    this.GSTMock = await GasTokenMock.new({from: creator});
    this.WhitePaperMock = await WhitePaperMock.new({from: creator});
    // 100.000 cDAI are given to creator in cDAIMock constructor
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, creator, this.WhitePaperMock.address, {from: creator});
    this.ComptrollerMock = await ComptrollerMock.new(this.COMPMock.address, this.cDAIMock.address, {from: creator});
    await this.cDAIMock._setComptroller(this.ComptrollerMock.address, {from: creator});

    // we give 1000 COMP to Comptroller
    // await this.COMPMock.transfer(this.ComptrollerMock.address, BNify('1000').mul(this.one), {from: creator});

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
    this.protocolTokens = [
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.aDAIMock.address,
      this.yxDAIMock.address
    ];

    this.IdleRebalancer = await IdleRebalancerV3_1.new(
      this.protocolTokens,
      manager,
      { from: creator }
    );
    this.token = await IdleTokenV3_1Mock.new(
      'IdleDAI',
      'IDLEDAI',
      this.DAIMock.address,
      this.iDAIMock.address,
      this.cDAIMock.address,
      this.IdleRebalancer.address,
      this.IDLEMock.address,
      this.COMPMock.address,
      { from: creator }
    );
    this.idleTokenAddr = this.token.address;
    // await this.token.initialize(
    //   'IdleDAI',
    //   'IDLEDAI',
    //   this.DAIMock.address,
    //   this.iDAIMock.address,
    //   this.IdleRebalancer.address,
    //   { from: creator }
    // );

    await this.cDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.iDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.aDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.yxDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.IdleRebalancer.setIdleToken(this.idleTokenAddr, {from: creator});

    this.protocolWrappers = [
      this.cDAIWrapper.address,
      this.iDAIWrapper.address,
      this.aDAIWrapper.address,
      this.yxDAIWrapper.address
    ];

    await this.token.setAllAvailableTokensAndWrappers(
      this.protocolTokens,
      [this.cDAIWrapper.address, this.iDAIWrapper.address, this.aDAIWrapper.address, this.yxDAIWrapper.address],
      [], true,
      {from: creator}
    );
    await this.token.setGovTokens(
      [this.COMPMock.address], // govTokens
      [this.cDAIMock.address], // protocolTokens
      {from: creator}
    );

    await this.token.setGST(this.GSTMock.address);

    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.aDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.yxDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    this.IdleControllerMock = await IdleControllerMock.new(this.IDLEMock.address, this.token.address, {from: creator});
    this.PriceOracleMock = await PriceOracleMock.new({from: creator});
    await this.token.setLastAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      {from: manager}
    );

    await this.token.manualInitialize(
      [this.COMPMock.address, this.IDLEMock.address],
      this.protocolTokens,
      this.protocolWrappers,
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      false, // isRiskAdjusted
      {from: creator}
    );
    await this.token.setMaxUnlentPerc(BNify('1000'), {from: creator});
    await this.token.setOracleAddress(this.PriceOracleMock.address, {from: creator});
    await this.token.setIdleControllerAddress(this.IdleControllerMock.address, {from: creator});
    await this.token.setRebalancer(manager, {from: creator});

    // helper methods
    this.mintIdle = async (amount, who) => {
      // Give DAI to `who`
      await this.DAIMock.transfer(who, amount, { from: creator });
      await this.DAIMock.approve(this.token.address, amount, { from: who });
      const allowance = await this.DAIMock.allowance(who, this.token.address);
      return await this.token.mintIdleToken(amount, true, this.someAddr, { from: who });
    };
    this.mintIdleWithRebalance = async (amount, who) => {
      // Give DAI to `who`
      await this.DAIMock.transfer(who, amount, { from: creator });
      await this.DAIMock.approve(this.token.address, amount, { from: who });
      const allowance = await this.DAIMock.allowance(who, this.token.address);
      return await this.token.mintIdleToken(amount, false, this.someAddr, { from: who });
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
    this.setLiquidityRaw = async liquidity => {
      // Set liquidity
      await this.cDAIWrapper._setAvailableLiquidity(BNify(liquidity[0]));
      await this.iDAIWrapper._setAvailableLiquidity(BNify(liquidity[1]));
      await this.aDAIWrapper._setAvailableLiquidity(BNify(liquidity[2]));
      await this.yxDAIWrapper._setAvailableLiquidity(BNify(liquidity[3]));
    }

    this.daiMultiTransfer = async (tos, amounts) => {
      for (let i = 0; i < tos.length; i++) {
        await this.DAIMock.transfer(tos[i], BNify(amounts[i]).mul(this.one), {from: creator});
      }
    };
    this.daiMultiTransferRaw = async (tos, amounts) => {
      for (let i = 0; i < tos.length; i++) {
        await this.DAIMock.transfer(tos[i], BNify(amounts[i]), {from: creator});
      }
    };

    this.allocToWei = alloc => alloc.map(el => BNify(el).mul(this.one));
    this.setRebAllocations = async (allocs) => {
      // TODO need to set allocations once in IdleToken contract for testing

      await this.token.setAllocations(
        [BNify(allocs[0]), BNify(allocs[1]), BNify(allocs[2]), BNify(allocs[3])],
        {from: manager}
      );
    }
  });

  it('initialize set a name', async function () {
    (await this.token.name()).should.equal('IdleDAI');
  });
  it('initialize set a symbol', async function () {
    (await this.token.symbol()).should.equal('IDLEDAI');
  });
  it('initialize set a decimals', async function () {
    (await this.token.decimals()).should.be.bignumber.equal(BNify('18'));
  });
  it('initialize set a token (DAI) address', async function () {
    (await this.token.token()).should.equal(this.DAIMock.address);
  });
  it('initialize set a rebalancer address', async function () {
    (await this.token.rebalancer()).should.equal(manager);
  });
  it('initialize set owner', async function () {
    (await this.token.owner()).should.equal(creator);
  });
  it('initialize set pauser', async function () {
    (await this.token.isPauser(creator)).should.equal(true);
  });
  // it('initialize set maxUnlentPerc', async function () {
  //   (await this.token.maxUnlentPerc()).should.be.bignumber.equal(BNify('1000'));
  // });

  it('manualInitialize set stuff', async function () {
    (await this.token.fee()).should.be.bignumber.equal(BNify('0'));
    (await this.token.oracle()).should.be.equal(this.PriceOracleMock.address);
    (await this.token.idleController()).should.be.equal(this.IdleControllerMock.address);
    (await this.token.isRiskAdjusted()).should.be.equal(false);
    // (await this.token.maxUnlentPerc()).should.be.bignumber.equal(BNify(''));
    (await this.token.govTokens(0)).should.equal(this.COMPMock.address);
    (await this.token.govTokens(1)).should.equal(this.IDLEMock.address);
  });
  // it('initialize can be called only once', async function () {
  //   await expectRevert.unspecified(this.token.initialize('a', 'b', this.someAddr, this.someAddr, this.someAddr, {from: creator}));
  // });
  it('setAllAvailableTokensAndWrappers', async function () {
    await this.token.setAllAvailableTokensAndWrappers(this.protocolTokens, this.protocolWrappers, [], true, {from: creator});

    for (var i = 0; i < this.protocolTokens.length; i++) {
      (await this.token.allAvailableTokens(i)).should.equal(this.protocolTokens[i]);
      (await this.token.protocolWrappers(this.protocolTokens[i])).should.equal(this.protocolWrappers[i]);
    }

    await expectRevert.unspecified(this.token.setAllAvailableTokensAndWrappers(this.protocolTokens, this.protocolWrappers, [], true, {from: nonOwner}));
  });
  it('setGovTokens', async function () {
    await this.token.setGovTokens([this.COMPMock.address], [this.cDAIMock.address], {from: creator});

    (await this.token.govTokens(0)).should.equal(this.COMPMock.address);

    await expectRevert.unspecified(this.token.setGovTokens([this.COMPMock.address], [this.cDAIMock.address], {from: nonOwner}));
  });
  // it('allows onlyOwner to setIToken', async function () {
  //   const val = this.someAddr;
  //   await this.token.setIToken(val, { from: creator });
  //   // (await this.token.iToken()).should.be.equal(val); -> is private
  //
  //   await expectRevert.unspecified(this.token.setIToken(val, { from: nonOwner }));
  // });
  it('allows onlyOwner to setRebalancer', async function () {
    const val = this.someAddr;
    await this.token.setRebalancer(val, { from: creator });
    (await this.token.rebalancer()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setRebalancer(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setOracleAddress', async function () {
    const val = this.someAddr;
    await this.token.setOracleAddress(val, { from: creator });
    (await this.token.oracle()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setOracleAddress(val, { from: nonOwner }));
  });
  // it('allows onlyOwner to setIdleControllerAddress', async function () {
  //   const val = this.someAddr;
  //   await this.token.setIdleControllerAddress(val, { from: creator });
  //   (await this.token.idleController()).should.be.equal(val);
  //
  //   await expectRevert.unspecified(this.token.setIdleControllerAddress(val, { from: nonOwner }));
  // });
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
  it('allows onlyOwner to setMaxUnlentPerc', async function () {
    const val = BNify('20000');
    await this.token.setMaxUnlentPerc(val, { from: creator });
    (await this.token.maxUnlentPerc()).should.be.bignumber.equal(val);

    await expectRevert.unspecified(this.token.setMaxUnlentPerc(val, { from: nonOwner }));
  });
  it('calculates current tokenPrice when IdleToken supply is 0', async function () {
    const res = await this.token.tokenPrice.call();
    const expectedRes = this.one;
    res.should.be.bignumber.equal(expectedRes);
  });
  it('calculates current tokenPrice when funds are all in one', async function () {
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1100000000000000000', this.one, '2000000000000000000']);
    // all funds will be sent to one protocol (Compound)
    await this.setRebAllocations(['100000', '0', '0', '0']);
    // First mint with tokenPrice = 1
    // Approve and Mint 10 DAI, all on Compound so 10 / 0.02 = 500 cDAI in idle pool
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // After some time price of cDAI has increased
    await this.cDAIWrapper._setPriceInToken(BNify('250000000000000000000000000')); // 0.025 DAI
    // Used for when wrapper calls mint on cDAIMock
    // NOTE: for Fulcrum rate should be higher then _setPriceInToken due to fee
    await this.cDAIMock._setExchangeRateStored(BNify('250000000000000000000000000')); // 0.025 DAI
    // await this.DAIMock.transfer(this.cDAIMock.address, BNify('15').mul(this.one), { from: creator });

    const res1 = await this.token.tokenPrice.call();
    res1.should.be.bignumber.equal(this.one);

    // 9.9 / 0.025 = 396 cTokens (1% is not minted and left as unlent pool)
    await this.token.rebalance();
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('396').mul(this.oneCToken));
    // price is still one because we just minted
    const tokenPrice = await this.token.tokenPrice.call();
    tokenPrice.should.be.bignumber.equal(this.one);
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

    // 500 cDAI are not minted right away they will be minted with the rebalance
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('0').mul(this.oneCToken));
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
    res1.should.be.bignumber.equal(BNify('1000000000000000000'));

    // 9.9 / 0.025 = 396 cTokens (1% is not minted and left as unlent pool)
    await this.token.rebalance();

    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('396').mul(this.oneCToken));

    const tokenPrice = await this.token.tokenPrice.call();
    tokenPrice.should.be.bignumber.equal(BNify('1000000000000000000'));
    // price is still one because we just minted

    await this.cDAIMock._setExchangeRateStored(BNify('300000000000000000000000000')); // 0.03DAI
    await this.cDAIWrapper._setPriceInToken(BNify('300000000000000000000000000')); // 0.03

    const res = await this.token.tokenPrice.call();
    // 396 * 0.03 = 11.88 DAI (nav of cDAI pool)
    // totNav = 11.98 DAI
    // totSupply = 10 IdleDAI
    const expectedRes = BNify('1198000000000000000');
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
    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.token.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.rebalance();

    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceDAIIdle = await this.DAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceDAIIdle.should.be.bignumber.equal(BNify('10').mul(this.one).div(BNify('100')));
    // half on Compound (min 1% unlent) so 5 / 0.02 = 250 -> 247.5 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('24750000000'));
    // half on Fulcrum so (min 1% unlent) 5 / 1.25 = 4 -> 3.96 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('3960000000000000000'));

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
    // current nav cDAI pool is 247.5 * 0.025 = 6.1875 DAI
    // current nav iDAI pool is 3.96 * 1.5 = 5.94 DAI
    // current unlent NAV is 0.1

    // idleToken supply 10
    // currTokenPrice = (6.1875 + 5.94 + 0.1) / 10 = 1.22275
    res1.should.be.bignumber.equal(BNify('1222750000000000000'));

    await this.token.setAllocations(
      [BNify('30000'), BNify('70000'), BNify('0'), BNify('0')],
      {from: manager}
    );

    // Approve and Mint 20 DAI
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);
    // 20 / 1.22275 = 16.3565732979 idleTokens minted
    // totSupply = 26.356573297894091187
    // currNav = 26.356573297894091187 * 1.22275 (or 20 + 10 * 1.22275 = 32.2275)

    // Token price is still not modified because tokens are not lent yet
    const priceRes2 = await this.token.tokenPrice.call();
    priceRes2.should.be.bignumber.equal(BNify('1222750000000000000'));

    await this.token.rebalance();
    // before the actual rebalance
    // maxUnlentPool = 0.322275
    // toLend = 20.1 - 0.322275 = 19.777725
    // 30% -> 5.9333175 on Compound -> 237.3327 cDAI
    // 70% -> 13.8444075 on Fulcrum -> 9.229605 iDAI

    // cDAI -> 237.3327 + 247.5 = 484.8327 -> (* 0.025 = 12.1208175 DAI)
    // iDAI -> 9.229605 + 3.96 = 13.189605 -> (* 1.5 = 19.7844075 DAI)
    // maxUnlentPool = 0.322275

    // to do the rebalance
    // maxUnlentPool = 0.322275
    // toLend = 32.2275 - 0.322275 = 31.905225
    // 30% -> 9.5715675 on Compound -> 382.8627 cDAI
    //        currently 484.8327 cDAI so redeem 484.8327 - 382.8627 = 101.97 cDAI -> * 0.025 = 2.54925 DAI, toMint = 0
    // 70% -> 22.3336575 on Fulcrum -> 14.889105 iDAI
    //        currently 13.189605 iDAI so toMint = 14.889105 - 13.189605 = 1.6995 iDAI -> * 1.5 = 2.54925 DAI

    const resBalanceDAIIdle2 = await this.DAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceDAIIdle2.should.be.bignumber.equal(BNify('322275000000000000'));

    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('38286270000'));
    // half on Fulcrum so (min 1% unlent) 5 / 1.25 = 4 -> 3.96 iDAI in idle pool
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI2.should.be.bignumber.equal(BNify('14889105000000000000'));

    await this.cDAIWrapper._setPriceInToken(BNify('300000000000000000000000000')); // 0.03
    await this.cDAIMock._setExchangeRateStored(BNify('300000000000000000000000000'));

    const res = await this.token.tokenPrice.call();
    // current nav cDAI pool is 382.426291836 * 0.03 = 11.47278875508 DAI
    // current nav iDAI pool is 14.8721335714 * 1.5 = 22.3082003571 DAI
    // current unlent NAV is 0.321907653061
    // tot 34.1028967652
    // totSupply = 26.3265306122 IdleDAI
    const expectedRes = BNify('1295381350000000000'); // 1.2953
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
  it('get current avg apr of idle (with no COMP apr)', async function () {
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
    res.should.be.bignumber.equal(BNify('2161290322580645161'));
  });
  it('get current avg apr of idle with COMP', async function () {
    await this.cDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%
    await this.iDAIWrapper._setAPR(BNify('2000000000000000000')); // 2%
    await this.aDAIWrapper._setAPR(BNify('3000000000000000000')); // 3%
    await this.yxDAIWrapper._setAPR(BNify('4000000000000000000')); // 4%
    await this.PriceOracleMock._setAPR(BNify('4000000000000000000')); // 4%

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

    // tot AUM = 31

    // 10/31 * (1 + 4) + 11/31 * 2 + 5/31 * 3 + 5/31 * 4 = 3.45161290323%
    await this.token.getAvgAPR();
    const res = await this.token.getAvgAPR.call();
    res.should.be.bignumber.equal(BNify('3451612903225806451'));
  });
  it('mints idle tokens', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1100000000000000000')); // 1.1DAI

    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.token.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      {from: manager}
    );
    // Approve and Mint 10 DAI, all on Compound so 10 / 0.02 = 500 cDAI in idle pool
    // tokenPrice is 1 here
    const receipt = await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // so 10 DAI will be transferred from nonOwner
    const resBalanceDAI = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('0').mul(this.one));
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));

    expectEvent(receipt, 'Referral', {
      _amount: BNify('10').mul(this.one),
      _ref: this.someAddr
    });
  });
  it('mints idle tokens and rebalance if flag is passed', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1100000000000000000')); // 1.1DAI

    await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
    await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.token.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      {from: manager}
    );
    // Approve and Mint 10 DAI, all on Compound so 10 / 0.02 = 500 cDAI in idle pool
    // tokenPrice is 1 here
    const receipt = await this.mintIdleWithRebalance(BNify('10').mul(this.one), nonOwner);
    // so 10 DAI will be transferred from nonOwner
    const resBalanceDAI = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('0').mul(this.one));
    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    const resBalanceDAIIdle = await this.DAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceDAIIdle.should.be.bignumber.equal(BNify('10').mul(this.one).div(BNify('100')));
    const resBalanceCDAIIdle = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceCDAIIdle.should.be.bignumber.equal(BNify('495').mul(this.oneCToken));

    expectEvent(receipt, 'Referral', {
      _amount: BNify('10').mul(this.one),
      _ref: this.someAddr
    });
  });
  // it('cannot mints if iToken price has decreased', async function () {
  //   await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
  //
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   const price = await this.token.lastITokenPrice.call();
  //   price.should.be.bignumber.equal(BNify('1250000000000000000'));
  //   await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.25DAI
  //   await expectRevert(
  //     this.mintIdle(BNify('10').mul(this.one), nonOwner),
  //     'IDLE:ITOKEN_PRICE'
  //   );
  // });
  // it('can mints if iToken price has decreased and contract has been manually played (ie itoken addr == 0)', async function () {
  //   await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
  //   await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
  //
  //   // all funds will be sent to one protocol (Compound)
  //   await this.token.setAllocations(
  //     [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
  //     {from: manager}
  //   );
  //
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   const price = await this.token.lastITokenPrice.call();
  //   price.should.be.bignumber.equal(BNify('1250000000000000000'));
  //   await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.25DAI
  //
  //   await this.token.setIToken(this.ETHAddr, {from: creator});
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   // lastITokenPrice should not be updated
  //   const price2 = await this.token.lastITokenPrice.call();
  //   price2.should.be.bignumber.equal(BNify('1250000000000000000'));
  // });
  // it('after mint lastITokenPrice is updated if has increased', async function () {
  //   await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
  //   await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI
  //
  //   // all funds will be sent to one protocol (Compound)
  //   await this.token.setAllocations(
  //     [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
  //     {from: manager}
  //   );
  //
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   const price = await this.token.lastITokenPrice.call();
  //   price.should.be.bignumber.equal(BNify('1250000000000000000'));
  //
  //   await this.iDAIMock.setPriceForTest(BNify('1300000000000000000'));
  //   await this.iDAIWrapper._setPriceInToken(BNify('1300000000000000000')); // 1.25DAI
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   const price2 = await this.token.lastITokenPrice.call();
  //   price2.should.be.bignumber.equal(BNify('1300000000000000000'));
  // });
  it('cannot mints idle tokens when paused', async function () {
    await this.token.pause({from: creator});
    await this.DAIMock.transfer(nonOwner, BNify('10').mul(this.one), { from: creator });
    await this.DAIMock.approve(this.token.address, BNify('10').mul(this.one), { from: nonOwner });
    await expectRevert.unspecified(this.token.mintIdleToken(BNify('10').mul(this.one), true, this.someAddr, { from: nonOwner }));
  });
  it('does not redeem if idleToken total supply is 0', async function () {
    await expectRevert.unspecified(this.token.redeemIdleToken(BNify('10').mul(this.one), { from: nonOwner }));
  });
  it('redeems idle tokens', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // First mint with tokenPrice = 1
    await this.token.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.rebalance();

    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('24750000000'));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('3960000000000000000'));

    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('10').mul(this.one));

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});
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
  it('redeems idle tokens using unlent pool', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // First mint with tokenPrice = 1
    await this.token.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.rebalance();

    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('24750000000'));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('3960000000000000000'));

    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('100000000000000000'), {from: nonOwner}); // 1e17
    redeemedTokens.should.be.bignumber.equal(BNify('100000000000000000'));

    await this.token.redeemIdleToken(BNify('100000000000000000'), {from: nonOwner}); // 1e17

    const resBalanceIdle2 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle2.should.be.bignumber.equal(BNify('9900000000000000000')); // 9.9
    // IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('9900000000000000000')); // 9.9
    // cDAI
    const resBalance2 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('24750000000'));
    // there are no iDAI in Idle contract
    const resBalanceIDAI2 = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI2.should.be.bignumber.equal(BNify('3960000000000000000'));
    // 10 DAI are given back to nonOwner
    const resBalanceDAI = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('100000000000000000')); // 1e17
    // 0 DAI are in Idle contract
    const resBalanceDAI2 = await this.DAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceDAI2.should.be.bignumber.equal(BNify(0).mul(this.one));
  });
  it('redeemInterestBearingTokens', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // First mint with tokenPrice = 1
    await this.token.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      {from: manager}
    );

    // Approve and Mint 10 DAI,
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.rebalance();

    // so 10 IdleDAI will be minted to nonOwner
    const resBalanceIdle = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle.should.be.bignumber.equal(BNify('10').mul(this.one));
    // half on Compound so 5 / 0.02 = 250 cDAI in idle pool
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('24750000000'));
    // half on Fulcrum so 5 / 1.25 = 4 iDAI in idle pool
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('3960000000000000000'));
    const resBalanceDAI = await this.DAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('100000000000000000'));
    const resBalanceDAIOwnerBefore = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });

    // Redeems 10 IdleDAI
    await this.token.pause({from: creator});
    await this.token.redeemInterestBearingTokens(BNify('10').mul(this.one), {from: nonOwner});
    await this.token.unpause({from: creator});

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
    resBalanceCDAIOwner.should.be.bignumber.equal(BNify('24750000000'));
    const resBalanceIDAIOwner = await this.iDAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIDAIOwner.should.be.bignumber.equal(BNify('3960000000000000000'));
    const resBalanceDAIOwner = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAIOwner.sub(resBalanceDAIOwnerBefore).should.be.bignumber.equal(BNify('100000000000000000'));
  });
  it('cannot rebalance when paused', async function () {
    await this.token.pause({from: creator});
    await expectRevert.unspecified(this.token.rebalance());
  });
  // it('cannot rebalance if iToken price has decreased', async function () {
  //   await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI
  //   await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
  //   await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.0DAI
  //   await expectRevert(
  //     this.token.rebalance({ from: creator }),
  //     'IDLE:ITOKEN_PRICE'
  //   );
  // });
  // it('can rebalance if iToken price has decreased and contract has been manually played', async function () {
  //   await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI
  //   await this.cDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
  //   await this.iDAIWrapper._setAvailableLiquidity(BNify('1000000').mul(this.one)); // 1M
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   await this.iDAIMock.setPriceForTest(BNify('1000000000000000000')); // 1.0DAI
  //   await this.token.setIToken(this.ETHAddr, { from: creator });
  //   await this.token.setAllocations(
  //     [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
  //     {from: manager}
  //   );
  //   await this.token.rebalance({ from: creator });
  // });
  // it('after rebalance lastITokenPrice is updated if it increased', async function () {
  //   await this.iDAIMock.setPriceForTest(BNify('1300000000000000000')); // 1.30DAI
  //   await this.mintIdle(BNify('10').mul(this.one), nonOwner);
  //   const price = await this.token.lastITokenPrice.call();
  //   price.should.be.bignumber.equal(BNify('1300000000000000000'));
  //
  //   await this.iDAIMock.setPriceForTest(BNify('1500000000000000000')); // 1.30DAI
  //   await this.token.setAllocations(
  //     [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
  //     {from: manager}
  //   );
  //   await this.token.rebalance({ from: creator });
  //   const price2 = await this.token.lastITokenPrice.call();
  //   price2.should.be.bignumber.equal(BNify('1500000000000000000'));
  // });
  it('rebalances when _newAmount > 0 and only one protocol is used', async function () {
    await this.token.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      {from: manager}
    );

    // Approve and Mint 10 DAI for nonOwner, everything on Compound
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    const res = await this.token.rebalance.call({ from: creator });
    res.should.be.equal(false);
    // it should mint (10 - 1%) / 0.02 = 495cDAI
    const receipt = await this.token.rebalance({ from: creator });

    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('49500000000'));
    const resBalanceDAI = await this.DAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('100000000000000000'));
  });
  it('rebalances when _newAmount > 0 and only one protocol is used and no unlent pool', async function () {
    await this.token.setAllocations(
      [BNify('100000'), BNify('0'), BNify('0'), BNify('0')],
      {from: manager}
    );

    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

    // Approve and Mint 10 DAI for nonOwner, everything on Compound
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    const res = await this.token.rebalance.call({ from: creator });
    res.should.be.equal(false);
    // it should mint 10 / 0.02 = 500cDAI
    // plus 500 cDAI from before
    const receipt = await this.token.rebalance({ from: creator });

    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('50000000000'));
    const resBalanceDAI = await this.DAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceDAI.should.be.bignumber.equal(BNify('0'));
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

    await this.token.setAllocations(
      [BNify('50000'), BNify('50000'), BNify('0'), BNify('0')],
      {from: manager}
    );
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.rebalance({ from: creator });
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('24750000000'));
    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('3960000000000000000'));
    (await this.DAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('100000000000000000'));
    (await this.token.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('10').mul(this.one));

    await this.token.setAllocations(
      [BNify('20000'), BNify('80000'), BNify('0'), BNify('0')],
      {from: manager}
    );

    const res = await this.token.rebalance.call();
    res.should.be.equal(true);
    const receipt = await this.token.rebalance({ from: creator });

    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('9900000000'));
    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('6336000000000000000'));
    (await this.DAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('100000000000000000'));

    expectEvent(receipt, 'Rebalance', {
      _rebalancer: creator,
      _amount: BNify('10').mul(this.one)
    });
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
  it('_redeemAllNeeded (public version) when liquidity is available', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]
    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransfer(
      this.protocolTokens,
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
      this.protocolTokens,
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
      this.protocolTokens,
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
    // pool value = 30 DAI
    // Set rebalancer allocations
    await this.setRebAllocations(['33333', '33333', '16667', '16667']);

    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransferRaw(this.protocolTokens, ['0', '0', '5049901000000000000', '5049901000000000000']); // 5.05

    // await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

    const res = await this.token.rebalance.call();
    await this.token.rebalance();
    res.should.equal(true);

    BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('49499505000')); // 495 cToken
    BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('7919920800000000000')); // 7.92 iToken
    BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('4950099000000000000')); // 4.95 aToken
    BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('2475049500000000000')); // 2.475 yxToken
    BNify(await this.DAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('300000000000000000')); // 0.3 DAI

    // Allocations are correct
    await this.testIdleAllocations(['33333', '33333', '16667', '16667']);
  });
  it('rebalance when liquidity is not available', async function () {
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1', '4']); // 1M each
    // await this.setLiquidityRaw([1e24, 1e24, '1010000000000000000', '4040000000000000000']); // 1M each first 2 then, 1.01 and 4.04

    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    await this.token.setLastAllocations([BNify('25000'), BNify('25000'), BNify('25000'), BNify('25000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['33333', '33333', '16667', '16667']);

    // Give underlying Tokens to protocols wrappers for redeem
    // await this.daiMultiTransferRaw(this.protocolTokens, ['0', '0', '1010000000000000000', '4040000000000000000']);
    await this.daiMultiTransfer(this.protocolTokens, ['0', '0', '1', '4']);


    const res = await this.token.rebalance.call();
    await this.token.rebalance();
    res.should.equal(true);

    BNify(await this.cDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('36750000000'));
    BNify(await this.iDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('5880000000000000000'));
    BNify(await this.aDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('9000000000000000000'));
    BNify(await this.yxDAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('3000000000000000000'));
    BNify(await this.DAIMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify('300000000000000000')); // 0.3 DAI
  });
  it('rebalance when liquidity is not available and no unlent perc', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1', '4']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    await this.token.setLastAllocations([BNify('25000'), BNify('25000'), BNify('25000'), BNify('25000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['33333', '33333', '16667', '16667']);

    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransfer(this.protocolTokens, ['0', '0', '1', '4']);

    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    // Set equal allocations
    // Set idle allocations
    await this.token.setLastAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
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
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give protocol Tokens to IdleToken contract
    await this.sendProtocolTokensToIdle(['250', '4', '10', '5']); // [cToken, iToken, aToken, yxToken]

    // Set equal allocations
    // Set idle allocations
    await this.token.setLastAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
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
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

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
    await this.token.setLastAllocations([BNify('0'), BNify('0'), BNify('100000'), BNify('0')]);
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
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

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
    await this.token.setLastAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
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
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.setLastAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('100000'), BNify('0')]),
      'IDLE:NOT_IMPROV'
    );
  });
  it('openRebalance reverts with newAllocations length != lastAllocations.length', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.setLastAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('100000')]),
      'IDLE:!EQ_LEN -- Reason given: IDLE:!EQ_LEN'
    );
  });
  it('openRebalance reverts if it\'s risk adjusted instance', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.setLastAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('100000')]),
      'IDLE:NOT_ALLOWED'
    );
  });
  it('openRebalance reverts when not allocating 100%', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.setLastAllocations([BNify('30000'), BNify('30000'), BNify('20000'), BNify('20000')]);
    // Set rebalancer allocations
    await this.setRebAllocations(['30000', '30000', '20000', '20000']);

    await expectRevert(
      this.token.openRebalance([BNify('0'), BNify('0'), BNify('50000'), BNify('0')]),
      'IDLE:!EQ_TOT -- Reason given: IDLE:!EQ_TOT'
    );
  });
  it('calculates fee correctly when minting / redeeming and no unlent', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.rebalance();

    BNify(await this.token.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('10').mul(this.one));
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // price is now 2
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransfer(this.protocolTokens, ['10', '10', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('19').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('1').mul(this.one));
    // price is still one
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
  });
  it('calculates fee correctly when minting / redeeming with unlent', async function () {
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
    await this.token.rebalance();

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // price is now 2
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(BNify('1990000000000000000'));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['10', '10', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(BNify('1990000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('18910000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('990000000000000000')); // 0.99
    BNify(await this.DAIMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('10000000000000000'));
    // price is still one
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
  });
  it('calculates fee correctly when minting multiple times and redeeming', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

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
    await this.token.rebalance();

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);

    // Second mint at price == 2
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);
    await this.token.rebalance();

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

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});

    // bought 10 @ 1.5, sell 10@4 = 40 - 15 = 25 gain => 22.5 gain (plus 10 * 1.5 deposited) and 2.5 fee
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('37500000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('2500000000000000000'));
    // price is still one
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('1500000000000000000'));
  });
  it('calculates fee correctly when minting multiple times and redeeming with different fees', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});

    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);

    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.rebalance();

    // 5 DAI in compound (250 cDAI), 5 DAI in fulcrum (4 iDAI)
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one);
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // 10 DAI in compound, 10 DAI in fulcrum -> 10 idleDAI tot

    await this.token.setFee(BNify('0'), {from: creator});
    // Second mint at price == 2 with 0 fees
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);
    await this.token.rebalance();
    // 20 DAI in compound, 20 DAI in fulcrum -> 20 idleDAI tot

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('1000000000000000000'));
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Set prices in DAI => [0.08, 5, 1, 2]
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);
    // 40 DAI in compound, 40 DAI in fulcrum -> 20 idleDAI tot

    // price is now 4
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('4')));

    await this.token.setFee(BNify('10000'), {from: creator});
    // Third mint at price == 4 with 10% fees so 5 new idleDAI
    // -> tot 25 IdleDAI with 50 invested
    // -> avg price = 2
    // noFeeQty = 10 idleDAI
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);
    await this.token.rebalance();
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('2000000000000000000'));

    // Set prices in DAI => [0.16, 10, 1, 2]
    await this.setPrices(['1600000000000000000000000000', '10000000000000000000', this.one, '2000000000000000000']);
    // price is now 8
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('8')));
    // 100 DAI in compound, 100 DAI in fulcrum -> 25 idleDAI tot

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['100', '100', '0', '0']);

    // equal to noFeeQty so no fee
    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});

    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('80000000000000000000'));
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('2000000000000000000'));

    await this.token.redeemIdleToken(BNify('15').mul(this.one), {from: nonOwner});
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('2000000000000000000'));

    // paid 15 * 2 = 30, curr val 15 * 8 = 120 -> gain 90 -> 81 user 9 fee -> 81 + 30 + 80 = 191 user
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('9000000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('191000000000000000000'));
  });
  it('calculates fee correctly when redeeming a transferred idleToken amount', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.rebalance();
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

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: someone});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.DAIMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('19').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(this.one);
    // price is still one
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(this.one);
  });
  it('calculates fee correctly when redeeming a transferred idleToken amount with different fees', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee, 0% on gain
    await this.token.setFee(BNify('0'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), foo);
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    // Approve and Mint 10 DAI for nonOwner -> nofee = 10
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    await this.token.rebalance();
    await this.token.setFee(BNify('10000'), {from: creator});

    // noFee nonOwner should be 0
    // noFee someone should be 10
    await this.token.transfer(someone, BNify('10').mul(this.one), {from: nonOwner});

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one);

    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // price is now 2
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['10', '10', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: someone});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.DAIMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('20').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('0'));

    // noFee nonOwner should be 0
    await this.mintIdle(BNify('10').mul(this.one), nonOwner); // 5 idleDAI minted
    await this.token.rebalance();
    // Set prices in DAI => [0.08, 5, 1, 2]
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);
    // price is now 4
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('4')));

    await this.daiMultiTransfer(tokens, ['10', '10', '0', '0']);
    await this.token.redeemIdleToken(BNify('5').mul(this.one), {from: nonOwner});
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('19').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('1').mul(this.one));
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('2').mul(this.one));
  });
  it('calculates fee correctly when redeeming a transferred idleToken amount after having previosly deposited', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.rebalance();

    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one.mul(BNify('1')));
    // Set prices and calculates
    // Set prices in DAI => [0.04, 2.5, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // someone has 5 idleToken
    await this.token.rebalance();

    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(this.one.mul(BNify('2')));

    await this.token.transfer(someone, BNify('10').mul(this.one), {from: nonOwner});
    // someone has 15 idleToken

    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('1333333333333333333'));
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // Set prices in DAI => [0.08, 5, 1, 2]
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);
    // price is now 4
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('4')));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['20', '20', '0', '0']);

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: someone});
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('4')));
    BNify(await this.DAIMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('37333333333333333333'));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('2666666666666666667'));
    // price is still one
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('1333333333333333333'));
  });
  it('calculates fee correctly when using transferFrom', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.rebalance();
    // Set prices in DAI => [0.04, 2.5, 1, 2]
    // idle price is 2
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    await this.mintIdle(BNify('10').mul(this.one), someone);
    // someone has 5 idleToken
    await this.token.rebalance();

    await this.token.approve(someone, BNify('10').mul(this.one), {from: nonOwner});
    await this.token.transferFrom(nonOwner, someone,  BNify('10').mul(this.one), {from: someone});
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(this.one.mul(BNify('1')));
    BNify(await this.token.tokenPrice.call()).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.token.userAvgPrices.call(someone)).should.be.bignumber.equal(BNify('1333333333333333333'));
    BNify(await this.token.balanceOf.call(someone)).should.be.bignumber.equal(this.one.mul(BNify('15')));
    BNify(await this.token.balanceOf.call(nonOwner)).should.be.bignumber.equal(this.one.mul(BNify('0')));
    BNify(await this.token.allowance.call(nonOwner, someone)).should.be.bignumber.equal(this.one.mul(BNify('0')));
  });
  it('charges no fee to whom previously deposited when there was not fee', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
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
    await this.token.rebalance();
    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['10', '10', '0', '0']);
    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('20').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('0'));
  });
  it('charges fee only to some part to whom previously deposited when there was not fee and deposited also when there was a fee', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    await this.token.setFee(BNify('0'), {from: creator});
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
    await this.token.rebalance();
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);

    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    await this.mintIdle(BNify('10').mul(this.one), nonOwner); // usr avg price 2 (first mint does not count)
    await this.token.rebalance();
    // nonOwner has 15 idleDAI
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('2000000000000000000'));
    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.daiMultiTransfer(tokens, ['30', '30', '0', '0']);
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);
    // price is 4 now so totValue 60, initially nonOwner had 10 idle with no fee so 10 * 4 = 40 no fee
    // of the 20 DAI remained, we have 5 idleToken paid 10 so gain is 20-10 = 10 and fee is 1
    await this.token.redeemIdleToken(BNify('15').mul(this.one), {from: nonOwner});
    // avg price do not count userNoFeeQty
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('2000000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('59').mul(this.one));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(this.one);
  });
  it('charges fee only to some part to whom previously deposited when there was fee and deposited also when there was no fee', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for provider
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), foo);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);
    // 10 DAI invested, 10 idleDAI got, price 1 | tot 10 DAI for 10 idleDAI, avgPrice 1, noFeeQty 0
    // Set prices in DAI => [0.04, 2.50, 1, 2]
    await this.token.rebalance();
    await this.setPrices(['400000000000000000000000000', '2500000000000000000', this.one, '2000000000000000000']);
    // token price is 2

    // Set fee, 0% on gain
    await this.token.setFee(BNify('0'), {from: creator});
    await this.mintIdle(BNify('10').mul(this.one), nonOwner); // 5 minted, 5 no fee qty
    // 10 DAI invested, 5 idleDAI got, price 2 | tot 20 DAI for 15 idleDAI invested, avgPrice 1 + noFeeQty 5
    await this.token.rebalance();
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('1000000000000000000'));

    // Give underlying Tokens to protocols wrappers for redeem
    const tokens = [this.cDAIMock.address, this.iDAIMock.address, this.aDAIMock.address, this.yxDAIMock.address];
    await this.setPrices(['800000000000000000000000000', '5000000000000000000', this.one, '2000000000000000000']);
    // price is 4 now

    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    await this.mintIdle(BNify('10').mul(this.one), nonOwner); // 2.5 minted, 5 no fee
    // 10 DAI invested, 2.5 idleDAI got, price 4 | tot 30 DAI for 17.5 idleDAI invested, avgPrice 1.6 (20 invested (10 had no fee) / 12.5 idleDAI) noFeeQty 5
    await this.token.rebalance();
    // nonOwner has 17.5 idleDAI
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('1600000000000000000'));

    // Give underlying Tokens to protocols wrappers for redeem
    await this.daiMultiTransfer(tokens, ['100', '100', '0', '0']);
    // total dai deposited 30
    await this.setPrices(['1600000000000000000000000000', '10000000000000000000', this.one, '4000000000000000000']);
    // price is 8 now

    // tot 30 DAI for 17.5 idleDAI invested, avgPrice 1.6 (20 invested (10 had no fee) / 12.5 idleDAI) noFeeQty 5
    // he is redeeming 8 * 15 = 120 -> 40 no fee + 80 (paid 10 * 1.6 = 16 so 64 left taxable -> 57.6 + 6.4 fee)
    // 40 + 10 + 63 = 113.6
    // 6.4 fee
    await this.token.redeemIdleToken(BNify('15').mul(this.one), {from: nonOwner}); // 120
    BNify(await this.token.userAvgPrices.call(nonOwner)).should.be.bignumber.equal(BNify('1600000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('113600000000000000000'));
    BNify(await this.DAIMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('6400000000000000000'));
  });
  it('redeemGovTokens complex test', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    await this.token.setFee(BNify('0'), {from: creator});
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);
    // Give comptrollerMock some COMP tokens
    await this.COMPMock.transfer(this.ComptrollerMock.address, BNify('10').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.IdleControllerMock.address, BNify('10').mul(this.one), {from: creator});
    await this.setRebAllocations(['100000', '0', '0', '0']);
    // end setup

    await this.mintIdle(BNify('1').mul(this.one), someone);
    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.ComptrollerMock.setAmount(BNify('1').mul(this.one));
    await this.IdleControllerMock.setAmount(BNify('1').mul(this.one));
    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.mintIdle(BNify('1').mul(this.one), foo); // someone 3 COMP
    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator}); // foo 0.5 someone 3.5
    await this.IDLEMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.mintIdle(BNify('7').mul(this.one), someone); // +1 COMP -> someone + 0.5 // foo 1 someone 4
    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator}); // 4 + 8/9 someone - 1 + 1/9 foo
    await this.IDLEMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.mintIdle(BNify('11').mul(this.one), foo); // +1 COMP -> someone + 0.8888 // 4 + 8/9 + 8/9 someone - 1 + 2/9 foo
    await this.COMPMock.transfer(this.token.address, BNify('2').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.token.address, BNify('2').mul(this.one), {from: creator});
    // +0.8 someone, +1.2 foo
    // someone 4 + 16/9.0 + 0.8 = 6.5777777777777775
    // foo 1 + 2/9 + 1.2 = 2.4222222222222225

    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.mintIdle(BNify('100').mul(this.one), foo); // +1 COMP -> someone + 0.4, foo + 0.6 // +0.8 someone - + 1.2 foo // foo 112 - someone 8
    // someone 6.5777777777777775 + 0.8 = 7.377777777777777
    // foo 2.4222222222222225 + 1.2 = 3.6222222222222227
    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));
    await this.IdleControllerMock.setAmount(BNify('0').mul(this.one));

    // foo tot -> 0.5 + 0.11111 + 1.2 + 0.6 = 2.411111
    // someone -> 2 + 0.5 + 0.88888 + 0.8 + 0.4 = 4.58888
    BNify(await this.COMPMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('3377777777777777778'));
    BNify(await this.IDLEMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('3377777777777777778'));
    await this.token.redeemIdleToken(BNify('0'), {from: someone});
    await this.token.redeemIdleToken(this.one, {from: foo});

    BNify(await this.COMPMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('2'));
    BNify(await this.IDLEMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('2'));
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('3622222222222222222'));
    BNify(await this.IDLEMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('3622222222222222222'));
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('7377777777777777776'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('7377777777777777776'));
  });
  it('redeemGovTokens', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee, 10% on gain
    await this.token.setFee(BNify('0'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Give comptrollerMock some COMP tokens
    await this.COMPMock.transfer(this.ComptrollerMock.address, BNify('10').mul(this.one), {from: creator});

    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), someone);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    await this.token.rebalance();

    await this.ComptrollerMock.setAmount(BNify('1').mul(this.one));

    // token 1
    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    // token 2
    await this.mintIdle(BNify('1').mul(this.one), foo);

    // BNify(await this.token.govTokensIndexes.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.govTokensLastBalances.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, foo), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('0'));

    BNify(await this.COMPMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(this.one.mul(BNify('2')));

    // token 3
    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    // token 4
    await this.mintIdle(BNify('8').mul(this.one), someone);

    // 1 new COMP redeemed so tot 4, 3 for someone and 1 for foo
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(this.one.mul(BNify('3')));

    // BNify(await this.token.govTokensIndexes.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.govTokensLastBalances.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, foo), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('0'));

    await this.token.redeemIdleToken(this.one, {from: foo});
    // 1 redeemd, someone has 9 idleTOken and foo only one so 0.9 to someone and 0.1 to foo
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('1100000000000000000'));
    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));
    await this.token.redeemIdleToken(BNify('0'), {from: someone});

    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('3900000000000000000'));

    await this.ComptrollerMock.setAmount(BNify('1').mul(this.one));
    // someone has 9 idleToken
    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.mintIdle(BNify('1').mul(this.one), foo);

    // someone is entitled to 1
    await this.COMPMock.transfer(this.token.address, BNify('10').mul(this.one), {from: creator});
    //
    // BNify(await this.token.govTokensIndexes.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(BNify('1711111111111111111'));
    // BNify(await this.token.govTokensLastBalances.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(BNify('1000000000000000006'));
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, foo), {from: foo}).should.be.bignumber.equal(BNify('1711111111111111111'));
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('1600000000000000000'));

    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));
    await this.token.redeemIdleToken(BNify('0'), {from: someone});
    await this.token.redeemIdleToken(BNify('0'), {from: foo});
    // someone is entitled to 1 + 10 * 0.9 = 10 (+ 2.4 of before)
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('14899999999999999998'));
    // foo is entitled to 10 * 0.1 = 1 (+ 0.6 of before)
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('2100000000000000000'));
  });
  it('redeemGovTokens test 2', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee, 10% on gain
    await this.token.setFee(BNify('0'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Give comptrollerMock some COMP tokens
    await this.COMPMock.transfer(this.ComptrollerMock.address, BNify('10').mul(this.one), {from: creator});

    // Simulate a prev mint
    await this.mintIdle(BNify('100000000000000000'), someone); // 0.1
    BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('0'));
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    await this.token.rebalance();
    await this.COMPMock.transfer(this.token.address, BNify('100000000000000000'), {from: creator}); // 0.1

    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));

    await this.mintIdle(BNify('100000000000000000'), someone);
    // at this point someone should be entitled to 0.1 COMP

    // BNify(await this.token.govTokensIndexes.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one.div(BNify('10')));
    // BNify(await this.token.govTokensLastBalances.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one.div(BNify('10')));
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('50000000000000000'));

    BNify(await this.COMPMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(this.one.div(BNify('10')));
    await this.token.redeemIdleToken(BNify('0'), {from: someone});
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(this.one.div(BNify('10')));
  });
  it('getGovTokensAmounts', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee, 10% on gain
    await this.token.setFee(BNify('0'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Give comptrollerMock some COMP tokens
    await this.COMPMock.transfer(this.ComptrollerMock.address, BNify('10').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.IdleControllerMock.address, BNify('10').mul(this.one), {from: creator});

    // Simulate a prev mint
    await this.mintIdle(BNify('100000000000000000'), someone); // someone deposits 0.1
    BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('0'));
    BNify(await this.token.usersGovTokensIndexes.call(this.IDLEMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('0'));
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    await this.token.rebalance();
    await this.COMPMock.transfer(this.token.address, BNify('100000000000000000'), {from: creator}); // token's comps 0.1
    await this.IDLEMock.transfer(this.token.address, BNify('100000000000000000'), {from: creator});

    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));
    await this.IdleControllerMock.setAmount(BNify('0').mul(this.one));

    await this.mintIdle(BNify('100000000000000000'), someone); // someone deposits 0.2 - someone's comps 0.1 - tokens's comps 0
    // at this point someone should be entitled to 0.1 COMP

    // BNify(await this.token.govTokensIndexes.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one.div(BNify('10')));
    // BNify(await this.token.govTokensIndexes.call(this.IDLEMock.address), {from: foo}).should.be.bignumber.equal(this.one.div(BNify('10')));
    // BNify(await this.token.govTokensLastBalances.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one.div(BNify('10')));
    // BNify(await this.token.govTokensLastBalances.call(this.IDLEMock.address), {from: foo}).should.be.bignumber.equal(this.one.div(BNify('10')));
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('50000000000000000'));
    // BNify(await this.token.usersGovTokensIndexes.call(this.IDLEMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('50000000000000000'));

    BNify(await this.COMPMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.IDLEMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('0'));

    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('100000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('100000000000000000'));

    const govAmounts = await this.token.getGovTokensAmounts(someone, {from: someone});
    BNify(govAmounts[0]).should.be.bignumber.equal(BNify('0'));
    BNify(govAmounts[1]).should.be.bignumber.equal(BNify('0'));
    await this.token.redeemIdleToken(BNify('0'), {from: someone});
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('100000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('100000000000000000'));
  });
  it('redeemGovTokens with fee', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee, 10% on gain
    await this.token.setFee(BNify('10000'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Give comptrollerMock some COMP tokens
    await this.COMPMock.transfer(this.ComptrollerMock.address, BNify('10').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.IdleControllerMock.address, BNify('10').mul(this.one), {from: creator});

    // Simulate a prev mint
    await this.mintIdle(BNify('1').mul(this.one), someone); // someone's deposits 1
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    await this.token.rebalance();

    await this.ComptrollerMock.setAmount(BNify('1').mul(this.one));
    await this.IdleControllerMock.setAmount(BNify('1').mul(this.one));

    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator}); // token's comps 1 (1 comps should go to someone)
    await this.IDLEMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});
    await this.mintIdle(BNify('1').mul(this.one), foo); // token's comps 2 - foo's deposits 1 - someone's deposits 1 (2 comps should go to someone, 0 to foo)
    // at this point someone should be entitled to 2 COMP and foo to 0
    (await this.ComptrollerMock.compAddr.call()).should.be.equal(this.COMPMock.address);
    (await this.IdleControllerMock.idleAddr.call()).should.be.equal(this.IDLEMock.address);
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(this.one.mul(BNify('0')));
    BNify(await this.IDLEMock.balanceOf.call(foo)).should.be.bignumber.equal(this.one.mul(BNify('0')));

    // BNify(await this.token.govTokensIndexes.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.govTokensIndexes.call(this.IDLEMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.govTokensLastBalances.call(this.COMPMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.govTokensLastBalances.call(this.IDLEMock.address), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, foo), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.usersGovTokensIndexes.call(this.IDLEMock.address, foo), {from: foo}).should.be.bignumber.equal(this.one);
    // BNify(await this.token.usersGovTokensIndexes.call(this.COMPMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('0'));
    // BNify(await this.token.usersGovTokensIndexes.call(this.IDLEMock.address, someone), {from: someone}).should.be.bignumber.equal(BNify('0'));

    // // new COMP to the idletoken contract
    // await this.COMPMock.transfer(this.token.address, BNify('10').mul(this.one), {from: creator});
    // await this.IDLEMock.transfer(this.token.address, BNify('10').mul(this.one), {from: creator});

    BNify(await this.COMPMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(this.one.mul(BNify('2')));
    BNify(await this.IDLEMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(this.one.mul(BNify('2')));

    await this.COMPMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator}); // token's comps 3 - foo's deposits 1 - someone's deposits 1 (2.5 should go to someone, 0.5 to foo)
    await this.IDLEMock.transfer(this.token.address, BNify('1').mul(this.one), {from: creator});

    await this.mintIdle(BNify('1').mul(this.one), someone); // token's comps 4 - foo's deposits 1 - someone's deposits 2 - (someone gets 3, 1 to foo)
    // 1 new COMP redeemed so tot 3, 1.5 for someone and 0.5 for foo (- 10% fee)
    // someone 3 - 10%
    // foo should get 1

    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('2700000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('3000000000000000000'));

    await this.token.redeemIdleToken(this.one, {from: foo});
    // someone has 2 idleTOken and foo only one so 0.666667 to someone and 0.3333 to foo (- 10% fee)
    // user someone when minting will also redeemGovTokens prev accrued
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('1200000000000000000'));

    // No fee for IDLE
    BNify(await this.IDLEMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('1333333333333333333'));
    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));
    await this.IdleControllerMock.setAmount(BNify('0').mul(this.one));
    await this.token.redeemIdleToken(BNify('0'), {from: someone});
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('3300000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('3666666666666666666'));
    BNify(await this.COMPMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('499999999999999999'));
    BNify(await this.IDLEMock.balanceOf.call(feeReceiver)).should.be.bignumber.equal(BNify('0'));
  });
  it('redeemGovTokens on transfer to new user', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee, 10% on gain
    await this.token.setFee(BNify('0'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    // Set prices in DAI => [0.02, 1.25, 1, 2]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Give comptrollerMock some COMP tokens
    await this.COMPMock.transfer(this.ComptrollerMock.address, BNify('2').mul(this.one), {from: creator});
    await this.IDLEMock.transfer(this.IdleControllerMock.address, BNify('2').mul(this.one), {from: creator});

    // Simulate a prev mint
    // someone's deposits = 1
    await this.mintIdle(BNify('1').mul(this.one), someone);
    // Set rebalancer allocations
    await this.setRebAllocations(['50000', '50000', '0', '0']);
    await this.token.rebalance();

    await this.ComptrollerMock.setAmount(BNify('1').mul(this.one));
    await this.IdleControllerMock.setAmount(BNify('1').mul(this.one));

    // token's comps = 1; 1 comp should go to someone
    await this.COMPMock.transfer(this.token.address, this.one, {from: creator});
    await this.IDLEMock.transfer(this.token.address, this.one, {from: creator});
    // token's comps = 1 + 1 now from setAmount;
    // => token's comps = 2; someone's deposits = 1; foo's deposits = 1; 2 comps should go to someone
    await this.mintIdle(this.one, foo); // +2 COMP for someone
    // someone deposit's = 0.5; nonOwner deposits = 0.5
    await this.token.transfer(nonOwner, this.one.div(BNify('2')), {from: someone});
    // COMP: 0.5 for someone and 0.5 for nonOwner
    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));
    await this.IdleControllerMock.setAmount(BNify('0').mul(this.one));

    // token's comp = 3; 0.25 + 1 should go to someone, 0.25 + 1 should to go nonOwner. 0.5 should go to foo
    await this.COMPMock.transfer(this.token.address, this.one, {from: creator});
    await this.IDLEMock.transfer(this.token.address, this.one, {from: creator});

    // foo's deposits = 0; foo's comps = 1
    await this.token.redeemIdleToken(this.one, {from: foo});
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('500000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('500000000000000000'));
    await this.token.redeemIdleToken(this.one.div(BNify('2')), {from: nonOwner});
    BNify(await this.COMPMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('1250000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('1250000000000000000'));
    await this.token.redeemIdleToken(this.one.div(BNify('2')), {from: someone});
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('1250000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('1250000000000000000'));
  });
  it('redeemGovTokens on transfer to existing user', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee, 10% on gain
    await this.token.setFee(BNify('0'), {from: creator});
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
    await this.token.rebalance();

    await this.COMPMock.transfer(this.token.address, this.one, {from: creator});
    await this.IDLEMock.transfer(this.token.address, this.one, {from: creator});
    // +1 someone
    await this.mintIdle(this.one, nonOwner);

    await this.COMPMock.transfer(this.token.address, this.one, {from: creator});
    await this.IDLEMock.transfer(this.token.address, this.one, {from: creator});
    // +0.5 COMP for someone, +0.5 nonOwner
    await this.mintIdle(this.one.mul(BNify('2')), foo);

    await this.COMPMock.transfer(this.token.address, this.one, {from: creator});
    await this.IDLEMock.transfer(this.token.address, this.one, {from: creator});
    // +0.25 COMP someone, +0.25 nonOwner, 0.5 foo

    // TOT: 1.75 someone, 0.75 nonOwner, 0.5 foo
    // IDLE -> someone: 1, nonOwner: 1, foo: 2
    await this.token.transfer(nonOwner, this.one.div(BNify('2')), {from: someone});

    // IDLE -> someone: 0.5, nonOwner: 1.5, foo: 2
    await this.COMPMock.transfer(this.token.address, this.one, {from: creator});
    await this.IDLEMock.transfer(this.token.address, this.one, {from: creator});
    // +0.5 foo, +0.375 nonOwner, +0.125 someone
    BNify(await this.COMPMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('4000000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(this.token.address)).should.be.bignumber.equal(BNify('4000000000000000000'));
    BNify(await this.COMPMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.IDLEMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('0'));
    BNify(await this.IDLEMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('0'));

    await this.ComptrollerMock.setAmount(BNify('0').mul(this.one));
    await this.token.redeemIdleToken(BNify('0'), {from: foo});
    BNify(await this.COMPMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('1000000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(foo)).should.be.bignumber.equal(BNify('1000000000000000000'));
    await this.token.redeemIdleToken(BNify('0'), {from: nonOwner});
    BNify(await this.COMPMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('1999999999999999999'));
    BNify(await this.IDLEMock.balanceOf.call(nonOwner)).should.be.bignumber.equal(BNify('1999999999999999999'));
    await this.token.redeemIdleToken(BNify('0'), {from: someone});
    BNify(await this.COMPMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('1000000000000000000'));
    BNify(await this.IDLEMock.balanceOf.call(someone)).should.be.bignumber.equal(BNify('1000000000000000000'));
  });
  it('userNoFeeQty should behave correctly', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee 0%
    await this.token.setFee(BNify('0'), {from: creator});
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
    await this.token.rebalance();
    await this.token.redeemIdleToken(this.one, {from: foo});

    // set fee to 10%
    await this.token.setFee(BNify('10000'), {from: creator});

    await this.mintIdle(BNify('1').mul(this.one), foo);
    await this.token.redeemIdleToken(this.one, {from: foo});
  });
  it('transfer correctly updates userAvgPrice when transferring an amount > of no fee qty', async function () {
    await this.token.setMaxUnlentPerc(BNify('0'), {from: creator});
    // Set fee 0%
    await this.token.setFee(BNify('0'), {from: creator});
    // Set fee address
    await this.token.setFeeAddress(feeReceiver, {from: creator});
    // set available liquidity for providers
    await this.setLiquidity(['1000000', '1000000', '1000000', '1000000']); // 1M each
    await this.setRebAllocations(['100000', '0', '0', '0']);
    // Set prices in DAI => [0.02,...]
    await this.setPrices(['200000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Price 1
    await this.mintIdle(BNify('10').mul(this.one), foo);
    await this.token.rebalance();
    // Set prices in DAI => [0.04, ...]
    await this.setPrices(['400000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Price 2
    await this.mintIdle(BNify('10').mul(this.one), bar);
    await this.token.rebalance();
    // Set prices in DAI => [0.08, ...]
    await this.setPrices(['800000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Set fee
    await this.token.setFee(BNify('10000'), {from: creator});

    // Price 4
    await this.mintIdle(BNify('10').mul(this.one), foo);
    await this.token.rebalance();
    // Set prices in DAI => [0.16, ...]
    await this.setPrices(['1600000000000000000000000000', '1250000000000000000', this.one, '2000000000000000000']);

    // Price 8
    await this.mintIdle(BNify('20').mul(this.one), bar);
    await this.token.rebalance();

    await this.token.transfer(bar, BNify('12500000000000000000'), {from: foo}); // 12.5 tranfer from foo to bar
    (await this.token.userAvgPrices(bar)).should.be.bignumber.equal(BNify('6').mul(this.one));
  });

  it("setAllocations contract fix - setAllocations should not fail if wrappers count increased", async function() {
    const aDAIV2Mock = await DAIMock.new({from: creator});
    const aDAIV2Wrapper = await aDAIWrapperMock.new(
      aDAIV2Mock.address,
      this.DAIMock.address,
      {from: creator}
    );

    const tokens = (await this.token.getAPRs()).addresses.map(a => a); // transform to a normal array
    const wrappers = [];
    const allocations = await this.token.getAllocations();
    for (var i = 0; i < tokens.length; i++) {
      const wrapper = await this.token.protocolWrappers(tokens[i]);
      wrappers.push(wrapper);
    };

    [tokens, wrappers, allocations].forEach(list => {
      list.length.should.be.equal(4);
    });

    tokens.push(aDAIV2Mock.address);
    wrappers.push(aDAIV2Wrapper.address);

    await this.token.setAllAvailableTokensAndWrappers(
      tokens,
      wrappers,
      [BNify('20000'), BNify('20000'), BNify('20000'), BNify('20000'), BNify('20000')],
      true,
      {from: creator}
    );

    await this.token.setAllocations(
      [BNify('20000'), BNify('20000'), BNify('20000'), BNify('20000'), BNify('20000')],
      {from: manager}
    );
  })

  it("setAllocations contract fix - setAllocations should not fail if wrappers count decreased", async function() {
    const aDAIV2Mock = await DAIMock.new({from: creator});
    const aDAIV2Wrapper = await aDAIWrapperMock.new(
      aDAIV2Mock.address,
      this.DAIMock.address,
      {from: creator}
    );

    const tokens = (await this.token.getAPRs()).addresses.map(a => a); // transform to a normal array
    const wrappers = [];
    const allocations = await this.token.getAllocations();
    for (var i = 0; i < tokens.length; i++) {
      const wrapper = await this.token.protocolWrappers(tokens[i]);
      wrappers.push(wrapper);
    };

    [tokens, wrappers, allocations].forEach(list => {
      list.length.should.be.equal(4);
    });

    tokens.pop();
    wrappers.pop();

    await this.token.setAllAvailableTokensAndWrappers(
      tokens,
      wrappers,
      [BNify('60000'), BNify('20000'), BNify('20000')],
      true,
      {from: creator}
    );

    await this.token.setAllocations(
      [BNify('60000'), BNify('20000'), BNify('20000')],
      {from: manager}
    );
  })
});
