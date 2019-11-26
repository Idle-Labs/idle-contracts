# Idle contracts
Live version: [https://idle.finance](https://idle.finance)

### Introduction
With Idle we are tokenizing the best interest rate across different lending protocols on Ethereum money market. This product allows users to optimize profitability and seamlessly get the highest yield, without having to manually switch funds between lending protocols to chase the best returns.

Funds of users are pooled together in the main contract (one for each token supported) and for every interaction (tx) with Idle the smart contract checks interest rates on various lending protocols and rebalance the pool if needed, in order to give the user the highest aggregated interest rate for all funds.

So by buying and holding IdleTokens, your underlying position will be dynamically rebalanced when the best rate changes in order to always give you the most profitable return.

---

This repo contains the new upcoming version of the Idle smart contracts.

The current version of [Idle smart contract](https://etherscan.io/address/0xacf651aad1cbb0fd2c7973e2510d6f63b7e440c9) works in a simple, but not very scalable way: when rates changes on a lending provider, and any user mints or redeems their token, we check the current rates and rebalance the whole pool from a protocol to another if needed.

This opens up an importante edge case, when we move a lot of funds from a protocol to another we could potentially cause a variation of rates in the target protocol which in turns can results in a rate less than the previous one, more info here: https://medium.com/@idlefinance/on-current-decentralized-rebalance-67e5a51b763 .

The new version of contracts in this repo dynamically rebalances the pool and it does not move all funds from a protocol to another, but instead calculates the amounts that should be placed on each protocol in order to have the aggregated best interest rate for all funds.

Contracts in this repo contains the new rebalance process with dynamic funds allocation mostly as described in the article.

---

Formulas for each lending provider implemented can be found in:
- [info_compound.md](info_compound.md)
- [info_fulcrum.md](info_fulcrum.md)

Info for on-chain calculations of the rebalance process can be found in:
- [info_rebalance.md](info_rebalance.md)

### High level intro of overall system
We use DAI as an example.

`IdleToken` contract pools funds of users together and convert them into interest bearing tokens (cDAI, iDAI and others in the future). IdleDAI is an ERC20 token, given to the user and rapresent the right to redeem a share of the pooled funds.
The price for acquiring IdleDAI, is based on the IdleDAI `totalSupply` and the current Net Asset Value (NAV) of all interest-bearing tokens in `IdleToken` contract.

NOTE: `IdleToken` contract supports multiple lending provider and they can also be added in the future, at this stage we have implemented Fulcrum (iDAI) and Compound (cDAI).

The system works in the following way:

**For minting IdleDAI (read: lend DAI)**

1. User calls `approve` on DAI smart contract and allows `IdleToken` as spender for their DAI (via the client)
2. User calls `mintIdleToken` with the `_amount` of DAI he wants to lend
3. The `IdleToken` contract calls `IdlePriceCalculator.tokenPrice()` method in order to see the current IdleDAI price (IdleDAI price = Net Asset Value of pools in `IdleToken` contract divided by IdleDAI totalSupply => NAV / totalSupply, where NAV = (cDAIPrice * cDAI in IdleDAI contract) + (iDAIPrice * iDAI in IdleDAI contract) + (... NAV of others pools in the future))
4. `IdleToken` will call `transferFrom` and transfer DAI from user to `IdleToken` contract
5. `IdleToken` will use DAI given by user to mint cDAI or iDAI or both and rebalances the whole pool if needed
6. `IdleToken` will mint IdleDAI for the user, based on amount given and the IdleDAI price

At the end of the `mintIdleToken` the user will receive IdleDAI, the `IdleToken` contract will have some cDAI, iDAI or both.

**For burning IdleDAI (read: redeem DAI + interest earned)**

1. User calls `redeemIdleToken` with the `_amount` of IdleToken he wants to burn
2. The contract calculates the share of each protocol pool (cDAI, iDAI, ...) in  `IdleToken` that the user is entitled to redeem with the following formula `_amount * protocolPoolBalance / idleSupply`
3. The contract redeems the underlying (DAI) + interest earned from each protocol and sends it to the user.
4. `_amount` of IdleDAI are then burned
5. A rebalance of all the pools is triggered if needed

**Reblance approach**

The `rebalance` method, called by `mintIdleToken` and `redeemIdleToken` is public and can be invoked by everyone, the user with more funds should be the one more incentivized to make the call if he spots that the current allocation is not the best. Funds of all other users will be rebalanced as well with this one-for-all mechanism (given that funds of all users are pooled together).

With a very large amount of funds, rates on different lending protocols should be arbitraged in order to have the highest aggregated rate for all funds.

The rebalance algo works in the following way when a user wants to lend `_newAmount` of DAI.

1. If the current funds are all in one protocol we check if that protocol can sustain all the liquidity the user intends to provide (`_newAmount`), so if this protocol has still the best apr compared to all the others implemented.
2. otherwise we redeem everything from every protocol and check if the protocol with the best apr can support all the liquidity that we redeemed plus `_newAmount` supplied by the user.
3. if it's not the case we calculate the dynamic allocation for every protocol with an iterative approch using `IdleRebalancer`. NOTE: our client calculates the ideal amounts for the dynamic allocation off-chain and it passes those value via the `_clientProtocolAmounts` parameter of `mintIdleToken`, `redeemIdleToken` and `rebalance` method.
The algorithm that will be implemented on the client is the one used by the `rebalanceCalcV2` buidler task,
to check the results of the algo with mainnet try this (no tx will be made):
`npx buidler idleDAI:rebalanceCalcV2 --amount 1000000` where `1000000` is the total amount to be rebalanced.

The parameters calculated off-chain are always slightly less than the actual total amount to be rebalanced due to the fact that between the tx submission and when the tx is mined some interest is earned, but we account that in `IdleRebalancer.checkRebalanceAmounts` method. Those parameters are not mandatory, if not provided `IdleRebalancer` will skip the parameters check and go directly with the iterative approach, with the direct consequence of using more gas when there are a lot of iterations.


### Contracts:
There are currently 6 contracts in the system.
- `IdleToken` contract is the main one, it's an ERC20, which contains all the data and all pooled funds.
- `IdlePriceCalculator` contract is used to calculate the IdleToken current price based on the NAV of all the pools in `IdleToken` contract and the `totalSupply` of `IdleToken`.
- `IdleRebalancer` is used to calculate amounts for the rebalance process.

There are also different `ILendingProtocol` wrappers (currently 2 one for Fulcrum `IdleFulcrum` and one for Compound `IdleCompound`) used to interact with lending providers.
In `IdleToken` we (the owners) can set the implementation for `IdleRebalancer`, `IdleFulcrum`, `IdleCompound` (so they are "upgradable").

In the future, more wrappers should be added and `IdleRebalancer` should be updated with new calculations.
`IdleFactory` is used to create new `IdleToken` contracts (IdleDAI, IdleUSDC, ...) and as a registry of the deployed contracts.

### Invariant
- Users should always be able to redeem funds
- Funds should always be only in IdleToken contract and in no other Idle contract
- A user should always be able to redeem more DAI then what he lended
<!-- - The `tokenPrice` a user paid when lended funds for his token should always be  -->

### Setup
`yarn add global truffle`
`yarn global add ganache-cli`
`yarn`

##### To test migrations locally using a mainnet fork
`ganache-cli --fork https://mainnet.infura.io/v3/{INFURA_API_KEY} -e 100000 --unlock 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359`
`truffle migrate --network local`

To test only interactions (third migration) use
`truffle migrate -f 4 --to 4 --network local`

### Tests
`truffle test`

### Interactions

Users are allowed to `mintIdleToken`, `redeemIdleToken` and `rebalance` the pool if needed.

Users can also `claimITokens` for Idle in the edge case that, during a rebalance, not all funds from Fulcrum are redeemable.
