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
  it('calculates current tokenPrice when funds are in different pools', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // First mint with tokenPrice = 1
    // all funds will be sent to one protocol (Compound)
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('5').mul(this.one), BNify('5').mul(this.one)]
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

    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('12250000000000000000'), BNify('20').mul(this.one)]
    );

    // Approve and Mint 20 DAI
    await this.mintIdle(BNify('20').mul(this.one), nonOwner);

    // total cDAI pool 12.25 / 0.025 = 490 cDAI
    // total iDAI pool 20 / 1.5 = 13.33333 iDAI

    // tokenPrice is still 1.225 here
    // so 20 / 1.225 = 16.3265306122 IdleDAI minted
    const price2 = await this.token.tokenPrice.call();
    // current nav cDAI pool is 490 * 0.025 = 12.25 DAI
    // current nav iDAI pool is 13.33333 * 1.5 = 20 DAI
    // idleToken supply 26.3265306122
    // currTokenPrice = 32.25 / 26.3265306122 = 1.225
    price2.should.be.bignumber.equal(BNify('1224999999999999999'));

    await this.cDAIWrapper._setPriceInToken(BNify('300000000000000000000000000')); // 0.03

    const res = await this.token.tokenPrice.call();
    // 490 * 0.03 = 14.7 DAI (nav of cDAI pool)
    // totNav = 14.7 + 20 = 34.7 DAI
    // totSupply = 26.3265306122 IdleDAI
    const expectedRes = BNify('1318062015503875968'); // 1.318...
    res.should.be.bignumber.equal(expectedRes);
  });
  it('get all APRs from every prtocol', async function () {
    // Prepare fake data for getAPR
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('1100000000000000000')); // 1.1%

    const res = await this.token.getAPRs.call();
    res.addresses[0].should.be.equal(this.cDAIMock.address);
    res.addresses[1].should.be.equal(this.iDAIMock.address);
    res.aprs[0].should.be.bignumber.equal(BNify('2200000000000000000'));
    res.aprs[1].should.be.bignumber.equal(BNify('1100000000000000000'));
  });
  it('mints idle tokens', async function () {
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
  it('cannot mints idle tokens when paused', async function () {
    await this.token.pause({from: creator});
    await this.DAIMock.transfer(nonOwner, BNify('10').mul(this.one), { from: creator });
    await this.DAIMock.approve(this.token.address, BNify('10').mul(this.one), { from: nonOwner });
    await expectRevert.unspecified(this.token.mintIdleToken(BNify('10').mul(this.one), { from: nonOwner }));
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
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('5').mul(this.one), BNify('5').mul(this.one)]
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

    // used for rebalance at the end of the redeem method
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('0').mul(this.one), BNify('0').mul(this.one)]
    );

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
  it('redeems idle tokens and rebalances', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // First mint with tokenPrice = 1
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('5').mul(this.one), BNify('5').mul(this.one)]
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
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('21450000000000000000'), BNify('0').mul(this.one)] // 21.45 DAI, 0 DAI
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

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%
    await this.iDAIWrapper._setAPR(BNify('1100000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('900000000000000000')); // 0.9%
    // everything will go to Compound because next supply rate of compound is > of current Fulcrum rate

    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('0'), BNify('8733624454148471615')] // 0 DAI, 8.73362445415 DAI
    );

    // Redeems 10 IdleDAI
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45 DAI

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});
    // so nonOwner has no IdleDAI
    const resBalanceIdle3 = await this.token.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceIdle3.should.be.bignumber.equal(BNify('0').mul(this.one));
    // 10 IdleDAI have been burned
    const resSupply = await this.token.totalSupply.call({ from: nonOwner });
    resSupply.should.be.bignumber.equal(BNify('8733624454148471615'));
    // there are no cDAI in Idle contract
    const resBalance3 = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance3.should.be.bignumber.equal(BNify('0').mul(this.oneCToken));

    // there are 8.733624454148471615 / 1.3 = 6.718172657037285857 iDAI
    const resBalanceIDAI3 = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI3.should.be.bignumber.equal(BNify('6718172657037285857'));
    // 11.45 DAI are given back to nonOwner
    const resBalanceDAI3 = await this.DAIMock.balanceOf.call(nonOwner, { from: nonOwner });
    resBalanceDAI3.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45
  });
  it('redeems idle tokens and does not rebalances if paused', async function () {
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.02
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.02 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25DAI

    // First mint with tokenPrice = 1
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('5').mul(this.one), BNify('5').mul(this.one)]
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
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('21450000000000000000'), BNify('0').mul(this.one)] // 21.45 DAI, 0 DAI
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
    const redeemedTokens = await this.token.redeemIdleToken.call(BNify('10').mul(this.one), {from: nonOwner});
    redeemedTokens.should.be.bignumber.equal(BNify('11450000000000000000')); // 11.45 DAI

    await this.token.redeemIdleToken(BNify('10').mul(this.one), {from: nonOwner});
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
  it('claimITokens and rebalances', async function () {
    await this.iDAIMock.setToTransfer(BNify('2').mul(this.one), {from: creator});
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('2').mul(this.one), { from: creator });

    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('0'), BNify('0')]
    );

    const res = await this.token.claimITokens.call({from: creator});
    res.should.be.bignumber.equal(BNify('2').mul(this.one));

    await this.token.claimITokens({from: creator});
  });
  it('cannot rebalance when paused', async function () {
    await this.token.pause({from: creator});
    await expectRevert.unspecified(this.token.rebalance(BNify('0').mul(this.one), { from: nonOwner }));
  });
  it('rebalances when _newAmount == 0 and no currentTokensUsed', async function () {
    // Initially when no one has minted `currentTokensUsed` is empty
    // so _rebalanceCheck would return true

    const res = await this.token.rebalance.call(BNify('0').mul(this.one), { from: creator });
    res.should.be.equal(true);
    await this.token.rebalance(BNify('0').mul(this.one), { from: creator });
  });
  it('rebalances when _newAmount > 0 and only one protocol is used', async function () {
    // Initially when no one has minted `currentTokensUsed` is empty
    // so _rebalanceCheck would return true
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('10').mul(this.one), BNify('0').mul(this.one)]
    );

    // Approve and Mint 10 DAI for nonOwner, everything on Compound
    // tokenPrice is 1 here
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('2200000000000000000')); // 2.2%
    await this.iDAIWrapper._setAPR(BNify('1100000000000000000')); // 1.1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('2000000000000000000')); // 2.0%
    // everything will go to Compound because next supply rate of compound is > of current Fulcrum rate
    // so _rebalanceCheck would return true

    await this.DAIMock.transfer(this.token.address, BNify('10').mul(this.one), { from: creator });

    const res = await this.token.rebalance.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(false);
    // it should mint 10 / 0.02 = 500cDAI
    // plus 500 cDAI from before
    await this.token.rebalance(BNify('10').mul(this.one), { from: creator });

    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('1000').mul(this.oneCToken));

    const resFirstToken = await this.token.currentTokensUsed.call(0);
    resFirstToken.should.be.equal(this.cDAIMock.address);

    // there is only one token (invalid opcode)
    await expectRevert.assertion(this.token.currentTokensUsed(1));
  });
  it('rebalances and multiple protocols are used', async function () {
    // update prices
    await this.cDAIWrapper._setPriceInToken(BNify('200000000000000000000000000')); // 0.025
    await this.cDAIMock._setExchangeRateStored(BNify('200000000000000000000000000')); // 0.025 DAI
    await this.iDAIWrapper._setPriceInToken(BNify('1250000000000000000')); // 1.25 DAI
    await this.iDAIMock.setPriceForTest(BNify('1250000000000000000')); // 1.25 DAI

    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('5').mul(this.one), BNify('5').mul(this.one)]
    );
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('2').mul(this.one), BNify('8').mul(this.one)]
    );

    const res = await this.token.rebalance.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(true);
    await this.token.rebalance(BNify('10').mul(this.one), { from: creator });

    // IdleToken should have 2 / 0.02 = 100cDAI
    const resBalance = await this.cDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalance.should.be.bignumber.equal(BNify('100').mul(this.oneCToken));
    // IdleToken should have 8 / 1.25 = 6.4 iDAI
    const resBalanceIDAI = await this.iDAIMock.balanceOf.call(this.token.address, { from: nonOwner });
    resBalanceIDAI.should.be.bignumber.equal(BNify('6400000000000000000'));

    const resFirstToken = await this.token.currentTokensUsed.call(0);
    resFirstToken.should.be.equal(this.cDAIMock.address);
    const resSecondToken = await this.token.currentTokensUsed.call(1);
    resSecondToken.should.be.equal(this.iDAIMock.address);

    // there is only 2 tokens (invalid opcode)
    await expectRevert.assertion(this.token.currentTokensUsed(2));
  });
  it('_rebalanceCheck when no protocol is used', async function () {
    // Initially when no one has minted `currentTokensUsed` is empty
    // so _rebalanceCheck would return true
    const res = await this.token._rebalanceCheck.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(true);
  });
  it('_rebalanceCheck when no protocol is used', async function () {
    // If there is more than one protocol used then returns true
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('5').mul(this.one), BNify('5').mul(this.one)]
    );
    // Approve and Mint 10 DAI for nonOwner
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    const res = await this.token._rebalanceCheck.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(true);
  });
  it('_rebalanceCheck when one protocol is used and curr protocol has not the best rate', async function () {
    // If there is more than one protocol used then returns true
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('10').mul(this.one), BNify('0').mul(this.one)]
    );
    // Approve and Mint 10 DAI for nonOwner all on Compound
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    // Prepare fake data for rebalanceCheck
    await this.iDAIWrapper._setAPR(BNify('2000000000000000000')); // 2%
    await this.cDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%

    const res = await this.token._rebalanceCheck.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(true);
    await this.token._rebalanceCheck(BNify('10').mul(this.one), { from: creator });
  });
  it('_rebalanceCheck when one protocol is used and curr protocol has the best rate (even with _newAmount)', async function () {
    // If there is more than one protocol used then returns true
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('10').mul(this.one), BNify('0').mul(this.one)]
    );
    // Approve and Mint 10 DAI for nonOwner all on Compound
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('2000000000000000000')); // 2%
    await this.iDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('1900000000000000000')); // 1.9%

    const res = await this.token._rebalanceCheck.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(false);
    await this.token._rebalanceCheck(BNify('10').mul(this.one), { from: creator });
  });
  it('_rebalanceCheck when one protocol is used and curr protocol has the best rate (no _newAmount)', async function () {
    // If there is more than one protocol used then returns true
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('10').mul(this.one), BNify('0').mul(this.one)]
    );
    // Approve and Mint 10 DAI for nonOwner all on Compound
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('2000000000000000000')); // 2%
    await this.iDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%
    // await this.cDAIWrapper._setNextSupplyRate(BNify('1900000000000000000')); // 1.9%

    const res = await this.token._rebalanceCheck.call(BNify('0').mul(this.one), { from: creator });
    res.should.be.equal(false);
    await this.token._rebalanceCheck(BNify('0').mul(this.one), { from: creator });
  });
  it('_rebalanceCheck when one protocol is used and curr protocol has not the best rate when _newAmount is supplied', async function () {
    // If there is more than one protocol used then returns true
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('10').mul(this.one), BNify('0').mul(this.one)]
    );
    // Approve and Mint 10 DAI for nonOwner all on Compound
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('2000000000000000000')); // 2%
    await this.iDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%
    await this.cDAIWrapper._setNextSupplyRate(BNify('900000000000000000')); // 0.9%

    const res = await this.token._rebalanceCheck.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(true);
    await this.token._rebalanceCheck(BNify('10').mul(this.one), { from: creator });
  });
  it('_rebalanceCheck when one protocol is used and curr protocol has not the best rate', async function () {
    // If there is more than one protocol used then returns true
    await this.IdleRebalancer._setCalcAmounts(
      [this.cDAIMock.address, this.iDAIMock.address],
      [BNify('10').mul(this.one), BNify('0').mul(this.one)]
    );
    // Approve and Mint 10 DAI for nonOwner all on Compound
    await this.mintIdle(BNify('10').mul(this.one), nonOwner);

    // Prepare fake data for rebalanceCheck
    await this.cDAIWrapper._setAPR(BNify('1000000000000000000')); // 1%
    await this.iDAIWrapper._setAPR(BNify('2000000000000000000')); // 2%

    const res = await this.token._rebalanceCheck.call(BNify('10').mul(this.one), { from: creator });
    res.should.be.equal(true);
    await this.token._rebalanceCheck(BNify('10').mul(this.one), { from: creator });
  });

  // internal methods have been "indirectly" tested through tests of public methods
});
