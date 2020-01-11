# Update:

`nextSupplyInterestRate` now directly returns the net rate so there is no need to manually calculate the net rate also `avgBorrowInterestRate` has been substituted with `protocolInterestRate` which now accounts for fees so the formula for Fulcrum (and the subsequent formula for the rebalance analytical solutions) are outdated now.

The iterative approach at the end of this file is still valid.

---

## Rebalance reasoning for Compound and Fulcrum (used in `IdleRebalancer` contract) for all assets except DAI
### Compound nextRate after supplying `x` amount
```
a = baseRate
b = totalBorrows
c = multiplier
d = totalReserves
e = 1 - reserveFactor
s = getCash
x = newSAIAmount
k = blocksPerYear; // blocksPerYear
j = 1e18; // oneEth
f = 100;
```
yearly rate
```
q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f
```

### Fulcrum nextRate after supplying `x1` amount
```
a1 = avgBorrowInterestRate;
b1 = totalAssetBorrow;
s1 = totalAssetSupply;
o1 = spreadMultiplier;
x1 = newSAIAmount;
k1 = 1e20;
```
yearly rate
```
q1 = a1 * (s1 / (s1 + x1)) * (b1 / (s1 + x1)) * o1 / k1
```

### Algorithm for dynamic funds allocation (DFA)
We have
```
n = tot SAI to rebalance
```

and in the end `q` for Compound and `q1` for Fulcrum should be equal (or the rate of one of them is > of the other even after supplying all `n`).
We have to solve this system for `x1` and `x`
```
/ q = q1
\ n = x1 + x
```

```
a1 * (s1 / (s1 + x1)) * (b1 / (s1 + x1)) * o1 / k1 = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f
(a1 * (s1 / (s1 + x1)) * (b1 / (s1 + x1)) * o1 / k1) - ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f = 0 -> substitute x1 = n-x
(a1 * (s1 / (s1 + (n - x))) * (b1 / (s1 + (n - x))) * o1 / k1) - ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f = 0
```
better rewritten using Wolfram

```
f(x) = 0 = (a1 b1 o1 s1)/(k1 * (n + s1 - x)^2) - (b e f (a + (b c)/(b + s + x)))/(j (b - d + s + x))
```

here `x` rapresents the amount that should be placed in compound, `n - x` the amount of fulcrum.
Our limits for `x` are `[0, n]`

The analytical solution is too much complicated for on-chain implementation see [here](https://www.wolframalpha.com/input/?i=%28a1+*+%28s1+%2F+%28s1+%2B+%28n+-+x%29%29%29+*+%28b1+%2F+%28s1+%2B+%28n+-+x%29%29%29+*+o1+%2F+k1%29+-+%28%28%28%28a+%2B+%28b*c%29%2F%28b+%2B+s+%2B+x%29%29+%2F+k%29+*+e+*+b+%2F+%28s+%2B+x+%2B+b+-+d%29%29+%2F+j%29+*+k+*+f+%3D+0) (Wait for it to calculate until `Solutions for the variable x` appears)

## Iterative approach

So we are using an interative approach using the bisection method and created a version of the algo in the task

```
npx buidler idleDAI:rebalanceCalcV2 --amount xxx
```
where `xxx` is the amount of SAI to rebalance.

## DAI rebalance

For DAI we are using a slightly different approach, instead
of calculating everything manually, in the contract, we rely on `nextSupplyInterestRate` method of the Fulcrum contract and `getSupplyRate` for the Compound one. Those are used toììin order to take into account also the DSR which has been implemented in both protocols. The modified version of the algorithm is implemented in the following task

```
npx buidler idleDAI:rebalanceCalcV3 --amount xxx
```
where `xxx` is the amount of DAI to rebalance.
