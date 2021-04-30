/**
 * @title: Idle Token Helper contract
 * @summary: Includes helper methods for IdleTokenGovernance
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/PriceOracle.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IIdleTokenGovernance.sol";

contract IdleTokenHelper {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 private constant ONE_18 = 10**18;
  uint256 private constant FULL_ALLOC = 100000;
  address public constant IDLE = address(0x875773784Af8135eA0ef43b5a374AaD105c5D39e);
  address public constant COMP = address(0xc00e94Cb662C3520282E6f5717214004A7f26888);
  address public constant stkAAVE = address(0x4da27a545c0c5B758a6BA100e3a049001de870f5);
  address public constant WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

  function getAPR(address _idleToken, address _cToken, address _aToken) external view returns (uint256 avgApr) {
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
        avgApr = avgApr.add(amounts[i].mul(getGovApr(idleToken, _cToken, _aToken, currGov)));
      }
    }

    avgApr = avgApr.div(total);
  }

  /**
   * Get gov token APR
   *
   * @return : apr scaled to 1e18
   */
  function getGovApr(IIdleTokenGovernance idleToken, address _cToken, address _aToken, address _govToken) internal view returns (uint256) {
    // In case new Gov tokens will be supported this should be updated, no need to add IDLE apr
    if (_govToken == COMP && _cToken != address(0)) {
      return PriceOracle(idleToken.oracle()).getCompApr(_cToken, idleToken.token());
    }
    if (_govToken == stkAAVE && _aToken != address(0)) {
      return PriceOracle(idleToken.oracle()).getStkAaveApr(_aToken, idleToken.token());
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
}
