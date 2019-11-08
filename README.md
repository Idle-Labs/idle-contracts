# Idle contracts
Live version: [https://idle.finance](https://idle.finance)

### Introduction
With Idle we are tokenizing the best interest rate across different lending protocols on Ethereum money market. This product allows users to optimize profitability and seamlessly get the highest yield, without having to manually switch funds between lending protocols.

By buying and holding IdleTokens, your underlying stablecoin position will be dynamically rebalanced when the best rate changes in order to always give you the most profitable return.

---

This repo contains the new upcoming version of the Idle smart contracts.

The current version of [Idle](https://etherscan.io/address/0xacf651aad1cbb0fd2c7973e2510d6f63b7e440c9) works in a simple, but not very scalable way: when rates changes on a lending provider, and any user mints or redeems their token, we check the current rates and rebalance the whole pool from a protocol to another if needed.
This opens up an importante edge case, when we move a lot of funds from a protocol to another we could potentially cause a variation of rates in the target protocol which in turns can results in a rate less than the previous one, more info here: https://medium.com/@idlefinance/on-current-decentralized-rebalance-67e5a51b763 .

Contracts in this repo contains the new rebalance process with dynamic funds allocation
as described in the article.

Formulas for each lending provider implemented can be found in:
- [info_compound.md](info_compound.md)
- [info_fulcrum.md](info_fulcrum.md)

Info for on-chain calculations of the rebalance process can be found in:
- [info_rebalance.md](info_rebalance.md)

### Contracts:
There are currently 5 contracts.
`IdleToken` contract is the main one, it's an ERC20, which contains all the data and all pooled funds.
`IdleRebalancer` is used to calculate amounts for the rebalance process.
There are also different `ILendingProtocol` wrappers (currently 2 one for Fulcrum `IdleFulcrum` and one for Compound `IdleCompound`) used to interact with lending providers.
In `IdleToken` we (the owners) can set the implementation for `IdleRebalancer`, `IdleFulcrum`, `IdleCompound` (so they are "upgradable").

In the future, more wrappers should be added and `IdleRebalancer` should be updated with new calculations.
`IdleFactory` is used to create new `IdleToken` contracts (IdleDAI, IdleUSDC, ...) and as a registry of the deployed contracts.

### Interactions

Users are allowed to `mintIdleToken`, `redeemIdleToken` and `rebalance` the pool if needed.

Users can also `claimITokens` for Idle in the edge case that, during a rebalance, not all funds from Fulcrum are redeemable.
