const IdleTokenGovernance = artifacts.require("IdleTokenGovernance");
const IERC20 = artifacts.require("IERC20.sol");
const IProxyAdmin = artifacts.require("IProxyAdmin");
const FlashLoanerMock = artifacts.require("FlashLoanerMock");
const addresses = require("./addresses");
const BigNumber = require('bignumber.js');

const holder = "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98";
const proxyAdminAddress = '0x7740792812A00510b50022D84e5c4AC390e01417';

const toBN = v => new BigNumber(v.toString());
const toBNString = v => new BigNumber(v.toString()).toString();
const ONE_18 = toBN("10").pow(toBN("18"));
const toUnit = v => v.div(ONE_18);
const toUnitString = v => toUnit(toBN(v)).toString();
const fromUnits = u => toBN(u).times(ONE_18);

module.exports = async function(deployer) {
  await web3.eth.sendTransaction({ from: holder, to: addresses.timelock, value: "1000000000000000000" });

  const idleTokenAddress = addresses.idleDAIV4;

  await deployer.deploy(IdleTokenGovernance);
  const newImplementation = await IdleTokenGovernance.deployed();
  console.log("implementation deployed at", newImplementation.address)

  const proxyAdmin = await IProxyAdmin.at(proxyAdminAddress);
  await proxyAdmin.upgrade(idleTokenAddress, newImplementation.address, { from: addresses.timelock });

  const dai = await IERC20.at(addresses.DAI.live);
  const idleToken = await IdleTokenGovernance.at(idleTokenAddress);

  await deployer.deploy(FlashLoanerMock, dai.address, idleTokenAddress);
  const flashLoaner = await FlashLoanerMock.deployed();

  const initialDAITransfer = fromUnits("1000");
  await dai.transfer(flashLoaner.address, initialDAITransfer, { from: holder });

  const executeFlashLoan = async (unitsAmount) => {
    const initialBalance = await dai.balanceOf(flashLoaner.address);
    const loanAmount = fromUnits(unitsAmount);
    await idleToken.flashLoan(
      flashLoaner.address,
      loanAmount,
      web3.eth.abi.encodeParameters(["uint256"], [44]),
      holder,
      { from: holder }
    );

    const amountReceived = await flashLoaner.amountReceived();
    const daiBalanceOnExecuteStart = await flashLoaner.daiBalanceOnExecuteStart();
    const daiBalanceOnExecuteEnd = await flashLoaner.daiBalanceOnExecuteEnd();
    const feeReceived = await flashLoaner.feeReceived();
    const initiatorReceived = await flashLoaner.initiatorReceived();
    const paramsReceived = await flashLoaner.paramsReceived();
    const daiToSendBack = await flashLoaner.daiToSendBack();

    console.log("initialBalance", toUnitString(initialBalance));
    console.log("amountReceived", toUnitString(amountReceived));
    console.log("daiBalanceOnExecuteStart", toUnitString(daiBalanceOnExecuteStart));
    console.log("feeReceived", toUnitString(feeReceived));
    console.log("initiatorReceived", initiatorReceived);
    console.log("paramsReceived", paramsReceived);
    console.log("daiToSendBack", toUnitString(daiToSendBack));
    console.log("daiBalanceOnExecuteEnd", toUnitString(daiBalanceOnExecuteEnd));
  }

  await executeFlashLoan("100");
  console.log("***********************");
  await flashLoaner.setRemoveFromFee(toBN("1"));

  try {
    await executeFlashLoan("100");
    throw("not-expected");
  } catch(err) {
    if (err === "not-expected") {
      throw("flash loan should have failed");
    }
    console.log("flash loan expected error:", err.toString())
  }
};