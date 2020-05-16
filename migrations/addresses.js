require('dotenv').config();

module.exports = {
  creator: process.env.CREATOR,
  rebalancerManager: process.env.REBALANCE_MANAGER,
  feeAddress: process.env.FEE_ADDRESS,
  gstAddress: "0x0000000000b3F879cb30FE243b4Dfee438691c04",
  idlePriceCalculator: '0xAefb1325A2C1756Bc3fcc516D6C2CF947D225358',
  idleDAIBest: '0x78751b12da02728f467a44eac40f5cbc16bd7934',
  idleRebalancerDAIBest: '0x99d053a0f4b4100e739c6b42829c7cb59c031d08'
};
