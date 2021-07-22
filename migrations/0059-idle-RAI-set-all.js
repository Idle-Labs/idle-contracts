const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20 = artifacts.require("IERC20");
const IERC20Detailed = artifacts.require("IERC20Detailed");
const VesterFactory = artifacts.require("VesterFactory.sol");
const Vester = artifacts.require("Vester");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const IGovernorAlpha = artifacts.require("IGovernorAlpha");
const Idle = artifacts.require("Idle")
const addresses = require("./addresses");
const {
  createProposal,
  advanceBlocks,
  toBN,
  askToContinue,
  Proposal,
  check,
  checkIncreased,
} = require("./utils");

module.exports = async (deployer, network, accounts) => {
  if (network === 'test' || network == 'coverage') {
    return;
  }

  const idleToken = await IdleTokenGovernance.at(addresses.idleRAIV4);

  const protocolTokens = [
    addresses.crRAI[network],
    addresses.fuseRAI[network],
  ]

  const wrappers = [
    // crRAI
    "0x3c0F2CAe66f6ad744e1d2E976f4a2153Bd5e3cCd",
    // fuseRAI implementation
    // there's also a minimal proxy deployed at 0x58400436144723F3377aBe9aFb63ca75A2F57996
    // and not used yet.
    "0x8788050c3026557C539a2b8fCe146E27fA4ACc4F",
  ]

  const newGovTokens = [
  ]

  const newGovTokensEqualLen = [
    addresses.addr0, // crRAI
    addresses.addr0, // fuseRAI
  ]

  console.log("calling setAllAvailableTokensAndWrappers");
  await idleToken.setAllAvailableTokensAndWrappers(
    protocolTokens,
    wrappers,
    newGovTokens,
    newGovTokensEqualLen,
    { from: addresses.creator }
  );
}
