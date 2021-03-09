const IdleAaveV2 = artifacts.require("IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');

const toBN = v => new BigNumber(v.toString());

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const idleTokenAddress = addresses.idleDAIV4;
  const aTokenAddress = addresses.aDAIV2.live;
  const underlyingTokenAddress = addresses.DAI.live;
  const aaveV2WrapperImplementation = await IdleAaveV2.at(addresses.idleAaveV2Implementation);

  console.log("idleTokenAddress", idleTokenAddress)
  console.log("aTokenAddress", aTokenAddress)
  console.log("underlyingTokenAddress", underlyingTokenAddress)
  console.log("aaveV2WrapperImplementation", aaveV2WrapperImplementation.address)
  console.log("aaveAddressesProvider", addresses.aaveAddressesProvider)

  const result = await aaveV2WrapperImplementation.initialize(aTokenAddress, addresses.aaveAddressesProvider, idleTokenAddress);
  totalGas = toBN(result.receipt.gasUsed);
  console.log("total gas used", totalGas.toString());
}
