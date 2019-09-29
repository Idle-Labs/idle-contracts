# Fulcrum formula

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
// q = a * (s / (s + x)) * (b / (s + x)) * o / k
```
