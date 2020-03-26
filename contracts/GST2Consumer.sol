pragma solidity 0.5.11;

import "./interfaces/GasToken.sol";

contract GST2Consumer {
  GasToken public constant gst2 = GasToken(0x0000000000b3F879cb30FE243b4Dfee438691c04);

  modifier gasDiscountFrom(address from) {
    uint256 initialGasLeft = gasleft();
    _;
    _makeGasDiscount(initialGasLeft - gasleft(), from);
  }

  function _makeGasDiscount(uint256 gasSpent, address from) internal {
    uint256 tokens = (gasSpent + 14154) / 41130;
    uint256 safeNumTokens;
    uint256 gas = gasleft();

    if (gas >= 27710) {
      safeNumTokens = (gas - 27710) / 7020;
    }

    if (tokens > safeNumTokens) {
      tokens = safeNumTokens;
    }

    return tokens > 0 ? gst2.freeFromUpTo(from, tokens) : 0;
  }
}
