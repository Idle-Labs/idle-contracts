### Fulcrum formula for calculating next rate after supplying `x` amount (with their fee)

Info gathered thourgh: initial [link](https://medium.com/bzxnetwork/introducing-fulcrum-tokenized-margin-made-dead-simple-e65ccc82393f) of fulcrum announcement, [iSAI contract](https://etherscan.io/address/0x14094949152eddbfcd073717200da82fed8dc960), several chat session with Fulcrum's team.

```
a = protocolInterestRate;
b = totalAssetBorrow;
s = totalAssetSupply;
x = newSAIAmount;
```

New rate after supplying `x` amount

```
q = (a * b / (s + x))
```
