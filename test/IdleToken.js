const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');

const IdleToken = artifacts.require('IdleToken');
const IdleRebalancer = artifacts.require('IdleRebalancer');
const IdleCompound = artifacts.require('IdleCompound');
const IdleFulcrum = artifacts.require('IdleFulcrum');
const WhitePaperMock = artifacts.require('WhitePaperMock');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleToken', function ([_, creator, nonOwner, someone, foo]) {
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

    this.IdleRebalancer = await IdleRebalancer.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.cDAIWrapper.address,
      this.iDAIWrapper.address,
      { from: creator }
    );

    this.token = await IdleToken.new(
      'IdleDAI',
      'IDLEDAI',
      18,
      this.DAIMock.address,
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.IdleRebalancer.address,
      this.cDAIWrapper.address,
      this.iDAIWrapper.address,
      { from: creator }
    );
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
});
