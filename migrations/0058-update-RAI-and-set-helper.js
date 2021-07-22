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

  const newOracle = addresses.priceOracleV2;

  // RAI implementation deployed with a different _init
  // function _init(address _tokenHelper, address _aToken, address _newOracle) external {
  //   require(tx.origin == owner(), '6');
  //   tokenHelper = _tokenHelper;
  //   // flashLoanFee = 80; // 0.08%
  //   aToken = _aToken;
  //   oracle = _newOracle;
  // }
  const idleTokenImplementationAddress = "0xC5cD8Ac8915E4B589Bd92A75C7663cC0B9B05e76";
  console.log('implementation', idleTokenImplementationAddress)

  const idleTokenHelperAddress = addresses.idleTokenHelper;
  console.log("idleTokenHelperAddress", idleTokenHelperAddress);

  const proxyAdminAddress = "0x659d9C49F4c21DDCF9246a7479aDe744fC4D04f8";
  const proxyAdminOwner = "0x70dc4c04f48a794964e97de7250e16f8d38b9a03";
  const proxyAdmin = await IProxyAdmin.at(proxyAdminAddress);

  const initMethodToCall = web3.eth.abi.encodeFunctionCall({
    name: "_init(address,address,address)",
    type: "function",
    inputs: [
      { type: "address", name: "_tokenHelper" },
      { type: "address", name: "_aToken" },
      { type: "address", name: "_newOracle" },
    ]
  }, [idleTokenHelperAddress, addresses.addr0, addresses.priceOracleV2]);

  console.log("calling upgrade and call");
  await proxyAdmin.upgradeAndCall(addresses.idleRAIV4, idleTokenImplementationAddress, initMethodToCall, { from: proxyAdminOwner });
}
