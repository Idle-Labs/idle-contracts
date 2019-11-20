### Compound formula for calculating next rate after supplying `x` amount (with their fee)
We started from Compound and looked through their contracts (https://etherscan.io/address/0xf5dce57282a584d2746faf1593d3121fcac444dc for cDAI)

```
exchangeRate = E = (getCash() + totalBorrows() - totalReserves()) / totalSupply()
           = (S + B - Res) / T
underlying = totalSupply * exchangeRate
           = T * E = T * (S + B - Res) / T
           = S + B - Res
borrowsPer = totalBorrows / underlying
           = B / (S + B - Res)
utilizationRate = totalBorrows / (totalBorrows + getCash)
           = B / (B + S)
borrowRate = baseRate + utilizationRate * multiplier
           = baseRate + multiplier * B / (B + S)
supplyRate = borrowRate * (1-reserveFactor) * borrowsPer
           = borrowRate * (1-reserveFactor) * B / (S + B - Res)
           = (baseRate + multiplier * B / (B + S)) * (1-reserveFactor) * B / (S + B - Res)
```
when supplying a new DAI amount `x` we have

```
targetSupplyRate = (baseRate + multiplier * B / (B + S + x)) * (1-reserveFactor) * B / (S + x + B - Res)
```

Here I just rewrote the shorter version of the formula with some substitution outlined below:
```
q = (a + (b*c)/(b + s + x)) * (1-reserveFactor) * b / (s + x + b - d)
```
we use `e = (1-reserveFactor)`
we should also scale the result with a couple of constants (see contract)
so we end up having
```
a = baseRate
b = totalBorrows
c = multiplier
d = totalReserves
e = 1 - reserveFactor
s = getCash
x = maxDAIAmount
q = targetSupplyRate
k = 2102400; // blocksPerYear
j = 1e18; // oneEth
f = 100;

q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d))) / j -> rate per block
q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f -> rate per year
```
which is the target supply rate of Compound when supplying `x` DAI.

This has been manually tested using a buidler task
```
npx buidler cDAI:nextRateDataWithAmount --amount xxx
```
where `xxx` is the amount to supply in DAI.
