var IdleTokenV3_1 = artifacts.require("./IdleTokenV3_1.sol");
var IdleTokenGovernance = artifacts.require("./IdleTokenGovernance.sol");
var IdleAaveV2 = artifacts.require("./IdleAaveV2.sol");
var IERC20 = artifacts.require("./IERC20Detailed.sol");
const MinimalInitializableProxyFactory = artifacts.require("MinimalInitializableProxyFactory");
const addresses = require('./addresses.js');

const BigNumber = require('bignumber.js');
const BN = s => new BigNumber(String(s));


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' ||  network === 'soliditycoverage') {
    return;
  }

  const creator = addresses.creator;
  const decimals = 18;
  const idleTokenAddress = addresses.idleFEIV4;
  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

  if (network === "local") {
    await web3.eth.sendTransaction({ from: accounts[0], to: creator, value: "1000000000000000000"});
  }

  if (addresses.idleAaveV2FEI === undefined) {
    console.log("************************************************************************");
    console.log("set the value of idleAaveV2FEI from the previous migration and try again.");
    console.log("************************************************************************");
    return;
  }

  console.log('Network', network);
  console.log('Creator', creator);
  console.log('IdleToken', await idleToken.name(), idleTokenAddress);
  console.log('IdleToken owner', await idleToken.owner());
  console.log('FEI address: ', addresses.FEI[network]);
  console.log('aFEI address: ', addresses.aFEI[network]);
  console.log('##################');

  let protocolTokens = (await idleToken.getAPRs())["0"];
  let wrappers = [];

  console.log("Tokens and wrappers:");
  for (var i = 0; i < protocolTokens.length; i++) {
    const token = await IERC20.at(protocolTokens[i]);
    const wrapper = await idleToken.protocolWrappers(token.address);
    wrappers.push(wrapper);
    console.log(await token.name(), token.address, " => ", wrapper);
  };

  // add aFEI and its wrapper
  protocolTokens = [...protocolTokens, addresses.aFEI[network]];
  wrappers = [...wrappers, addresses.idleAaveV2FEI];

  const govTokens = []

  const govTokensEqualLen = [
    addresses.addr0, // crFEI
    addresses.addr0, // fuseFEI
    addresses.addr0, // aFEI
  ]

  console.log("\ncalling setAllAvailableTokensAndWrappers\n");
  await idleToken.setAllAvailableTokensAndWrappers(
    protocolTokens,
    wrappers,
    govTokens,
    govTokensEqualLen,
    { from: addresses.creator }
  );

  const newProtocolTokens = (await idleToken.getAPRs())["0"];
  console.log("New tokens and wrappers:");
  for (var i = 0; i < newProtocolTokens.length; i++) {
    const token = await IERC20.at(newProtocolTokens[i]);
    const wrapper = await idleToken.protocolWrappers(token.address);
    console.log(await token.name(), token.address, " => ", wrapper);
  };
};
