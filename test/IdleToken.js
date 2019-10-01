const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;

const IdleToken = artifacts.require('IdleToken');
const IdleRebalancer = artifacts.require('IdleRebalancer');
const IdleCompound = artifacts.require('IdleCompound');
const IdleFulcrum = artifacts.require('IdleFulcrum');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleToken', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';

    this.DAIMock = await DAIMock.new({from: creator});
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, someone, {from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, someone, {from: creator});

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

  it('has a name', async function () {
    (await this.token.name()).should.equal('IdleDAI');
  });

  it('has a symbol', async function () {
    (await this.token.symbol()).should.equal('IDLEDAI');
  });
});
