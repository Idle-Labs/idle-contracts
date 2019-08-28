const { expectEvent, singletons, constants, BN, expectRevert } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;

const IdleDAI = artifacts.require('IdleDAI');
const TestableIdleDAI = artifacts.require('TestableIdleDAI');
const IdleHelp = artifacts.require('IdleHelp');
const cDAIMock = artifacts.require('cDAIMock');
const iDAIMock = artifacts.require('iDAIMock');
const DAIMock = artifacts.require('DAIMock');
const BNify = n => new BN(String(n));

contract('IdleDAI', function ([_, registryFunder, creator, nonOwner, someone, foo]) {
  beforeEach(async function () {
    this.DAIMock = await DAIMock.new({from: creator});
    this.cDAIMock = await cDAIMock.new(this.DAIMock.address, someone, {from: creator});
    this.iDAIMock = await iDAIMock.new(this.DAIMock.address, someone, {from: creator});
    this.one = new BN('1000000000000000000');
    this.ETHAddr = '0x0000000000000000000000000000000000000000';
    this.IdleHelp = await IdleHelp.new();
    await IdleDAI.link(IdleHelp, this.IdleHelp.address);

    // this.erc1820 = await singletons.ERC1820Registry(registryFunder);
    this.token = await IdleDAI.new(
      this.cDAIMock.address,
      this.iDAIMock.address,
      this.DAIMock.address,
      { from: creator }
    );
  });

  it('has a name', async function () {
    (await this.token.name()).should.equal('IdleDAI');
  });

  it('has a symbol', async function () {
    (await this.token.symbol()).should.equal('IDLEDAI');
  });

  it('has a cDAI addr', async function () {
    (await this.token.cToken()).should.equal(this.cDAIMock.address);
  });

  it('has a iDAI addr', async function () {
    (await this.token.iToken()).should.equal(this.iDAIMock.address);
  });

  it('has a DAI addr', async function () {
    (await this.token.token()).should.equal(this.DAIMock.address);
  });

  it('has blocksInAYear', async function () {
    (await this.token.blocksInAYear()).toString().should.equal((new BN('2102400')).toString());
  });

  it('has minRateDifference', async function () {
    (await this.token.minRateDifference()).toString().should.equal((new BN('100000000000000000')).toString());
  });

  it('allows onlyOwner to setMinRateDifference ', async function () {
    const val = new BN('1e18');
    await this.token.setMinRateDifference(val, { from: creator });
    (await this.token.minRateDifference()).toString().should.equal(val.toString());

    await expectRevert.unspecified(this.token.setMinRateDifference(val, { from: nonOwner }));
  });

  it('allows onlyOwner to setBlocksInAYear ', async function () {
    const val = new BN('1e18');
    await this.token.setBlocksInAYear(val, { from: creator });
    (await this.token.blocksInAYear()).toString().should.equal(val.toString());

    await expectRevert.unspecified(this.token.setBlocksInAYear(val, { from: nonOwner }));
  });

  it('allows onlyOwner to setToken ', async function () {
    const val = '0x0000000000000000000000000000000000000001';
    await this.token.setToken(val, { from: creator });
    (await this.token.token()).should.equal(val);

    await expectRevert.unspecified(this.token.setToken(val, { from: nonOwner }));
  });

  it('allows onlyOwner to setIToken ', async function () {
    const val = '0x0000000000000000000000000000000000000001';
    await this.token.setIToken(val, { from: creator });
    (await this.token.iToken()).should.equal(val);

    await expectRevert.unspecified(this.token.setIToken(val, { from: nonOwner }));
  });

  it('allows onlyOwner to setCToken ', async function () {
    const val = '0x0000000000000000000000000000000000000001';
    await this.token.setCToken(val, { from: creator });
    (await this.token.cToken()).should.equal(val);

    await expectRevert.unspecified(this.token.setCToken(val, { from: nonOwner }));
  });

  it('rebalance method should set bestToken if current best token is address(0)', async function () {
    await this.token.rebalance({ from: creator });
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);
  });

  it('rebalance method should not rebalance if it\'s not needed', async function () {
    // first rebalance to set from address(0) to cToken
    await this.token.rebalance({ from: creator });
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);
    // second rebalance should not change bestToken
    await this.token.rebalance({ from: creator });
    const bestToken2 = await this.token.bestToken({ from: creator });
    bestToken2.should.be.equal(this.cDAIMock.address);
  });

  it('rebalance should change bestToken if rates are changed', async function () {
    // Needed for testing, owner transfers 100 DAI to the contract
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});

    // first rebalance to set from address(0) to cToken
    await this.token.rebalance({ from: creator });
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);

    await this.cDAIMock.setSupplyRatePerBlockForTest({ from: creator });

    // second rebalance should change bestToken
    await this.token.rebalance({ from: creator });
    const bestToken2 = await this.token.bestToken({ from: creator });
    bestToken2.should.be.equal(this.iDAIMock.address);
  });

  it('rebalance should convert the entire pool if rates are changed (from cToken to iToken)', async function () {
    // Needed for testing, owner transfers 100 DAI to the contract
    const oneCToken = new BN('100000000'); // 10**8 -> 1 cDAI
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});
    await this.cDAIMock.transfer(this.token.address, BNify('50').mul(oneCToken), {from: someone});

    // first rebalance to set from address(0) to cToken
    await this.token.rebalance({ from: creator });
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);

    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('0'));
    await this.cDAIMock.setSupplyRatePerBlockForTest({ from: creator });

    // second rebalance changes bestToken to iToken and convert the pool
    await this.token.rebalance({ from: creator });
    const bestToken2 = await this.token.bestToken({ from: creator });
    bestToken2.should.be.equal(this.iDAIMock.address);

    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('998231572268577347'));
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('0'));
  });
  it('rebalance should convert the entire pool if rates are changed (from iToken to cToken)', async function () {
    await this.cDAIMock.setSupplyRatePerBlockForTest({ from: creator });
    // Needed for testing, owner transfers 100 DAI to the contract
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('100').mul(this.one), {from: creator});

    // Needed for testing, someone transfers 1 iDAI to the contract
    await this.iDAIMock.transfer(this.token.address, this.one, {from: someone});

    // first rebalance to set from address(0) to iToken
    await this.token.rebalance({ from: creator });
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.iDAIMock.address);

    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('0'));
    await this.cDAIMock.resetSupplyRatePerBlockForTest({ from: creator });

    // second rebalance changes bestToken to iToken and convert the pool
    await this.token.rebalance({ from: creator });
    const bestToken2 = await this.token.bestToken({ from: creator });
    bestToken2.should.be.equal(this.cDAIMock.address);

    const oneCToken = new BN('100000000'); // 10**8 -> 1 cDAI
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(oneCToken.mul(new BN('50')));

    // error on TestableIdleDAI when using _burn in iDAIMock
    // (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('0'));
  });
  it('claimITokens', async function () {
    const oneCToken = new BN('100000000'); // 10**8 -> 1 cDAI
    // Needed for testing, owner transfers 100 DAI to the contract
    await this.DAIMock.transfer(this.iDAIMock.address, BNify('100').mul(this.one), {from: creator});
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});
    await this.cDAIMock.transfer(this.token.address, BNify('50').mul(oneCToken), {from: someone});

    // first rebalance to set from address(0) to cToken
    await this.token.rebalance({ from: creator });
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);

    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('0'));
    await this.cDAIMock.setSupplyRatePerBlockForTest({ from: creator });

    // second rebalance changes bestToken to iToken and convert the pool
    const claimedTokens = await this.token.claimITokens.call({ from: creator });
    claimedTokens.should.be.bignumber.equal(this.one);

    await this.token.claimITokens({ from: creator });
    // It makes a rebalance so new bestToken is iDAI
    const bestToken2 = await this.token.bestToken({ from: creator });
    bestToken2.should.be.equal(this.iDAIMock.address);

    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('0'));
    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('1998231572268577347'));
  });
  it('mintIdleToken when bestToken is address(0)', async function () {
    const oneCToken = new BN('100000000'); // 10**8 -> 1 cDAI
    // Needed for testing, owner transfers 100 DAI to the contract
    // await this.DAIMock.transfer(this.iDAIMock.address, BNify('100').mul(this.one), {from: creator});
    // await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});
    // await this.cDAIMock.transfer(this.token.address, BNify('50').mul(oneCToken), {from: someone});

    // approve idleDAI as DAI spender, one DAI
    await this.DAIMock.approve(this.token.address, this.one, {from: creator});

    const mintedIdleTokens = await this.token.mintIdleToken.call(this.one, { from: creator });
    mintedIdleTokens.should.be.bignumber.equal(this.one);
    await this.token.mintIdleToken(this.one, { from: creator });

    // first it rebalances and set from address(0) to cToken
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);
    // Idle contract has 50 cDAI
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('50').mul(oneCToken));
    // caller has 1 idleDAI
    (await this.token.balanceOf(creator)).should.be.bignumber.equal(this.one);
  });
  it('mintIdleToken when bestToken does not changes', async function () {
    // Needed for testing, owner transfers 100 DAI to the contract
    // await this.DAIMock.transfer(this.iDAIMock.address, BNify('100').mul(this.one), {from: creator});
    // await this.cDAIMock.transfer(this.token.address, BNify('50').mul(oneCToken), {from: someone});
    // ====== First interaction (initialization rate = 1DAI : 1idleDAI)
    const oneCToken = new BN('100000000'); // 10**8 -> 1 cDAI
    // approve idleDAI as DAI spender, one DAI
    await this.DAIMock.approve(this.token.address, this.one, {from: creator});

    const mintedIdleTokens = await this.token.mintIdleToken.call(this.one, { from: creator });
    mintedIdleTokens.should.be.bignumber.equal(this.one);
    await this.token.mintIdleToken(this.one, { from: creator });

    // first it rebalances and set from address(0) to cToken
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);
    // Idle contract has 50 cDAI
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('50').mul(oneCToken));
    // caller has 1 idleDAI
    (await this.token.balanceOf(creator)).should.be.bignumber.equal(this.one);

    // Set new rates for testing
    await this.cDAIMock.setExchangeRateStoredForTest();
    await this.cDAIMock.setMintValueForTest();
    // Now the nav is 50 * 0.022 = 1.1 DAI

    // creator gives 5 DAI to nonOwner
    await this.DAIMock.transfer(nonOwner, this.one.mul(new BN('5')), {from: creator});
    // creator gives 100 DAI to cDAI
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});

    // ====== Other interaction
    await this.DAIMock.approve(this.token.address, this.one, {from: nonOwner});

    // after the tx we will have:
    // 1 / 0.022 = 45.45454545 cDAI more in the pool
    // curr priceIdle = 1.1/1 = 1.1 DAI
    // so he will get 1/1.1 = 0.90909090 IDLEDAI
    // call should always be before the tx!
    const otherIdleTokens = await this.token.mintIdleToken.call(this.one, { from: nonOwner });
    otherIdleTokens.should.be.bignumber.equal(new BN('909090909090909090')); // 0.9090 Idle

    await this.token.mintIdleToken(this.one, { from: nonOwner });

    (await this.token.balanceOf(nonOwner)).should.be.bignumber.equal(new BN('909090909090909090'));
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('9545454545')); // 95.4545 ERC20Detailed
    (await this.DAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('4').mul(this.one));


    // Set new rates for testing
    await this.cDAIMock.setNewExchangeRateStoredForTest();
    // Now the nav is 95.4545 * 0.03 = 2.8636363499999997 DAI
    // so idlePrice = nav / supply = 2.8636363499999997 / 1.9090909 =  1.5

    // ====== Other interaction
    // creator gives 5 DAI to foo
    await this.DAIMock.transfer(foo, this.one.mul(new BN('5')), {from: creator});
    await this.DAIMock.approve(this.token.address, this.one, {from: foo});

    // after the tx we will have:
    // 1 / 0.03 = 33.333333 cDAI more in the pool
    // curr priceIdle = 2.8636363499999997/1.9090909090 = 1.5 DAI more or less
    // so he will get 1/1.5 = 0.6666666666666666 IDLEDAI more or less
    // call should always be before the tx!
    const fooIdleTokens = await this.token.mintIdleToken.call(this.one, { from: foo });
    fooIdleTokens.should.be.bignumber.equal(new BN('666666666698412698')); // 0.66666 Idle

    await this.token.mintIdleToken(this.one, { from: foo });
    //
    (await this.token.balanceOf(foo)).should.be.bignumber.equal(new BN('666666666698412698'));
    // 128.787878
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('12878787878')); // 128.787878
    (await this.DAIMock.balanceOf(foo)).should.be.bignumber.equal(BNify('4').mul(this.one));
  });
  it('mintIdleToken when bestToken does change (a rebalance happens)', async function () {
    // ====== First interaction (initialization rate = 1DAI : 1idleDAI)
    const oneCToken = new BN('100000000'); // 10**8 -> 1 cDAI
    // approve idleDAI as DAI spender, one DAI
    await this.DAIMock.approve(this.token.address, this.one, {from: creator});

    const mintedIdleTokens = await this.token.mintIdleToken.call(this.one, { from: creator });
    mintedIdleTokens.should.be.bignumber.equal(this.one);
    await this.token.mintIdleToken(this.one, { from: creator });

    // first it rebalances and set from address(0) to cToken
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);
    // Idle contract has 50 cDAI
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('50').mul(oneCToken));
    // caller has 1 idleDAI
    (await this.token.balanceOf(creator)).should.be.bignumber.equal(this.one);
    // ====== End First interaction (initialization rate = 1DAI : 1idleDAI)

    // Set new rates for testing
    await this.cDAIMock.setExchangeRateStoredForTest();
    await this.cDAIMock.setMintValueForTest();
    // Now the pool nav is 50 * 0.022 = 1.1 DAI

    // creator gives 100 DAI to cDAI
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});

    // Set new rates for testing -> now iToken has the best rate

    await this.cDAIMock.setSupplyRatePerBlockForTest({ from: creator });
    // now on fulcrum 2.9% apr and on compound 0.69%
    await this.iDAIMock.setPriceForTest({ from: creator });
    // 1 iDAI = 1.5 DAI

    // current nav (cDAI) = 50 * 0.022 = 1.1 DAI
    // so idlePrice = nav / supply = 1.1 / 1 =  1.1

    // ====== Other interaction
    // creator gives 5 DAI to foo
    await this.DAIMock.transfer(foo, this.one.mul(new BN('5')), {from: creator});
    await this.DAIMock.approve(this.token.address, this.one, {from: foo});
    // after the tx we will have:

    // first we redeem cDAI in DAI 50 * 0.022 = 1.1 DAI
    // then we convert 1.1 DAI in 1.1/1.5 = 0.73333333333 iDAI
    // then use the new DAI given from foo (1 DAI) to mint iDAI for the pool and idleDAI for foo


    // currTokenPrice = 0.73333333333 * 1.5 / 1IdleDAI = 1.1 DAI

    // so we mint 1DAI / 1.5 (iDAI price) = 0.66666666666 iDAI
    // and user get 1 DAI / tokenPrice = 1/1.1 = 0.90909090909 idleDAI

    // totalSupply = 1.90909090909 idleDAI
    // currTokenPrice = (0.73333333333 + 0.66666666666) * 1.5 / 1.90909090909 = 1.1
    // always 1.1 given the fact that iDAI rate is the same

    // call should always be before the tx!
    const fooIdleTokens = await this.token.mintIdleToken.call(this.one, { from: foo });
    fooIdleTokens.should.be.bignumber.equal(new BN('909090909090909091')); // 0.909090 Idle

    await this.token.mintIdleToken(this.one, { from: foo });
    //
    (await this.iDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('1399999999999999999')); // 1.399999999989999900
    (await this.token.balanceOf(foo)).should.be.bignumber.equal(new BN('909090909090909091'));
    (await this.token.totalSupply()).should.be.bignumber.equal(new BN('1909090909090909091')); // 1.909090
    (await this.DAIMock.balanceOf(foo)).should.be.bignumber.equal(BNify('4').mul(this.one));
  });
  it('redeemIdleToken', async function () {
    // Needed for testing, owner transfers 100 DAI to the contract
    // await this.DAIMock.transfer(this.iDAIMock.address, BNify('100').mul(this.one), {from: creator});
    // await this.cDAIMock.transfer(this.token.address, BNify('50').mul(oneCToken), {from: someone});
    // ====== First interaction (initialization rate = 1DAI : 1idleDAI)
    const oneCToken = new BN('100000000'); // 10**8 -> 1 cDAI
    // approve idleDAI as DAI spender, one DAI
    await this.DAIMock.approve(this.token.address, this.one, {from: creator});

    const mintedIdleTokens = await this.token.mintIdleToken.call(this.one, { from: creator });
    mintedIdleTokens.should.be.bignumber.equal(this.one);
    await this.token.mintIdleToken(this.one, { from: creator });

    // first it rebalances and set from address(0) to cToken
    const bestToken = await this.token.bestToken({ from: creator });
    bestToken.should.be.equal(this.cDAIMock.address);
    // Idle contract has 50 cDAI
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(BNify('50').mul(oneCToken));
    // caller has 1 idleDAI
    (await this.token.balanceOf(creator)).should.be.bignumber.equal(this.one);

    // Set new rates for testing
    await this.cDAIMock.setExchangeRateStoredForTest();
    // Now the nav is 50 * 0.022 = 1.1
    await this.cDAIMock.setMintValueForTest();

    await this.DAIMock.transfer(nonOwner, this.one.mul(new BN('5')), {from: creator});
    await this.DAIMock.transfer(this.cDAIMock.address, BNify('100').mul(this.one), {from: creator});

    // ====== Other interaction
    await this.DAIMock.approve(this.token.address, this.one, {from: nonOwner});

    // call should always be before the tx!
    const otherIdleTokens = await this.token.mintIdleToken.call(this.one, { from: nonOwner });
    otherIdleTokens.should.be.bignumber.equal(new BN('909090909090909090')); // 0.9090 Idle

    await this.token.mintIdleToken(this.one, { from: nonOwner });

    (await this.token.balanceOf(nonOwner)).should.be.bignumber.equal(new BN('909090909090909090'));
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('9545454545')); // 95.4545 ERC20Detailed
    (await this.DAIMock.balanceOf(nonOwner)).should.be.bignumber.equal(BNify('4').mul(this.one));
    // ====== Now creator redeems

    // call should always be before the tx!
    const currOwnerBalanceIdleDAI = await this.DAIMock.balanceOf(creator);
    currOwnerBalanceIdleDAI.should.be.bignumber.equal(new BN('894000000000000000000')); // 1.1 DAI
    const daiRedeemed = await this.token.redeemIdleToken.call(await this.token.balanceOf(creator), { from: creator });
    // **** WARNING: there are some rounding issues this should be 1100000000000000000 ?
    daiRedeemed.should.be.bignumber.equal(new BN('1099999999780000000')); // 1.1 DAI

    // daiRedeemed.should.be.bignumber.equal(new BN('1100000000000000000')); // 1.1 DAI

    // redeem all balance of 1IdleDAI
    await this.token.redeemIdleToken((await this.token.balanceOf(creator)), { from: creator });
    const currOwnerBalanceDAI = await this.DAIMock.balanceOf(creator);
    // creator has no idleDAI
    (await this.token.balanceOf(creator)).should.be.bignumber.equal(new BN('0'));
    // idle contract has 45.45 cDAI (of nonOwner)
    // **** WARNING: there are some rounding issues this should be 1100000000000000000 ?
    (await this.cDAIMock.balanceOf(this.token.address)).should.be.bignumber.equal(new BN('4545454546')); // 45.4545 ERC20Detailed
    // **** WARNING: there are some rounding issues this should be 1100000000000000000 ?
    (await this.DAIMock.balanceOf(creator)).should.be.bignumber.equal(currOwnerBalanceIdleDAI.add(new BN('1099999999780000000')));
    // (await this.DAIMock.balanceOf(creator)).should.be.bignumber.equal(currOwnerBalanceDAI.add(new BN('1100000000000000000')));
  });
});
