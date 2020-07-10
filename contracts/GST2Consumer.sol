pragma solidity 0.5.16;

import "./interfaces/GasToken.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract GST2Consumer is Initializable {
  GasToken public gst2;
  uint256[] internal gasAmounts;

  function initialize() initializer public {
    gst2 = GasToken(0x0000000000b3F879cb30FE243b4Dfee438691c04);
    gasAmounts = [14154, 41130, 27710, 7020];
  }

  modifier gasDiscountFrom(address from) {
    uint256 initialGasLeft = gasleft();
    _;
    _makeGasDiscount(initialGasLeft - gasleft(), from);
  }

  function _makeGasDiscount(uint256 gasSpent, address from) internal {
    // For more info https://gastoken.io/
    // 14154 -> FREE_BASE -> base cost of freeing
    // 41130 -> 2 * REIMBURSE - FREE_TOKEN -> 2 * 24000 - 6870
    uint256 tokens = (gasSpent + gasAmounts[0]) / gasAmounts[1];
    uint256 safeNumTokens;
    uint256 gas = gasleft();

    // For more info https://github.com/projectchicago/gastoken/blob/master/contract/gst2_free_example.sol
    if (gas >= gasAmounts[2]) {
      safeNumTokens = (gas - gasAmounts[2]) / gasAmounts[3];
    }

    if (tokens > safeNumTokens) {
      tokens = safeNumTokens;
    }

    if (tokens > 0) {
      if (from == address(this)) {
        gst2.freeUpTo(tokens);
      } else {
        gst2.freeFromUpTo(from, tokens);
      }
    }
  }
}
