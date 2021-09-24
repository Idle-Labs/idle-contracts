const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20 = artifacts.require("IERC20");
const IERC20Detailed = artifacts.require("IERC20Detailed");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const IGovernorAlpha = artifacts.require("IGovernorAlpha");
const Idle = artifacts.require("Idle")
const addresses = require("./addresses");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const idleTokenImplementationAddress = addresses.lastIdleTokenImplementation;
  console.log('implementation', idleTokenImplementationAddress)

  const proxyAdminAddress = "0x9618eDC1b2ceDC6975CA44E2AD78BF8dd73917F3";
  const proxyAdmin = await IProxyAdmin.at(proxyAdminAddress);
  const idleFEI = await IdleTokenGovernance.at(addresses.idleFEIV4);

  const initMethodToCall = web3.eth.abi.encodeFunctionCall({
    name: "_init",
    type: "function",
    inputs: []
  }, []);

  console.log("calling upgrade and call");

  await proxyAdmin.upgradeAndCall(
    addresses.idleFEIV4,
    idleTokenImplementationAddress,
    initMethodToCall,
    { from: addresses.creator }
  );
}
