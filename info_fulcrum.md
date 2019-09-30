### Fulcrum formula for calculating next rate after supplying `x` amount (with their fee)

Info gathered thourgh: initial [link](https://medium.com/bzxnetwork/introducing-fulcrum-tokenized-margin-made-dead-simple-e65ccc82393f) of fulcrum announcement, [iDAI contract](https://etherscan.io/address/0x14094949152eddbfcd073717200da82fed8dc960), several chat session with Fulcrum's CEO

```
a = avgBorrowInterestRate;
b = totalAssetBorrow;
s = totalAssetSupply;
o = spreadMultiplier;
x = newDAIAmount;
k = 1e20;
```

New rate after supplying `x` amount (Considering fee/mandatory insurance -> `spreadMultiplier`)

```
q = a * (s / (s + x)) * (b / (s + x)) * o / k
```

This has been manually tested using a buidler task (NOT Considering fee/mandatory insurance here for simplicity as their contract call response does not include that)
```
npx buidler iDAI:manualNextRateData --amount xxx
```
where `xxx` is the amount to supply in DAI; it gives the same result of Fulcrum's `nextSupplyInterestRate` method
check the task
```
npx buidler iDAI:autoNextSupplyRateData --amount xxx
```
