/// math.sol -- mixin for inline numerical wizardry

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity 0.5.16;

contract DSMath {
   function _add(uint x, uint y) internal pure returns (uint z) {
       require((z = x + y) >= x);
   }
   function _mul(uint x, uint y) internal pure returns (uint z) {
       require(y == 0 || (z = x * y) / y == x);
   }

   uint constant RAY = 10 ** 27;

   function rmul(uint x, uint y) internal pure returns (uint z) {
       z = _add(_mul(x, y), RAY / 2) / RAY;
   }

   // This famous algorithm is called "exponentiation by squaring"
   // and calculates x^n with x as fixed-point and n as regular unsigned.
   //
   // It's O(log n), instead of O(n) for naive repeated multiplication.
   //
   // These facts are why it works:
   //
   //  If n is even, then x^n = (x^2)^(n/2).
   //  If n is odd,  then x^n = x * x^(n-1),
   //   and applying the equation for even x gives
   //    x^n = x * (x^2)^((n-1) / 2).
   //
   //  Also, EVM division is flooring and
   //    floor[(n-1) / 2] = floor[n / 2].
   //
   /* function rpow(uint x, uint n) internal pure returns (uint z) {
       z = n % 2 != 0 ? x : RAY;

       for (n /= 2; n != 0; n /= 2) {
           x = rmul(x, x);

           if (n % 2 != 0) {
               z = rmul(z, x);
           }
       }
   } */

  // https://github.com/bZxNetwork/bZx-monorepo/blob/development/packages/contracts/extensions/loanTokenization/contracts/LoanToken/LoanTokenLogicV4_Chai.sol#L1591
   function rpow(
       uint256 x,
       uint256 n,
       uint256 base)
       public
       pure
       returns (uint256 z)
   {
       assembly {
           switch x case 0 {switch n case 0 {z := base} default {z := 0}}
           default {
               switch mod(n, 2) case 0 { z := base } default { z := x }
               let half := div(base, 2)  // for rounding.
               for { n := div(n, 2) } n { n := div(n,2) } {
                   let xx := mul(x, x)
                   if iszero(eq(div(xx, x), x)) { revert(0,0) }
                   let xxRound := add(xx, half)
                   if lt(xxRound, xx) { revert(0,0) }
                   x := div(xxRound, base)
                   if mod(n,2) {
                       let zx := mul(z, x)
                       if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
                       let zxRound := add(zx, half)
                       if lt(zxRound, zx) { revert(0,0) }
                       z := div(zxRound, base)
                   }
               }
           }
       }
   }
}
