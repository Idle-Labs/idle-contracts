const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');

const IdleToken = artifacts.require('IdleToken');
const IdleRebalancerMock = artifacts.require('IdleRebalancerMock');
const IdleFactory = artifacts.require('IdleFactory');
const WhitePaperMock = artifacts.require('WhitePaperMock');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const cDAIWrapperMock = artifacts.require('cDAIWrapperMock');
const iDAIWrapperMock = artifacts.require('iDAIWrapperMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleToken', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.oneCToken = new BN('100000000'); // 8 decimals
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    // 1000 DAI are given to creator in DAIMock constructor
    this.DAIMock = await DAIMock.new({from: creator});
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

    this.IdleRebalancer = await IdleRebalancerMock.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.cDAIWrapper.address,
      this.iDAIWrapper.address,
      { from: creator }
    );
    this.Factory = await IdleFactory.new({ from: creator });
    this.idleTokenAddr = await this.Factory.newIdleToken.call(
      'IdleDAI',
      'IDLEDAI',
      18,
      this.DAIMock.address, this.cDAIMock.address, this.iDAIMock.address,
      this.IdleRebalancer.address,
      this.cDAIWrapper.address, this.iDAIWrapper.address,
      { from: creator }
    );
    const res = await this.Factory.newIdleToken(
      'IdleDAI',
      'IDLEDAI',
      18,
      this.DAIMock.address, this.cDAIMock.address, this.iDAIMock.address,
      this.IdleRebalancer.address,
      this.cDAIWrapper.address, this.iDAIWrapper.address,
      { from: creator }
    );
    this.token = await IdleToken.at(this.idleTokenAddr);

    // helper methods
    this.mintIdle = async (amount, who) => {
      // Give DAI to `who`
      await this.DAIMock.transfer(who, amount, { from: creator });
      await this.DAIMock.approve(this.token.address, amount, { from: who });
      await this.token.mintIdleToken(amount, { from: who });
    };
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
  it('constructor set a rebalance address', async function () {
    (await this.token.rebalancer()).should.equal(this.IdleRebalancer.address);
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
  it('constructor set minRateDifference', async function () {
    (await this.token.minRateDifference()).should.be.bignumber.equal(BNify(10**17));
  });
  it('allows onlyOwner to setToken', async function () {
    const val = this.someAddr;
    await this.token.setToken(val, { from: creator });
    (await this.token.token()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setIToken', async function () {
    const val = this.someAddr;
    await this.token.setIToken(val, { from: creator });
    (await this.token.iToken()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setIToken(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setRebalancer', async function () {
    const val = this.someAddr;
    await this.token.setRebalancer(val, { from: creator });
    (await this.token.rebalancer()).should.be.equal(val);

    await expectRevert.unspecified(this.token.setRebalancer(val, { from: nonOwner }));
  });
  it('allows onlyOwner to setProtocolWrapper', async function () {
    const _token = this.someAddr;
    const _wrapper = this.someOtherAddr;
    await this.token.setProtocolWrapper(_token, _wrapper, { from: creator });
    (await this.token.protocolWrappers(_token)).should.equal(_wrapper);
    (await this.token.allAvailableTokens(2)).should.equal(_token);
    await expectRevert.assertion(this.token.allAvailableTokens(3)); // array out-of-bound
    // retest to see that it does not push _token another time
    await this.token.setProtocolWrapper(_token, foo, { from: creator });
    (await this.token.protocolWrappers(_token)).should.equal(foo);
    (await this.token.allAvailableTokens(2)).should.equal(_token);
    await expectRevert.assertion(this.token.allAvailableTokens(3)); // array out-of-bound
    // nonOwner
    await expectRevert.unspecified(this.token.setProtocolWrapper(_token, _wrapper, { from: nonOwner }));
  });
  it('allows onlyOwner to setMinRateDifference ', async function () {
    const val = BNify(10**18);
    await this.token.setMinRateDifference(val, { from: creator });
    (await this.token.minRateDifference()).should.be.bignumber.equal(val);

    await expectRevert.unspecified(this.token.setMinRateDifference(val, { from: nonOwner }));
  });
  it('calculates current tokenPrice when IdleToken supply is 0', async function () {
    const res = await this.token.tokenPrice.call();
    const expectedRes = this.one;
    res.should.be.bignumber.equal(expectedRes);
  });
  it('calculates current tokenPrice when funds are all in one pool', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1100000000000000000')); // 1.1DAI

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('10').mul(this.one), BNify('0').mul(this.one)]
    );
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

    // REMOVE THIS
    // await this.IdleRebalancer._setCalcAmounts(
    //   [this.cDAIMock.address, this.iDAIMock.address],
    //   [BNify('32500000000000000000'), BNify('0').mul(this.one)]
    // );


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

    await this.cDAIWrapper._setPriceInToken(BNify('300000000000000000000000000')); // 0.03

    const res = await this.token.tokenPrice.call();
    // 1300 * 0.03 = 39 DAI (nav of cDAI pool)
    // totNav = 39 DAI
    // totSupply = 26 IdleDAI
    const expectedRes = BNify('1500000000000000000'); // 1.5
    res.should.be.bignumber.equal(expectedRes);
  });
});
