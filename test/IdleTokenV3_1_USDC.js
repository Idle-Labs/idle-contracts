const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleTokenV3_1Mock = artifacts.require('IdleTokenV3_1Mock');
const IdleRebalancerV3_1 = artifacts.require('IdleRebalancerV3_1');
const WhitePaperMock = artifacts.require('WhitePaperMock');
const cUSDCMock = artifacts.require('cUSDCMock');
const cUSDCWrapperMock = artifacts.require('cUSDCWrapperMock');
const USDCMock = artifacts.require('USDCMock');
const ComptrollerMock = artifacts.require('ComptrollerMock');
const COMPMock = artifacts.require('COMPMock');
const GasTokenMock = artifacts.require('GasTokenMock');

const BNify = n => new BN(String(n));

contract('IdleTokenV3_1_USDC', function ([_, creator, nonOwner, someone, foo, manager, feeReceiver]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.oneToken = new BN('1000000');
    this.oneCToken = new BN('100000000'); // 8 decimals
    this.oneRay = new BN('1000000000000000000000000000');
    this.oneAToken = this.one; // TODO should be equal to underlying decimals
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    // 1000 USDC are given to creator in USDCMock constructor
    this.USDCMock = await USDCMock.new({from: creator});
    this.COMPMock = await COMPMock.new({from: creator});
    this.GSTMock = await GasTokenMock.new({from: creator});
    this.WhitePaperMock = await WhitePaperMock.new({from: creator});
    // 100.000 cUSDC are given to creator in cUSDCMock constructor
    this.cUSDCMock = await cUSDCMock.new(this.USDCMock.address, creator, this.WhitePaperMock.address, {from: creator});
    this.ComptrollerMock = await ComptrollerMock.new(this.COMPMock.address, this.cUSDCMock.address, {from: creator});
    await this.cUSDCMock._setComptroller(this.ComptrollerMock.address, {from: creator});

    // Use mocked wrappers
    this.cUSDCWrapper = await cUSDCWrapperMock.new(
      this.cUSDCMock.address,
      this.USDCMock.address,
      {from: creator}
    );
    this.protocolTokens = [
      this.cUSDCMock.address,
    ];

    this.IdleRebalancer = await IdleRebalancerV3_1.new(
      this.protocolTokens,
      manager,
      { from: creator }
    );
    this.token = await IdleTokenV3_1Mock.new(
      'IdleUSDC',
      'IDLEUSDC',
      this.USDCMock.address,
      this.ETHAddr,
      this.ETHAddr,
      this.IdleRebalancer.address,
      this.COMPMock.address,
      this.COMPMock.address,
      { from: creator }
    );
    this.idleTokenAddr = this.token.address;

    await this.cUSDCWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.IdleRebalancer.setIdleToken(this.idleTokenAddr, {from: creator});

    this.protocolWrappers = [
      this.cUSDCWrapper.address,
    ];

    await this.token.setAllAvailableTokensAndWrappers(
      this.protocolTokens,
      [this.cUSDCWrapper.address],
      [], true,
      {from: creator}
    );
    await this.token.setGovTokens(
      [this.COMPMock.address], // govTokens
      [this.cUSDCMock.address], // protocolTokens
      {from: creator}
    );

    await this.token.setGST(this.GSTMock.address);

    await this.cUSDCWrapper._setAvailableLiquidity(BNify('1000000').mul(this.oneToken)); // 1M

    await this.token.manualInitialize(
      [this.COMPMock.address],
      [this.cUSDCMock.address],
      [this.cUSDCWrapper.address],
      [BNify('100000')],
      false, // isRiskAdjusted
      {from: creator}
    );
    await this.token.setMaxUnlentPerc(BNify('1000'), {from: creator});
    await this.token.setRebalancer(manager, {from: creator});

    // helper methods
    this.mintIdle = async (amount, who) => {
      // Give USDC to `who`
      await this.USDCMock.transfer(who, amount, { from: creator });
      await this.USDCMock.approve(this.token.address, amount, { from: who });
      const allowance = await this.USDCMock.allowance(who, this.token.address);
      return await this.token.mintIdleToken(amount, true, this.someAddr, { from: who });
    };

    this.testIdleBalance = async amounts => {
      BNify(await this.cUSDCMock.balanceOf(this.token.address, {from: creator})).should.be.bignumber.equal(BNify(amounts[0]).mul(this.oneCToken));
    };
    this.testIdleAllocations = async allocs => {
      for (let i = 0; i < allocs.length; i++) {
        BNify(await this.token.lastAllocations(i, {from: creator})).should.be.bignumber.equal(BNify(allocs[i]));
      }
    };
    this.setPrices = async prices => {
      // Set prices
      await this.cUSDCMock._setExchangeRateStored(BNify(prices[0]));
      await this.cUSDCWrapper._setPriceInToken(BNify(prices[0]));
    }
    this.setLiquidity = async liquidity => {
      // Set liquidity
      await this.cUSDCWrapper._setAvailableLiquidity(BNify(liquidity[0]).mul(this.oneToken));
    }

    this.setRebAllocations = async (allocs) => {
      await this.IdleRebalancer.setAllocations(
        [BNify(allocs[0])],
        this.protocolTokens,
        {from: manager}
      );
    }
  });


  it('calculates current tokenPrice when funds are all in one lowDecimals', async function () {
    await this.setLiquidity(['1000000']); // 1M each
    // Set prices in USDC => [0.02]
    await this.setPrices(['200000000000000']);
    // all funds will be sent to one protocol (Compound)
    await this.setRebAllocations(['100000']);
    // First mint with tokenPrice = 1
    // Approve and Mint 10 USDC, all on Compound so 10 / 0.02 = 500 cUSDC in idle pool
    // tokenPrice is 1 here
    const tokenPriceInit = await this.token.tokenPrice.call();
    tokenPriceInit.should.be.bignumber.equal(this.oneToken);
    await this.mintIdle(BNify('10').mul(this.oneToken), nonOwner);
    // After some time price of cUSDC has increased
    await this.cUSDCWrapper._setPriceInToken(BNify('250000000000000')); // 0.025 USDC
    // Used for when wrapper calls mint on cUSDCMock
    // NOTE: for Fulcrum rate should be higher then _setPriceInToken due to fee
    await this.cUSDCMock._setExchangeRateStored(BNify('250000000000000')); // 0.025 USDC
    // await this.USDCMock.transfer(this.cUSDCMock.address, BNify('15').mul(this.one), { from: creator });

    const res1 = await this.token.tokenPrice.call();
    res1.should.be.bignumber.equal(this.oneToken);

    // 9.9 / 0.025 = 396 cTokens (1% is not minted and left as unlent pool)
    await this.token.rebalance();
    const resBalance2 = await this.cUSDCMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance2.should.be.bignumber.equal(BNify('396').mul(this.oneCToken));
    // price is still one because we just minted
    const tokenPrice = await this.token.tokenPrice.call();
    tokenPrice.should.be.bignumber.equal(this.oneToken);
  });
});
