# Idle contracts
### [https://idle.finance](https://idle.finance)

The current version of Idle (https://etherscan.io/address/0xacf651aad1cbb0fd2c7973e2510d6f63b7e440c9) works in a simple, but not very scalable way: when rates changes on a lending provider,
and any user mints or redeems their token, we check the current rates and rebalance the whole pool from a protocol to another if needed.
This opens up an importante edge case, when we move a lot of funds from a protocol to another we could potentially cause
a variation of rates in the target protocol which in turns can results in a rate less than the previous one, more info here: https://medium.com/@idlefinance/on-current-decentralized-rebalance-67e5a51b763 .

This repo contains contracts with the new rebalance process with dynamic funds allocation
as described in the article.

Info for lending providers can be found in:
`info_compound.md` and `info_fulcrum.md`.

Info for on-chain calculations of the rebalance process cna be found in `rebalance.md`.

`IdleDAI` contract is the main one which contains all the storage data and funds. In `IdleDAI` we (the owners) can set the implementation for `IdleRebalancer`, `IdleFulcrum`, `IdleCompound` (so they are "upgradable").
