# Idle contracts
Live version: [https://idle.finance](https://idle.finance)

### Introduction
Idle allows you to get the best interest rate on the market, by investing in a single token.

This product allows users to optimize profitability and seamlessly get the highest yield, without having to manually switch funds between lending protocols to chase the best returns.

Funds of users are pooled together in the main contract (one for each token supported) and for every interaction with Idle the smart contract checks interest rates on various lending protocols and rebalance the pool if needed, in order to give the user the highest aggregated interest rate for all funds.

So by buying and holding IdleTokens, your underlying position will be dynamically rebalanced when the best rate changes in order to always give you the most profitable return.

### Backstory

The current version of [Idle smart contract](https://etherscan.io/address/0xacf651aad1cbb0fd2c7973e2510d6f63b7e440c9) works in a simple, but not very scalable way: when rates changes on a lending provider, and any user lend or redeem their token, we check the current rates and rebalance the whole pool from a protocol to another if needed.

This opens up an importante edge case, when we move a lot of funds from a protocol to another we could potentially cause a variation of rates in the target protocol which in turns can results in a rate which is less than the previous one. More info here: https://medium.com/@idlefinance/on-current-decentralized-rebalance-67e5a51b763 .

The new version of contracts in this repo dynamically rebalances the pool and it does not move all funds from a protocol to another, but instead calculates the amounts that should be placed on each protocol in order to have the aggregated best interest rate for all funds.

Contracts in this repo contains the new rebalance process with dynamic funds allocation mostly as described in the article.

### High level intro of overall system
`IdleToken` contract pools funds of users together and convert them into interest bearing assets (cTokens, iTokens and others in the future). `IdleToken` is an ERC20 token, given to the user and rapresent the right to redeem a share of the pooled funds.
The price for buying IdleTokens, is based on the `totalSupply` and the current Net Asset Value (NAV) of all interest-bearing tokens in the `IdleToken` contract.

NOTE: `IdleToken` contract supports multiple lending provider and they can also be added in the future, at this stage we have implemented Fulcrum (iTokens) and Compound (cTokens).

The system works in the following way (we use DAI as an example):

**For minting IdleDAI (read: lend DAI)**

1. User calls `approve` on DAI smart contract and allows `IdleToken` as spender for their DAI
2. User calls `mintIdleToken` with the `_amount` of DAI he wants to lend
3. The `IdleToken` contract calls `IdlePriceCalculator.tokenPrice()` method in order to see the current IdleDAI price (IdleDAI price = Net Asset Value of pools in `IdleToken` contract divided by IdleDAI totalSupply => NAV / totalSupply, where NAV = (cDAIPrice `*` cDAI in IdleDAI contract) + (iDAIPrice `*` iDAI in IdleDAI contract) + (... NAV of others pools in the future))
4. `IdleToken` will call `transferFrom` and transfer DAI from user to `IdleToken` contract
5. `IdleToken` will use DAI given by user to mint cDAI or iDAI or both and rebalances the whole pool if needed
6. `IdleToken` will mint IdleDAI for the user, based on amount given and the IdleDAI price

At the end of the `mintIdleToken` the user will receive IdleDAI and the `IdleToken` contract will have cDAI, iDAI or both.

**For burning IdleDAI (read: redeem DAI + interest earned)**

1. User calls `redeemIdleToken` with the `_amount` of IdleToken he wants to burn
2. The contract calculates the share of each protocol pool (cDAI, iDAI, ...) in  `IdleToken` that the user is entitled to redeem with the following formula `_amount * protocolPoolBalance / idleTokenTotalSupply`
3. The contract redeems the underlying (DAI) + interest earned from each protocol and sends them to the user.
4. `_amount` of IdleDAI are then burned from the user
5. A rebalance of all the pools is triggered if needed

**Reblance approach**

The `rebalance` method, called by `mintIdleToken` and `redeemIdleToken` is public and can be invoked by anyone; the user with more funds should be the one more incentivized to make the call if he spots that the current allocation is not the best. Funds of all other users will be rebalanced as well with this one-for-all mechanism (given that funds of all users are pooled together).

With a very large amount of funds, rates on different lending protocols should be arbitraged in order to have the highest aggregated rate for all funds.

The rebalance algorithm works in the following way when a user wants to lend `_newAmount` of DAI.

1. If the current funds are all in one protocol we check if that protocol can sustain all the liquidity the user intends to provide (`_newAmount`), so if this protocol has still the best apr compared to all the others implemented.
2. otherwise we redeem everything from every protocol and check if the protocol with the best apr can support all the liquidity that we redeemed plus `_newAmount` supplied by the user.
3. if it's not the case we calculate the dynamic allocation for every protocol with an iterative approch using `IdleRebalancer`. NOTE: our client calculates the ideal amounts for the dynamic allocation off-chain and it passes those value via the `_clientProtocolAmounts` parameter of `mintIdleToken`, `redeemIdleToken` and `rebalance` method.
The algorithm that will be implemented on the client is the one used by the `rebalanceCalcV2` buidler task in `buidler.config.js` file,
to check the results of the algo with mainnet try this (no tx will be made):
`npx buidler idleDAI:rebalanceCalcV2 --amount 1000000` where `1000000` is the total amount to be rebalanced.

The parameters calculated off-chain are always slightly less than the actual total amount to be rebalanced due to the fact that between the tx submission and when the tx is mined some interest is earned, but we account that in `IdleRebalancer.checkRebalanceAmounts` method. Those parameters are not mandatory, if not provided `IdleRebalancer` will skip the parameters check and go directly with the iterative approach, with the direct consequence of using more gas when there are a lot of iterations. In order to know if a protocol can sustain all the liquidity we intend to provide, we need to know the next interest rate of every protocol after supplying new liquidity. This calculations are done in `IdleCompound` and `IdleFulcrum` protocols wrapper in the `nextSupplyRate` method.

Formulas for each lending provider implemented can be found in:
- [info_compound.md](info_compound.md)
- [info_fulcrum.md](info_fulcrum.md)

Info for on-chain calculations of the rebalance process can be found in:
- [info_rebalance.md](info_rebalance.md)

### Contracts:
There are currently 6 contracts in the system (all contract files have been extensively commented).
- `IdleToken` contract is the main one, it's an ERC20, which contains all the data and all pooled funds (in the form of interest-bearing tokens, ie cDAI, iDAI, ...)
- `IdlePriceCalculator` contract is used to calculate the IdleToken current price based on the NAV of all the pools in `IdleToken` contract and the `totalSupply` of `IdleToken`.
- `IdleRebalancer` is used to check and calculate amounts for the rebalance process.

There are also different `ILendingProtocol` wrappers (currently 2 one for Fulcrum `IdleFulcrum` and one for Compound `IdleCompound`) used to interact with lending providers.
In `IdleToken` we (the owners) can set the implementation for `IdleRebalancer`, `IdleFulcrum`, `IdleCompound` (so they are "upgradable").

In the future, more wrappers should be added and `IdleRebalancer` should be updated with new calculations.
`IdleFactory` is used to create new `IdleToken` contracts (IdleDAI, IdleUSDC, ...) and as a registry of the deployed contracts.

### Admin functionalities
For `IdleToken`:
- `mintIdleToken` and `rebalance` methods of `IdleToken` contract can paused (redeem is always available)
- `IdleRebalancer` and `IdlePriceCalculator` implementation can be updated
- Underlying `token` address can be updated
- `iToken` address can be updated
- Protocol wrappers (ie lending providers) can be updated, added and removed
- `minRateDifference` for `_rebalanceCheck` can be updated
- If `iToken` price has decreased (for a black swan event) the contract will not accept new deposits and `rebalance` cannot be called, we added a flag, `manualPlay`, that can unlock the contract

For `IdleRebalancer`:
- `cToken` can be updated
- `iToken` can be updated
- `cWrapper` can be updated
- `iWrapper` can be updated
- `maxRateDifference` can be updated
- `maxSupplyedParamsDifference` can be updated
- `maxIterations` can be updated

### Invariants
- Users should always be able to redeem funds (except when there is no liquidity available on the underlying protocols which are currently used by Idle)
- Funds should always be only in IdleToken contract and in no other Idle contract
- A user should always be able to redeem more DAI then what he lended (except when he decides to redeem funds during a black swan event)

### Edge cases
- If Compound or Fulcrum do not have all the liquidity requested available during a `rebalance` or a `redeemIdleToken` the tx will revert.
During a `redeemIdleToken` is possibile that even if a user wants to redeem only a small amount of his funds (and the protocols liquidity can sustain that small amount) the tx will revert if a rebalance is triggered, due to the fact that we are redeeming everything from every protocol. In this case `redeemIdleToken` accepts a flag `_skipRebalance` that should be set to `true` in order to disable the rebalance process

- During a black swan event is possible that iToken price decreases instead of increasing, with the consequence of lowering the IdleToken price. In this case the `whenITokenPriceHasNotDecreased` modifier prevents users from minting cheap IdleTokens or rebalancing the pool. The `redeemIdleToken` won't be paused but the rebalance process won't be triggered. If a user decide to call `redeemIdleToken` during a black swan event he would capitalize a loss.

### Setup
```
yarn global add truffle ganache-cli

yarn
```

### Tests

```
truffle test
```
#### Mainnet fork tests
Migrations files `3_setup_ganache_test.js` and `4_test_ganache_idle.js` (only used with `local` network) have been created for testing purposes, in order to have real tests with the mainnet environment.

```
ganache-cli --fork https://mainnet.infura.io/v3/{INFURA_API_KEY} -e 100000 --unlock 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359

truffle migrate --network local
```

### Interactions

Users are allowed to `mintIdleToken`, `redeemIdleToken`, `rebalance` and `redeemInterestBearingTokens`. There is also a `claimITokens` method but it should not be used in this version of the contract because we are reverting the Fulcrum tx during redeem if all the liquidity is not currently available.
