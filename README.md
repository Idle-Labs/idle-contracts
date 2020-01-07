# Idle contracts
Live version: [https://idle.finance](https://idle.finance)

### Introduction
Idle allows you to get the best interest rate on the market, by investing in a single token.

This product allows users to optimize interest rate profitability and seamlessly get the highest yield, without having to manually move funds across different lending protocols to chase the best returns.

Users' funds are pooled together in the main contract (one for each token supported by Idle) and every interaction with Idle smart contract triggers a check of the interest rates offered by all supported lending protocols and rebalances the pool if needed. The purpose of the rebalance is to provide the highest aggregated interest rate for all pooled funds.

Hence, by buying and holding IdleTokens, users' underlying position will be dynamically rebalanced when the best rate changes, in order to always give back the most profitable return.

### Backstory

The current [Idle smart contract](https://etherscan.io/address/0xacf651aad1cbb0fd2c7973e2510d6f63b7e440c9) version works in a simple, but not scalable way: when the highest interest rate is not on the tracked lending protocol anymore, and an interaction with the platform happens, the smart contract moves the whole pool of locked funds from a protocol to the other.

This might provoke a well-known edge case: if the current Idle smart contract moves a large amount of funds from a lending protocol A to a lending protocol B, it could potentially decrease the interest rate in the target protocol B. Consequently, the interest rate in protocol A increases, and if there is not a substantial spread between the rates (meaning that the interest rate in protocol B becomes lower than the interest rate in protocol A), this might translates in a continuous rebalance between those two protocols. This loop continues until one of those protocols is able to "absorb" all the funds without lowering its interest rate below the other protocol's interest rate. More information and examples here: ["On Current Decentralized Rebalance"](https://medium.com/@idlefinance/on-current-decentralized-rebalance-67e5a51b763)

The new smart contracts architecture included in this repository dynamically rebalances the pool (without moving all funds from a protocol to another). Indeed, it calculates the exact amounts that should be allocated on each protocol in order to accrue the highest aggregated interest rate for all funds.

Contracts in this repository contain this new rebalance process with a dynamic funds allocation, as slightly described in the aforementioned article.

### High level intro of overall system
`IdleToken` contract pools together users' funds and convert them into interest-bearing assets (cTokens, iTokens and other tokenized lending positions in the future). `IdleToken` is an ERC-20 token and represents the right to redeem a proportional share of the value locked in the smart contract, which corresponds to the amount locked by a single user.

`IdleToken` price is based on minted `totalSupply` and current Net Asset Value (NAV) of all interest-bearing tokens locked in `IdleToken` contract.

Therefore, price formula is: `IdleToken Price = IdlePool NAV / IdleToken totalSupply`

NOTE: `IdleToken` contract is designed to support multiple lending providers. Other lending protocols can be added in the future, at this stage we have implemented Fulcrum (iTokens) and Compound (cTokens).

The system works in the following way (we will use DAI for this example):

**IdleDAI minting (read: lend DAI)**

1. User calls `approve` on DAI smart contract and allows `IdleToken` as spender for their DAI
2. User calls `mintIdleToken` with the `_amount` of DAI that wants to lend
3. The `IdleToken` contract calls `IdlePriceCalculator.tokenPrice()` method in order to see the current IdleDAI price (as above, IdleDAI price = Net Asset Value of pools in `IdleToken` contract divided by IdleDAI totalSupply => NAV / totalSupply, where NAV = (cDAIPrice `*` cDAI in IdleDAI contract) + (iDAIPrice `*` iDAI in IdleDAI contract) + (... NAV of others pools in the future))
4. `IdleToken` will call `transferFrom` and transfer DAI from user to `IdleToken` contract
5. `IdleToken` will use DAI given by user to mint cDAI or iDAI or both and rebalances the whole pool if needed
6. `IdleToken` will mint IdleDAI for the user, based on the given amount and IdleDAI price

At the end of the `mintIdleToken` the user will receive IdleDAI and the `IdleToken` contract will have cDAI, iDAI or both.

**For burning IdleDAI (read: redeem DAI + interest earned)**

1. User calls `redeemIdleToken` with the `_amount` of IdleToken that wants to burn
2. The contract calculates the share of each protocol pool (cDAI, iDAI, ...) in  `IdleToken` that the user is entitled to redeem with the following formula `_amount * protocolPoolBalance / idleTokenTotalSupply`
3. The contract redeems the underlying (DAI + interest earned) from each protocol and sends them to the user.
4. `_amount` of IdleDAI are then burned from the user
5. A rebalance of all the pools is triggered if needed

**Rebalance approach**

The `rebalance` method, called by `mintIdleToken` or `redeemIdleToken`, is public and can be invoked by anyone; users with more funds should be the ones more incentivized to make the call if they spot that the current allocation is not accruing the best available interest rate. All other users' funds will be rebalanced as well with this "one-for-all" mechanism (given that all users' funds are pooled together).

With enough funds, rates on different lending protocols can be influenced and would be arbitraged in order to have the highest aggregated rate for all funds.

When a user wants to lend `_newAmount` of DAI, the rebalance algorithm works in the following way:

1. If all current funds are in a single protocol, Idle smart contract checks if that protocol can sustain the liquidity provided by the user (`_newAmount`). In other words, it checks if the protocol has still the best APR compared to all the others implemented protocols (or if the new rate is within a range defined by `minRateDifference`).
2. If we are not in the case of point `1.`, Idle smart contract redeems everything from every protocol and checks if the protocol with the best APR can support all the liquidity that we redeemed plus `_newAmount` supplied by the user.
3. If there is no single protocol that can substain all the liquidity, Idle smart contract computes a dynamic allocation for each protocol, with an iterative approch using `IdleRebalancer`. (NOTE: the ideal amounts for the dynamic allocation are computed off-chain on client-side, and those values are sent via the `_clientProtocolAmounts` parameter of `mintIdleToken`, `redeemIdleToken` and `rebalance` methods).

The algorithm that will be implemented on the client is used by the `rebalanceCalcV2` (for all assets except DAI) buidler task in `buidler.config.js` file. To check the results of the algorithm with mainnet try this (no tx will be made):

`npx buidler idleDAI:rebalanceCalcV2 --amount 1000000`

where `1000000` is the total amount to be rebalanced.
For DAI there is a `rebalanceCalcV3` method which accepts the same param.

The parameters calculated off-chain are always slightly less than the actual total amount to be rebalanced due to the fact that between the tx submission and when the tx is actually mined some interest is earned, but we account that in `IdleRebalancer.checkRebalanceAmounts` method. Those parameters are not mandatory, and if not provided, `IdleRebalancer` will skip the parameters check and start directly with the iterative approach (this will cause a higher gas usage, proportional to the number of iteration needed to compute the desired allocation). In order to understand if a protocol can sustain all the liquidity we intend to provide, we need to know the next interest rate of every protocol after supplying new liquidity. These calculations are done in `IdleCompound` and `IdleFulcrum` protocols wrapper in the `nextSupplyRate` and `nextSupplyRateWithParams` method.

Formulas for each lending provider implemented can be found in:
- [info_compound.md](info_compound.md)
- [info_fulcrum.md](info_fulcrum.md)

Info for on-chain calculations of the rebalance process can be found in:
- [info_rebalance.md](info_rebalance.md)

### Smart contracts architecture:
The smart contracts architecture is currently composed by 6 contracts (all contract files have been extensively commented).
- `IdleToken` contract is the main one, it's an ERC20, which contains all the data and all pooled funds (in the form of interest-bearing tokens, ie cDAI, iDAI, ...)
- `IdlePriceCalculator` contract is used to calculate the IdleToken current price based on the NAV of all the pools in `IdleToken` contract and the `totalSupply` of `IdleToken`.
- `IdleRebalancer` is used to check and calculate amounts for the rebalance process.
- `IdleFactory` is used to create new `IdleToken` contracts (IdleDAI, IdleUSDC, ...) and as a registry of the deployed contracts.

Additionally, there are different `ILendingProtocol` wrappers (currently 2, one for Fulcrum `IdleFulcrum` and one for Compound `IdleCompound`) used to interact with lending providers.
In `IdleToken` we (the owners) can set the implementation for `IdleRebalancer`, `IdleFulcrum`, `IdleCompound` (so they are "upgradable").

For DAI only we are using different implementations for the wrappers and the rebalancer. Those are `IdleRebalanceV2`, `IdleCompoundV2` and `IdleFulcrumV2`.

In the future, more wrappers would be added both `IdleRebalancer` and `IdleRebalancerV2` should be updated with new calculations.

### Interactions

Users are allowed to `mintIdleToken`, `redeemIdleToken`, `rebalance` and `redeemInterestBearingTokens` with `IdleToken` contract. There is also a `claimITokens` method but it should not be used in this version of the contract because we are reverting the Fulcrum tx during redeem if all the liquidity is not currently available.

### Admin functionalities
For `IdleToken`:
- `mintIdleToken` and `rebalance` methods of `IdleToken` contract can be paused (redeem is always available)
- `IdleRebalancer` and `IdlePriceCalculator` implementation can be updated
- `iToken` address can be updated
- Protocol wrappers (ie lending providers) can be updated, added and removed
- `minRateDifference` for `_rebalanceCheck` can be updated
- If `iToken` price has decreased (for a black swan event) the contract will not accept new deposits and `rebalance` cannot be called, we added a flag, `manualPlay`, that can unlock the contract

For `IdleRebalancer`:
- `calcRebalanceAmounts` can only be called by `IdleToken` contract
- `maxRateDifference` can be updated
- `maxSupplyedParamsDifference` can be updated
- `maxIterations` can be updated

### Invariants
- Users should always be able to redeem funds (except when there is no liquidity available on the underlying protocols which are currently used by Idle)
- Funds (cTokens, iTokens, ...) should always be only in IdleToken contract and in no other Idle contract
- No Underlying (eg. DAI) should be in the `IdleToken` at the end of a tx, only cTokens, iTokens, ...
- A user should always be able to redeem more DAI then the amount of DAI initially deposited (except when he decides to redeem funds during a black swan event)

### Edge cases
- If Compound or Fulcrum do not have all the liquidity requested available during a `rebalance` or a `redeemIdleToken` the tx will revert.
During a `redeemIdleToken` is possibile that a user wants to redeem only a small amount of his funds (and the protocols' liquidity can sustain that small amount) but if a rebalance is triggered the tx will revert, due to the fact that we are redeeming everything from every protocol. In this case `redeemIdleToken` accepts a flag `_skipRebalance` that should be set to `true` in order to disable the rebalance process

- During a black swan event is possible that iToken price decreases instead of increasing, with the consequence of lowering the IdleToken price. In this case the `whenITokenPriceHasNotDecreased` modifier prevents users from minting cheap IdleTokens or rebalancing the pool. The `redeemIdleToken` won't be paused but the rebalance process won't be triggered. If a user decide to call `redeemIdleToken` during a black swan event he would capitalize a loss.

### Setup
```
yarn global add truffle ganache-cli

yarn

cp .env.public .env
```
fill `INFURA_KEY` in `.env` with a real infura api key if you plan to run buidler's tasks (`buidler.config.js`) or to run migrations as described in the `Mainnet fork tests` section below.

### Tests

```
truffle test
```
#### Mainnet fork tests
Migrations files `3_setup_ganache_test.js` and `4_test_ganache_idle.js` (only used with `local` network) have been created for testing purposes, in order to have real tests with the mainnet environment.

```
ganache-cli --fork https://mainnet.infura.io/v3/{INFURA_API_KEY} -e 100000 --unlock 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359 --unlock 0x6B175474E89094C44Da98b954EedeAC495271d0F

truffle migrate --network local
```
