/**
 * @title: Idle Token (V3) main contract
 * @summary: ERC20 that holds pooled user funds together
 *           Each token rapresent a share of the underlying pools
 *           and with each token user have the right to redeem a portion of these pools
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";

import "./interfaces/PriceOracle.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IIdleTokenGovernance.sol";

contract IdleTokenHelper is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 private constant ONE_18 = 10**18;
  uint256 private constant FULL_ALLOC = 100000;
  address public constant IDLE = address(0x875773784Af8135eA0ef43b5a374AaD105c5D39e);
  address public constant COMP = address(0xc00e94Cb662C3520282E6f5717214004A7f26888);
  address public constant WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
  address public constant UNI_ROUTER_V2 = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
  mapping(address => bool) public validIdleTokens;
  address public rebalancer;

  function initialize() public initializer {
    Ownable.initialize(msg.sender);
    rebalancer = address(0xB3C8e5534F0063545CBbb7Ce86854Bf42dB8872B);

    validIdleTokens[0x3fE7940616e5Bc47b0775a0dccf6237893353bB4] = true; // idleDAIV4
    validIdleTokens[0x5274891bEC421B39D23760c04A6755eCB444797C] = true; // idleUSDCV4
    validIdleTokens[0xF34842d05A1c888Ca02769A633DF37177415C2f8] = true; // idleUSDTV4
    validIdleTokens[0xF52CDcD458bf455aeD77751743180eC4A595Fd3F] = true; // idleSUSDV4
    validIdleTokens[0xc278041fDD8249FE4c1Aad1193876857EEa3D68c] = true; // idleTUSDV4
    validIdleTokens[0x8C81121B15197fA0eEaEE1DC75533419DcfD3151] = true; // idleWBTCV4
    validIdleTokens[0xC8E6CA6E96a326dC448307A5fDE90a0b21fd7f80] = true; // idleWETHV4
    validIdleTokens[0xa14eA0E11121e6E951E87c66AFe460A00BCD6A16] = true; // idleDAISafeV4
    validIdleTokens[0x3391bc034f2935eF0E1e41619445F998b2680D35] = true; // idleUSDCSafeV4
    validIdleTokens[0x28fAc5334C9f7262b3A3Fe707e250E01053e07b5] = true; // idleUSDTSafeV4
  }

  function setIdleTokens(address[] memory _newIdleTokens) public onlyOwner {
    for (uint256 i = 0; i < _newIdleTokens.length; i++) {
      validIdleTokens[_newIdleTokens[i]] = true;
    }
  }

  function getAPR(address _idleToken, address _cToken) external view returns (uint256 avgApr) {
    (uint256[] memory amounts, uint256 total) = getCurrentAllocations(_idleToken);

    IIdleTokenGovernance idleToken = IIdleTokenGovernance(_idleToken);
    address[] memory allAvailableTokens = idleToken.getAllAvailableTokens();

    // IDLE gov token won't be counted here because is not in allAvailableTokens
    for (uint256 i = 0; i < allAvailableTokens.length; i++) {
      if (amounts[i] == 0) {
        continue;
      }
      address protocolToken = allAvailableTokens[i];
      // avgApr = avgApr.add(currApr.mul(weight).div(ONE_18))
      avgApr = avgApr.add(
        ILendingProtocol(idleToken.protocolWrappers(protocolToken)).getAPR().mul(
          amounts[i]
        )
      );
      // Add weighted gov tokens apr
      address currGov = idleToken.getProtocolTokenToGov(protocolToken);
      if (idleToken.getGovTokens().length > 0 && currGov != address(0)) {
        avgApr = avgApr.add(amounts[i].mul(getGovApr(idleToken, _cToken, currGov)));
      }
    }

    avgApr = avgApr.div(total);
  }

  /**
   * Get gov token APR
   *
   * @return : apr scaled to 1e18
   */
  function getGovApr(IIdleTokenGovernance idleToken, address _cToken, address _govToken) internal view returns (uint256) {
    // In case new Gov tokens will be supported this should be updated, no need to add IDLE apr
    if (_govToken == COMP && _cToken != address(0)) {
      return PriceOracle(idleToken.oracle()).getCompApr(_cToken, idleToken.token());
    }
  }

  /**
   * Get the contract balance of every protocol currently used
   *
   * @return amounts : array with all amounts for each protocol in order,
   *                   eg [amountCompoundInUnderlying, amountFulcrumInUnderlying]
   * @return total : total AUM in underlying
   */
  function getCurrentAllocations(address _idleToken) public view
    returns (uint256[] memory amounts, uint256 total) {
      IIdleTokenGovernance idleToken = IIdleTokenGovernance(_idleToken);
      address[] memory allAvailableTokens = idleToken.getAllAvailableTokens();
      // Get balance of every protocol implemented
      uint256 tokensLen = allAvailableTokens.length;
      amounts = new uint256[](tokensLen);

      address currentToken;
      uint256 currTokenPrice;

      for (uint256 i = 0; i < tokensLen; i++) {
        currentToken = allAvailableTokens[i];
        currTokenPrice = ILendingProtocol(idleToken.protocolWrappers(currentToken)).getPriceInToken();
        amounts[i] = currTokenPrice.mul(
          IERC20(currentToken).balanceOf(_idleToken)
        ).div(ONE_18);
        total = total.add(amounts[i]);
      }

      // return addresses and respective amounts in underlying
      return (amounts, total);
  }

  /**
   * Get APR of every ILendingProtocol
   *
   * @return addresses: array of token addresses
   * @return aprs: array of aprs (ordered in respect to the `addresses` array)
   */
  function getAPRs(address _idleToken)
    external view
    returns (address[] memory addresses, uint256[] memory aprs) {
      IIdleTokenGovernance idleToken = IIdleTokenGovernance(_idleToken);
      address[] memory allAvailableTokens = idleToken.getAllAvailableTokens();

      address currToken;
      addresses = new address[](allAvailableTokens.length);
      aprs = new uint256[](allAvailableTokens.length);
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        currToken = allAvailableTokens[i];
        addresses[i] = currToken;
        aprs[i] = ILendingProtocol(idleToken.protocolWrappers(currToken)).getAPR();
      }
  }

  /**
   * Covert gov tokens in underlyings, this method is expected to be called from an idleToken
   * tokens needs to be transferred here before
   *
   * @param _minTokenOut : minOutputAmount uniswap, 0 to skip swap for token
   */
  function sellGovTokens(address _idleToken, uint256[] calldata _minTokenOut) external {
    require(validIdleTokens[_idleToken] == true, "invalid Idle token");

    IIdleTokenGovernance idleToken = IIdleTokenGovernance(_idleToken);

    require(
      isOwner() ||
      tx.origin == idleToken.rebalancer() ||
      tx.origin == idleToken.owner(),
      "IDLEHELP:!AUTH"
    );

    address[] memory govTokens = idleToken.getGovTokens();

    uint256 govLen = govTokens.length;
    require(_minTokenOut.length == govLen, "IDLE:!EQ");

    IUniswapV2Router02 uniswapRouterV2 = IUniswapV2Router02(UNI_ROUTER_V2);

    uint256 _currentBalance;
    address[] memory path = new address[](3);
    path[1] = WETH;
    path[2] = idleToken.token(); // output will always be token

    for (uint256 i = 0; i < govLen; i++) {
      address newGov = govTokens[i];
      if (newGov == IDLE || _minTokenOut[i] == 0) { continue; }
      _currentBalance = IERC20(newGov).balanceOf(address(this));
      if (_currentBalance > 0) {
        // approve uni router
        IERC20(newGov).safeIncreaseAllowance(UNI_ROUTER_V2, _currentBalance);
        // create route govToken -> WETH -> token
        path[0] = newGov;
        // swap token
        uniswapRouterV2.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          _currentBalance,
          _minTokenOut[i],
          path,
          _idleToken,
          block.timestamp.add(1800)
        );
      }
    }
  }

  function emergencyWithdrawToken(address _token, address _to) external {
    require(msg.sender == owner() || msg.sender == rebalancer, "IDLEHELP:!AUTH");
    IERC20(_token).safeTransfer(_to, IERC20(_token).balanceOf(address(this)));
  }
}
