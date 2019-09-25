pragma solidity 0.5.11;

import "./interfaces/CERC20.sol";
import "./interfaces/iERC20Fulcrum.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/WhitePaperInterestRateModel.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancer is Ownable {
  using SafeMath for uint256;
  address public cToken;
  address public iToken;

  constructor(address _cToken, address _iToken) public {
    cToken = _cToken;
    iToken = _iToken;
  }
  // onlyOwner
  function setCToken(address _cToken)
    external onlyOwner {
      cToken = _cToken;
  }
  function setIToken(address _iToken)
    external onlyOwner {
      iToken = _iToken;
  }

  function calcRebalanceAmounts(uint256 n)
    public view
    returns (address[] memory tokenAddresses, uint256[] memory amounts)
  {
    /* Compound yearly rate
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
    q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f

    Fulcrum yearly rate

    a1 = avgBorrowInterestRate;
    b1 = totalAssetBorrow;
    s1 = totalAssetSupply;
    o1 = spreadMultiplier;
    x1 = newDAIAmount;
    k1 = 1e20;
    q1 = a1 * (s1 / (s1 + x1)) * (b1 / (s1 + x1)) * o1 / k1

    We have
    n = tot DAI to rebalance

    and in the end q for Compound and q for Fulcrum should be equal
    we have to solve this for x1 and x
    / q = q1
    \ n = x1 + x

    a1 * (s1 / (s1 + x1)) * (b1 / (s1 + x1)) * o1 / k1 = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f
    (a1 * (s1 / (s1 + x1)) * (b1 / (s1 + x1)) * o1 / k1) - ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f = 0 -> substitute x1 = n-x
    (a1 * (s1 / (s1 + (n - x))) * (b1 / (s1 + (n - x))) * o1 / k1) - ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f = 0

    better rewritten using Wolfram

    f(x) = 0 = (a1 b1 o1 s1)/(k1 * (n + s1 - x)^2) - (b e f (a + (b c)/(b + s + x)))/(j (b - d + s + x))

    here x rapresents the amount that should be placed in compound
    n - x the amount of fulcrum
    the analytical solution is too much complicated for on-chain implementation
    so we use an interative approach using newton-raphson method

    f'(x) = (b e f (a + (b c)/(b + s + x)))/(j (b - d + s + x)^2) + (2 a1 b1 o1 s1)/(k1 * (n + s1 - x)^3) + (b^2 c e f)/(j (b + s + x)^2 (b - d + s + x))

    our limits for x are [0, n]
    if x > n all on compound, if x < 0 all on fulcrum ?

    const fx = x => a1.times(s1.div(s1.plus(n.minus(x))))
      .times(b1.div(s1.plus(n.minus(x))))
      .times(o1).div(k1)
      .minus(
        a.plus(b.times(c).div(b.plus(s).plus(x))).div(k).times(e).times(b).div(
          s.plus(x).plus(b).minus(d)
        ).div(j).times('2102400').times('100')
      ).integerValue(BigNumber.ROUND_FLOOR);

    // f'(x) = (b e f (a + (b c)/(b + s + x)))/(j (b - d + s + x)^2) + (2 a1 b1 o1 s1)/(k1 * (n + s1 - x)^3) + (b^2 c e f)/(j (b + s + x)^2 (b - d + s + x))
    const f1x = x => b.times(e).times(f).times(
      a.plus(b.times(c).div(b.plus(s).plus(x)))
    ).div(j.times((b.minus(d).plus(s).plus(x)).pow(2))).plus(
      BNify('2').times(a1).times(b1).times(o1).times(s1).div(
        k1.times((n.plus(s1).minus(x)).pow(3))
      )
    ).plus(
      b.pow(2).times(c).times(e).times(f).div(
        j.times((b.plus(s).plus(x)).pow(2)).times(b.minus(d).plus(s).plus(x))
      )
    );

    const perc = BNify(0.1); // 0.1%
        const maxIteration = 20;
        console.log(`n = ${n.div(1e18)}`)
        const newtonRaphson = (func, funcDerivative, x_0, maxIter = maxIteration, limitPerc = perc) => {
          let iter = 0;
          while (iter++ < maxIter) {
            const y = func(x_0);
            const yp = funcDerivative(x_0);
            // Update the guess:
            const x_1 = x_0.minus(y.div(yp));
            // Check for convergence:
            console.log(`iteration: ${iter} #######`);
            console.log(`${x_0} x_0`)
            console.log(`${x_1} x_1`)
            console.log(`${y} y`)
            console.log(`${y.div(1e18)} y.div(1e18)`)
            console.log(`${yp} yp`)
            // if (targetSupplyRateWithFeeCompoundFoo(x_0).minus(targetSupplyRateWithFeeFulcrumFoo(n.minus(x_0))).abs().lte(BNify(limitPerc).times(1e18))) {
            // if (x_1.minus(x_0).abs().lte(limitPerc.times(x_1.abs()))) {
            if (y.div(1e18).abs().lte(limitPerc)) {
              console.log('Newton-Raphson: converged to x = ' + x_1.div(1e18) + ' after ' + iter + ' iterations');
              return x_1;
            }

            // Transfer update to the new guess:
            x_0 = x_1;
          }
          console.log('Newton-Raphson: Maximum iterations reached (' + maxIter + ')');
          return false;
        };

        const amountFulcrum = n.times(s1.div(s1.plus(s)));
        const amountCompound = n.minus(amountFulcrum);
        console.log(`Initial Guess (Compound) = ${amountCompound.div(1e18)} DAI`)
        // const resAlgo = newtonRaphson(fx, f1x, n.div(2));
        const resAlgo = newtonRaphson(fx, f1x, amountCompound); // correct one
        // const resAlgo = newtonRaphson(fx, f1x, BNify(1e-7));
        console.log(`${resAlgo.div(1e18).toString()} DAI in compound, ${n.div(1e18).minus(resAlgo.div(1e18)).toString()} DAI fulcrum ####################`);
        console.log(`${targetSupplyRateWithFeeCompoundFoo(resAlgo).div(1e18).toString()}% target in compound, ${targetSupplyRateWithFeeFulcrumFoo(n.minus(resAlgo)).div(1e18).toString()}% target rate fulcrum ####################`); */


        // TODO we have to pass in some way cToken and iToken addresses


        // COMPOUND
        CERC20 _cToken = CERC20(cToken);
        WhitePaperInterestRateModel white = WhitePaperInterestRateModel(_cToken.interestRateModel());

        /* uint256 j = 10 ** 18;
        uint256 a = white.baseRate(); // from WhitePaper
        uint256 b = _cToken.totalBorrows();
        uint256 c = white.multiplier(); // from WhitePaper
        uint256 d = _cToken.totalReserves();
        uint256 e = j.sub(_cToken.reserveFactorMantissa());
        uint256 s = _cToken.getCash();
        uint256 k = _cToken.blocksInAYear();
        uint256 f = 100; */

        // FULCRUM
        iERC20Fulcrum _iToken = iERC20Fulcrum(iToken);

        /* uint256 a1 = _iToken.avgBorrowInterestRate();
        uint256 b1 = _iToken.totalAssetBorrow();
        uint256 s1 = _iToken.totalAssetSupply();
        uint256 o1 = _iToken.spreadMultiplier();
        uint256 k1 = 10 ** 20; */

        uint256[15] memory params;
        params[0] = 10 ** 18;
        params[1] = white.baseRate(); // from WhitePaper
        params[2] = _cToken.totalBorrows();
        params[3] = white.multiplier(); // from WhitePaper
        params[4] = _cToken.totalReserves();
        params[5] = params[0].sub(_cToken.reserveFactorMantissa());
        params[6] = _cToken.getCash();
        params[7] = _cToken.blocksInAYear();
        params[8] = 100;
        params[9] = _iToken.avgBorrowInterestRate();
        params[10] = _iToken.totalAssetBorrow();
        params[11] = _iToken.totalAssetSupply();
        params[12] = _iToken.spreadMultiplier();
        params[13] = 10 ** 20;
        params[14] = n;

        // n = x + x1 => x = n - x1
        // f(x) = 0 = (a1 b1 o1 s1)/(k1 * (n + s1 - x)^2) - (b e f (a + (b c)/(b + s + x)))/(j (b - d + s + x))

      //
      return (tokenAddresses, amounts);
  }

  function foo(uint256 x, uint256[15] memory params)
    internal pure
    returns (uint256) {
      /* f(x) = (a1 b1 o1 s1)/(k1 * (n + s1 - x)^2) - (b e f (a + (b c)/(b + s + x)))/(j (b - d + s + x)) */
      uint256 j = params[0];
      uint256 a = params[1];
      uint256 b = params[2];
      uint256 c = params[3];
      uint256 d = params[4];
      uint256 e = params[5];
      uint256 s = params[6];
      uint256 k = params[7];
      uint256 f = params[8];
      uint256 a1 = params[9];
      uint256 b1 = params[10];
      uint256 s1 = params[11];
      uint256 o1 = params[12];
      uint256 k1 = params[13];
      uint256 n = params[14];
      return a1.mul(s1.div(s1.add(n.sub(x))))
        .mul(b1.div(s1.add(n.sub(x))))
        .mul(o1).div(k1)
        .sub(
          a.add(b.mul(c).div(b.add(s).add(x))).div(k).mul(e).mul(b).div(
            s.add(x).add(b).sub(d)
          ).div(j).mul(k).mul(f)
        );
  }
  function foo1(uint256 x, uint256[15] memory params)
    internal pure
    returns (uint256) {
      uint256 j = params[0];
      uint256 a = params[1];
      uint256 b = params[2];
      uint256 c = params[3];
      uint256 d = params[4];
      uint256 e = params[5];
      uint256 s = params[6];
      /* uint256 k = params[7]; // not needed here  */
      uint256 f = params[8];
      uint256 a1 = params[9];
      uint256 b1 = params[10];
      uint256 s1 = params[11];
      uint256 o1 = params[12];
      uint256 k1 = params[13];
      uint256 n = params[14];

      // f'(x) = (b e f (a + (b c)/(b + s + x)))/(j (b - d + s + x)^2) + (2 a1 b1 o1 s1)/(k1 * (n + s1 - x)^3) + (b^2 c e f)/(j (b + s + x)^2 (b - d + s + x))
      uint256 _2 = 2;
      uint256 factor = b.sub(d).add(s).add(x);
      uint256 factor2 = n.add(s1).sub(x);
      uint256 factor3 = b.add(s).add(x);

      return b.mul(e).mul(f).mul(
        a.add(b.mul(c).div(b.add(s).add(x)))
      ).div(j.mul(factor.mul(factor))).add(
        _2.mul(a1).mul(b1).mul(o1).mul(s1).div(
          k1.mul(factor2.mul(factor2).mul(factor2))
        )
      ).add(
        b.mul(b).mul(c).mul(e).mul(f).div(
          j.mul(factor3.mul(factor3)).mul(b.sub(d).add(s).add(x))
        )
      );
  }

  // from DAI contract
  // check https://forum.openzeppelin.com/t/does-safemath-library-need-a-safe-power-function/871/9
  /* function rpow(uint x, uint n) internal pure returns (uint z) {
      z = n % 2 != 0 ? x : 10**27;

      for (n /= 2; n != 0; n /= 2) {
          x = rmul(x, x);

          if (n % 2 != 0) {
              z = rmul(z, x);
          }
      }
  } */
}
