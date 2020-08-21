pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./interfaces/ILendingProtocol.sol";
import "./interfaces/Comptroller.sol";
import "./interfaces/CERC20.sol";
import "./interfaces/UniswapV2Router.sol";

/**
 * @title: Idle Token interface
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

interface IIdleTokenV3_1 {
  function tokenPrice() external view returns (uint256 price);
  function token() external view returns (address);
  function getAPRs() external view returns (address[] memory addresses, uint256[] memory aprs);
  function getAvgAPR() external view returns (uint256 apr);
  function lastAllocations() external view returns (uint256[] memory);
  function allAvailableTokens(uint256) external view returns (address);
  function govTokens() external view returns (address[] memory addresses);
  function getGovTokensAmounts(address) external view returns (uint256[] memory amounts);
  function protocolWrappers(address) external view returns (address);
}

contract IdleViewHelper is Initializable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  address public uniRouter;
  address public comp;
  address public comptroller;
  address public weth;
  address public rebalancer;
  uint256 public blocksPerYear;

  function initialize() public initializer {
    uniRouter = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    comp = address(0xc00e94Cb662C3520282E6f5717214004A7f26888);
    comptroller = address(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);
    weth = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    rebalancer = address(0xB3C8e5534F0063545CBbb7Ce86854Bf42dB8872B);
    blocksPerYear = 2371428;
  }

  function getCurrentAllocations(address _idleToken) public view
    returns (address[] memory tokenAddresses, uint256[] memory amounts, uint256 total) {
      IIdleTokenV3_1 _idle = IIdleTokenV3_1(_idleToken);
      (address[] memory addrs,) = _idle.getAPRs();
      uint256 len = addrs.length + 1;
      tokenAddresses = new address[](len);
      amounts = new uint256[](len);

      address currentToken;
      uint256 currTokenPrice;

      for (uint256 i = 0; i < len - 1; i++) {
        currentToken = _idle.allAvailableTokens(i);
        tokenAddresses[i] = currentToken;
        currTokenPrice = ILendingProtocol(_idle.protocolWrappers(currentToken)).getPriceInToken();
        amounts[i] = currTokenPrice.mul(
          IERC20(currentToken).balanceOf(_idleToken)
        ).div(10**18);
        total = total.add(amounts[i]);
      }

      tokenAddresses[len-1] = _idle.token();
      amounts[len-1] = IERC20(_idle.token()).balanceOf(_idleToken);
      total = total.add(amounts[len-1]);

      // return addresses and respective amounts in underlying
      return (tokenAddresses, amounts, total);
  }

  function getFullAPR(address _idleToken) external view returns (uint256 apr) {
    IIdleTokenV3_1 _idle = IIdleTokenV3_1(_idleToken);
    apr = _idle.getAvgAPR();
    if (getGovTokensLength(_idleToken) > 0) {
      // add weighted gov apr
      (address[] memory tokenAddresses, uint256[] memory amounts, uint256 total) = getCurrentAllocations(_idleToken);
      uint256 compApr = getCompApr(_idle.token(), tokenAddresses[0]);
      // COMP is first token, if new gov tokens are added this part needs to be updated
      apr = apr.add(amounts[0].mul(compApr).div(total));
    }
  }

  // TODO add a method in IdleTokenV3_1
  function getGovTokensLength(address _idleToken) public view returns (uint256) {
    uint256[] memory _amounts = IIdleTokenV3_1(_idleToken).getGovTokensAmounts(rebalancer);
    return _amounts.length;
  }

  function getCompApr(address _token, address cToken) public view returns (uint256 apr)  {
    uint256 compSpeeds = Comptroller(comptroller).compSpeeds(cToken);
    CERC20 _ctoken = CERC20(cToken);
    uint256 cTokenNAV = _ctoken.exchangeRateStored().mul(IERC20(cToken).totalSupply()).div(10**18);
    // how much costs 1COMP in _token
    address[] memory path = new address[](3);
    path[0] = _token;
    path[1] = weth;
    path[2] = comp;
    uint256[] memory amounts = UniswapV2Router(uniRouter).getAmountsIn(10**18, path);
    return compSpeeds.mul(amounts[0]).mul(blocksPerYear).div(cTokenNAV).mul(100);
  }
}
