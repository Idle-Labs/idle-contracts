const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;

const IdleDAI = artifacts.require('IdleDAI');
const TestableIdleDAI = artifacts.require('TestableIdleDAI');
const IdleHelp = artifacts.require('IdleHelp');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('TestableIdleDAI (internal functions exposed as public)', function ([_, registryFunder, creator, nonOwner, someone]) {
  beforeEach(async function () {
    this.DAIMock = await DAIMock.new({from: creator});
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, someone, {from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, someone, {from: creator});
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.IdleHelp = await IdleHelp.new();
    await TestableIdleDAI.link(IdleHelp, this.IdleHelp.address);

    // this.erc1820 = await singletons.ERC1820Registry(registryFunder);
    this.token = await TestableIdleDAI.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.DAIMock.address,
      { from: creator }
    );
  });
  it('_mintCTokens', async function () {
    const DAIBalance = await this.DAIMock.balanceOf(creator);
    const expectedBalance = BNify('1000').mul(this.one);
    assert.equal(BNify(DAIBalance).toString(), expectedBalance.toString(), 'DAI balance is correct for owner');

    // owner transfers 1 DAI to the contract
    await this.DAIMock.transfer(this.token.address, this.one, {from: creator});

    const res = await this.token._mintCTokens.call(this.one, { from: creator });
    res.should.be.bignumber.equal(new BN('5000000000')); // 50 cToken

    await this.token._mintCTokens(this.one, { from: creator });
    const cDAIBalance = await this.cDAIMock.balanceOf(this.token.address);
    cDAIBalance.should.be.bignumber.equal(new BN('5000000000')); // 50 cToken
    // test that DAI are not present in this.token
  });
  it('_mintITokens', async function () {
    const DAIBalance = await this.DAIMock.balanceOf(creator);
    const expectedBalance = BNify('1000').mul(this.one);
    assert.equal(BNify(DAIBalance).toString(), expectedBalance.toString(), 'DAI balance is correct for owner');

    // owner transfers 1 DAI to the contract
    await this.DAIMock.transfer(this.token.address, this.one, {from: creator});

    const res = await this.token._mintITokens.call(this.one, { from: creator });
    res.should.be.bignumber.equal(new BN('998231572268577347')); // 1 iToken
    await this.token._mintITokens(this.one, { from: creator });
    const iDAIBalance = await this.iDAIMock.balanceOf(this.token.address);
    iDAIBalance.should.be.bignumber.equal(new BN('998231572268577347')); // 1 iToken
    // test that DAI are not present in this.token
  });
  it('_redeemCTokens', async function () {
    const DAIBalance = await this.DAIMock.balanceOf(creator);
    const expectedBalance = BNify('1000').mul(this.one);
    assert.equal(BNify(DAIBalance).toString(), expectedBalance.toString(), 'DAI balance is correct for owner');

    // owner transfers 1 DAI to the contract
    await this.DAIMock.transfer(this.token.address, this.one, {from: creator});
    // owner transfers 100 DAI to the contract
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});

    await this.token._mintCTokens(this.one, { from: creator });
    const cDAIBalance = await this.cDAIMock.balanceOf(this.token.address);
    cDAIBalance.should.be.bignumber.equal(new BN('5000000000')); // 50 cToken

    await this.cDAIMock.setExchangeRateStoredForTest();
    const res = await this.token._redeemCTokens.call(cDAIBalance, this.token.address, { from: creator });
    res.should.be.bignumber.equal(new BN('1100000000000000000'));
    await this.token._redeemCTokens(cDAIBalance, this.token.address, { from: creator });
    const DAIBalanceAfter = await this.DAIMock.balanceOf(this.token.address);
    DAIBalanceAfter.should.be.bignumber.equal(new BN('1100000000000000000'));
    // test that DAI are not present in this.token
  });
  it('_redeemCTokens to Address', async function () {
    const DAIBalance = await this.DAIMock.balanceOf(creator);
    const expectedBalance = BNify('1000').mul(this.one);
    assert.equal(BNify(DAIBalance).toString(), expectedBalance.toString(), 'DAI balance is correct for owner');

    // owner transfers 1 DAI to the contract
    await this.DAIMock.transfer(this.token.address, this.one, {from: creator});
    // owner transfers 100 DAI to the contract
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});

    await this.token._mintCTokens(this.one, { from: creator });
    const cDAIBalance = await this.cDAIMock.balanceOf(this.token.address);
    cDAIBalance.should.be.bignumber.equal(new BN('5000000000')); // 50 cToken

    await this.cDAIMock.setExchangeRateStoredForTest();
    const res = await this.token._redeemCTokens.call(cDAIBalance, creator, { from: creator });
    res.should.be.bignumber.equal(new BN('1100000000000000000'));
    await this.token._redeemCTokens(cDAIBalance, creator, { from: creator });
    const DAIBalanceAfter = await this.DAIMock.balanceOf(creator);
    DAIBalanceAfter.should.be.bignumber.equal(new BN('900100000000000000000'));
    // test that DAI are not present in this.token
  });
  it('_redeemITokens', async function () {
    const DAIBalance = await this.DAIMock.balanceOf(creator);
    const expectedBalance = BNify('1000').mul(this.one);
    assert.equal(BNify(DAIBalance).toString(), expectedBalance.toString(), 'DAI balance is correct for owner');

    // owner transfers 1 DAI to the contract
    await this.DAIMock.transfer(this.token.address, this.one, {from: creator});
    // owner transfers 100 DAI to the contract
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('100').mul(this.one), {from: creator});

    const res = await this.token._redeemITokens.call(this.one, this.token.address, { from: creator });
    res.should.be.bignumber.equal(this.one); // 1 iDAI
    await this.token._redeemITokens(this.one, this.token.address, { from: creator });
    const DAIBalanceAfter = await this.DAIMock.balanceOf(this.token.address);
    DAIBalanceAfter.should.be.bignumber.equal(this.one.mul(new BN('2'))); // 2 DAI (one was sent before)
    // test that DAI are not present in this.token
  });
});
