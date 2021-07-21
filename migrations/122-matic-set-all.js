const IERC20 = artifacts.require("./IERC20Detailed.sol");
const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20Mintable = artifacts.require("./IERC20Mintable.sol");
const AToken = artifacts.require("AToken.sol");
const IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const AaveLendingPoolProviderV2 = artifacts.require("AaveLendingPoolProviderV2");
const IAaveIncentivesController = artifacts.require("IAaveIncentivesController");
const addresses = require('./addresses.js');
const { tokenUtils, log, toBN } = require("./utils");

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage') {
    return;
  }


  //TODO: REMOVE
  network = "matic";
  const chainId = await web3.eth.getChainId();
  const creator = addresses.creator;

  const idleTokenAddress = addresses.maticIdleDAIV4;
  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

  // // setOracleAddress
  // console.log("calling setOracleAddress...");
  // await idleToken.setOracleAddress(addresses.priceOracleV2[network], { from: creator, chainId });
  // console.log("done.");

  // --------------------------------------

  // // setAllAvailableTokensAndWrappers
  // const aDAIV2Wrapper = await idleToken.protocolWrappers(addresses.aDAIV2[network]);
  // console.log("calling setAllAvailableTokensAndWrappers...");
  // await idleToken.setAllAvailableTokensAndWrappers(
  //   [addresses.aDAIV2[network]], // protocolTokens
  //   [aDAIV2Wrapper], // wrappers
  //   [addresses.WMATIC[network]], // newGovTokens
  //   [addresses.WMATIC[network]], // newGovTokensEqualLen
  //   { from: creator, chainId }
  // );
  // console.log("done.");

  // --------------------------------------

  // // setAToken
  // console.log("calling setAToken...");
  // await idleToken.setAToken(addresses.aDAIV2[network], { from: creator, chainId });
  // console.log("done.");

  // --------------------------------------

  // // setFeeAddress
  // const polygonFeeAddress = "0xe4e69ef860d3018b61a25134d60678be8628f780";
  // console.log("calling setFeeAddress...");
  // await idleToken.setFeeAddress(polygonFeeAddress, { from: creator, chainId });
  // console.log("done.");

  //TODO: setRebalancer
}
