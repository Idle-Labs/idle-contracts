const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const IdleToken = artifacts.require('IdleToken');
const IdleRebalancer = artifacts.require('IdleRebalancer');
const IdlePriceCalculator = artifacts.require('IdlePriceCalculator');
const IdleCompound = artifacts.require('IdleCompound');
const IdleFulcrum = artifacts.require('IdleFulcrum');
const IdleFactory = artifacts.require('IdleFactory');
const WhitePaperMock = artifacts.require('WhitePaperMock');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleFactory', function ([_, creator, nonOwner, someone, foo]) {
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
    this.IdlePriceCalculator = await IdlePriceCalculator.new({ from: creator });
    this.Factory = await IdleFactory.new({ from: creator });
    // Params for new IdleToken
    this.params = [
      'IdleDAI',
      'IDLEDAI',
      18,
      this.DAIMock.address, this.cDAIMock.address, this.iDAIMock.address,
      this.IdleRebalancer.address,
      this.IdlePriceCalculator.address,
      this.cDAIWrapper.address, this.iDAIWrapper.address
    ];

    this.idleTokenAddr = await this.Factory.newIdleToken.call(...this.params, { from: creator });
    await this.Factory.newIdleToken(...this.params, { from: creator });
    await this.IdleRebalancer.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.cDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
    await this.iDAIWrapper.setIdleToken(this.idleTokenAddr, {from: creator});
  });

  it('allows onlyOwner to set newIdleToken', async function () {
    // get return value of a call
    const res = await this.Factory.newIdleToken.call(...this.params, { from: creator });
    // Do the actual tx
    await this.Factory.newIdleToken(...this.params, { from: creator });
    // Check that underlyingToIdleTokenMap has the correct new IdleToken address
    (await this.Factory.underlyingToIdleTokenMap(this.DAIMock.address)).should.be.equal(res);
    // Check that _token address
    (await this.Factory.tokensSupported(0)).should.be.equal(this.DAIMock.address);
    // Revert if called by non owner
    await expectRevert.unspecified(this.Factory.newIdleToken(...this.params, { from: nonOwner }));
  });

  it('allows onlyOwner to set setTokenOwnershipAndPauser', async function () {
    // get return value of a call
    const IdleDAIAddress = await this.Factory.newIdleToken.call(...this.params, { from: creator });
    // Do the actual tx
    await this.Factory.newIdleToken(...this.params, { from: creator });
    await this.Factory.setTokenOwnershipAndPauser(IdleDAIAddress, { from: creator });

    const token = await IdleToken.at(IdleDAIAddress);
    // Owner of the newly deployed IdleToken should be creator not factory.address
    (await token.owner.call()).should.be.equal(creator);
    // Pauser of the newly deployed IdleToken should be creator not factory.address
    (await token.isPauser.call(creator)).should.be.equal(true);
    (await token.isPauser.call(this.Factory.address)).should.be.equal(false);

    // Revert if called by non owner
    await expectRevert.unspecified(this.Factory.setTokenOwnershipAndPauser(IdleDAIAddress, { from: nonOwner }));
  });

  it('supportedTokens returns an array of all supported tokens', async function () {
    // get return value of a call
    const res = await this.Factory.newIdleToken.call(...this.params, { from: creator });
    // Do the actual tx
    await this.Factory.newIdleToken(...this.params, { from: creator });
    // Check that underlyingToIdleTokenMap has the correct new IdleToken address
    (await this.Factory.underlyingToIdleTokenMap(this.DAIMock.address)).should.be.equal(res);
    // Check that _token address
    (await this.Factory.supportedTokens.call()).should.be.deep.equal([this.DAIMock.address]);
  });

  it('should not push _token address to supportedTokens if was already present in underlyingToIdleTokenMap', async function () {
    // Do the actual tx
    await this.Factory.newIdleToken(...this.params, { from: creator });
    await this.Factory.newIdleToken(...this.params, { from: creator });

    // Check that _token address
    (await this.Factory.supportedTokens.call()).should.be.deep.equal([this.DAIMock.address]);
  });
});
