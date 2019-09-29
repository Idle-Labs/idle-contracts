## Compound
```
a = baseRate
b = totalBorrows
c = multiplier
d = totalReserves
e = 1 - reserveFactor
s = getCash
x = newDAIAmount
k = blocksInAYear; // blocksInAYear
j = 1e18; // oneEth
f = 100;
```
yearly rate
```
q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f
```

## Fulcrum
```
a1 = avgBorrowInterestRate;
b1 = totalAssetBorrow;
s1 = totalAssetSupply;
o1 = spreadMultiplier;
x1 = newDAIAmount;
k1 = 1e20;
```
yearly rate
```
q1 = a1 * (s1 / (s1 + x1)) * (b1 / (s1 + x1)) * o1 / k1
```

We have
```
n = tot DAI to rebalance
```

and in the end `q` for Compound and `q1` for Fulcrum should be equal
we have to solve this system for `x1` and `x`
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

here `x` rapresents the amount that should be placed in compound, `n - x` the amount of fulcrum
the analytical solution is too much complicated for on-chain implementation see [here](https://www.wolframalpha.com/input/?i=%28a1+*+%28s1+%2F+%28s1+%2B+%28n+-+x%29%29%29+*+%28b1+%2F+%28s1+%2B+%28n+-+x%29%29%29+*+o1+%2F+k1%29+-+%28%28%28%28a+%2B+%28b*c%29%2F%28b+%2B+s+%2B+x%29%29+%2F+k%29+*+e+*+b+%2F+%28s+%2B+x+%2B+b+-+d%29%29+%2F+j%29+*+k+*+f+%3D+0)

So we are using an interative approach using the bisection method (We tried also with newton-raphson method but the first derivative calculation was difficult to implement and involves signed numbers > 256 bit so for now we are going with bisection).
Our limits for `x` are `[0, n]`
