const { expectEvent, singletons, constants, BN, expectRevert } = require('@openzeppelin/test-helpers');

const yxTokenMock = artifacts.require('yxTokenMock');
const DAIMock = artifacts.require('DAIMock');
const DyDxMock = artifacts.require('DyDxMock');
const BNify = n => new BN(String(n));

contract('yxToken', function ([_, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.someAddr = '0x0000000000000000000000000000000000000001';
    this.someOtherAddr = '0x0000000000000000000000000000000000000002';

    this.DAIMock = await DAIMock.new({from: creator});
    this.DyDxMock = await DyDxMock.new(this.DAIMock.address, {from: creator});

    this.yxDAI = await yxTokenMock.new(
      this.DAIMock.address,
      3,
      'yxDAI',
      'yxDAI',
      18,
      creator,
      {from: creator}
    );

    await this.yxDAI.setDyDxProvider(this.DyDxMock.address);
  });

  it('constructor set a underlying address', async function () {
    (await this.yxDAI.underlying()).should.equal(this.DAIMock.address);
  });
  it('constructor set a underlying address', async function () {
    (await this.yxDAI.marketId()).should.be.bignumber.equal(BNify('3'));
  });
  it('balanceInUnderlying', async function () {
    const initialyxDAIBalance = await this.yxDAI.balanceOf.call(creator, { from: creator });

    const big2 = BNify('2').mul(this.one);
    await this.DAIMock.approve(this.yxDAI.address, BNify('-1'), {from: creator});
    await this.yxDAI.setPriceForTest(this.one);
    await this.DyDxMock.setMarketCurrentIndex(BNify('2').mul(this.one), this.one);

    await this.yxDAI.mint(big2, { from: creator });

    BNify(await this.yxDAI.balanceInUnderlying.call(creator)).sub(BNify(initialyxDAIBalance)).should.be.bignumber.equal(big2);
  });
  it('availableLiquidity', async function () {
    await this.DAIMock.transfer(this.DyDxMock.address, BNify('2').mul(this.one), {from: creator});
    (await this.yxDAI.availableLiquidity.call()).should.be.bignumber.equal(BNify('2').mul(this.one));
  });
  it('price', async function () {
    await this.DyDxMock.setMarketCurrentIndex(BNify('2').mul(this.one), this.one);
    (await this.yxDAI.price.call()).should.be.bignumber.equal(this.one);
  });

  it('mint mints yxTokens and deposit them into dydx', async function () {
    const initialDAIBalance = await this.DAIMock.balanceOf.call(creator, { from: creator });
    const initialyxDAIBalance = await this.yxDAI.balanceOf.call(creator, { from: creator });
    // set price to 10**18
    const big2 = BNify('2').mul(this.one);
    await this.yxDAI.setPriceForTest(this.one);
    await this.DyDxMock.setAccountPar(BNify('0'));
    // approve yxDAI to spend creator's DAI
    await this.DAIMock.approve(this.yxDAI.address, BNify('-1'), {from: creator});
    // check tokens Minted
    const res = await this.yxDAI.mint.call(big2, { from: creator });
    res.should.be.bignumber.equal(big2);
    // do the actual tx
    await this.yxDAI.mint(big2, { from: creator });
    const endyxDAIBalance = await this.yxDAI.balanceOf.call(creator, { from: creator });
    (endyxDAIBalance.sub(initialyxDAIBalance)).should.be.bignumber.equal(big2);
    const endDAIBalance = await this.DAIMock.balanceOf.call(creator, { from: creator });
    (initialDAIBalance.sub(endDAIBalance)).should.be.bignumber.equal(big2);
  });

  it('redeem underlying tokens and burn yxTokens', async function () {
    const big2 = BNify('2').mul(this.one);
    // Fund yxToken with 2 DAI
    await this.DAIMock.transfer(this.yxDAI.address, big2, {from: creator});
    const initialDAIBalance = await this.DAIMock.balanceOf.call(creator, { from: creator });
    const initialyxDAIBalance = await this.yxDAI.balanceOf.call(creator, { from: creator });
    await this.yxDAI.setPriceForTest(this.one);
    await this.DyDxMock.setAccountPar(BNify('0'));

    // mint 2 yxDAI
    await this.DAIMock.approve(this.yxDAI.address, BNify('-1'), {from: creator});
    await this.yxDAI.mint(big2, { from: creator });
    // now creator has 2 yxDAI, dydx has 2 DAI

    // price doubled
    await this.yxDAI.setPriceForTest(big2);
    await this.DyDxMock.setAccountPar(BNify('4').mul(this.one));
    // redeems 2 yxDAI for 4 DAI
    await this.yxDAI.redeem(big2, creator, { from: creator });
    // creator should have 4 DAI, and dydx 0 DAI

    const endDAIBalance = await this.DAIMock.balanceOf.call(creator, { from: creator });
    (endDAIBalance.sub(initialDAIBalance)).should.be.bignumber.equal(big2);
    const endDyDxDAIBalance = await this.DAIMock.balanceOf.call(this.DyDxMock.address, { from: creator });
    (endDyDxDAIBalance).should.be.bignumber.equal(BNify('0'));
    const endyxDAIBalance = await this.yxDAI.balanceOf.call(creator, { from: creator });
    (initialyxDAIBalance.sub(endyxDAIBalance)).should.be.bignumber.equal(BNify('0'));
  });

  it('_mintDyDx', async function () {
    const big2 = BNify('2').mul(this.one);
    await this.DAIMock.transfer(this.yxDAI.address, big2, {from: creator});
    // set price to 10**18
    await this.yxDAI.setPriceForTest(this.one);
    await this.DyDxMock.setMarketCurrentIndex(big2, this.one);
    // approve yxDAI to spend creator's DAI
    await this.DAIMock.approve(this.yxDAI.address, BNify('-1'), {from: creator});
    // check tokens Minted, call the public version
    await this.yxDAI.mintDyDx(big2, { from: creator });
    const transfer = await this.DyDxMock.transfers.call(this.yxDAI.address, { from: creator });
    transfer.account.should.be.equal(this.yxDAI.address);
    transfer.value.should.be.bignumber.equal(big2);
    transfer.isDeposit.should.be.equal(true);
    transfer.marketId.should.be.bignumber.equal(BNify('3'));
  });

  it('_redeemDyDx', async function () {
    const big2 = BNify('2').mul(this.one);
    await this.DAIMock.transfer(this.DyDxMock.address, big2, {from: creator});
    // set price to 10**18
    await this.yxDAI.setPriceForTest(this.one);
    await this.DyDxMock.setMarketCurrentIndex(big2, this.one);
    await this.DAIMock.approve(this.yxDAI.address, BNify('-1'), {from: creator});
    await this.yxDAI.mint(big2, { from: creator }); // 2 DAI are now in yxDAI
    const balanceOfYxDAIBefore = await this.DAIMock.balanceOf.call(this.yxDAI.address, { from: creator });
    await this.yxDAI.redeemDyDx(big2, { from: creator });

    const balanceOfYxDAI = await this.DAIMock.balanceOf.call(this.yxDAI.address, { from: creator });
    BNify(balanceOfYxDAI).sub(BNify(balanceOfYxDAIBefore)).should.be.bignumber.equal(big2);

    const transfer = await this.DyDxMock.transfers.call(this.yxDAI.address, { from: creator });
    transfer.account.should.be.equal(this.yxDAI.address);
    transfer.value.should.be.bignumber.equal(big2);
    transfer.isDeposit.should.be.equal(false);
    transfer.marketId.should.be.bignumber.equal(BNify('3'));
  });
});
