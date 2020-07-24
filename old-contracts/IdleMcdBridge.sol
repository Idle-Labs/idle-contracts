
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

pragma solidity 0.5.16;

interface IIdleV1 {
    // _amount is the amount of idleSAI that one wants to burn
    function redeemIdleToken(uint256 _amount) external returns (uint256 tokensRedeemed);
    function balanceOf(address _account) external view returns (uint256);
    function bestToken() external view returns(address);
    function iToken() external view returns(address);
    function cToken() external view returns(address);
    function token() external view returns(address);
    function tokenPrice() external view returns (uint256);
}

// File: contracts/interfaces/IIToken.sol

pragma solidity 0.5.16;

interface IIToken {
    function mint(
        address _receiver,
        uint256 _depositAmount)
        external
        returns (uint256 _mintAmount);

    function burn(
        address receiver,
        uint256 burnAmount)
        external
        returns (uint256 loanAmountPaid);
    function loanTokenAddress() external view returns (address);
    function tokenPrice() external view returns (uint256);
}

// File: contracts/libraries/Utils.sol

pragma solidity 0.5.16;



// Should not forget to linkx
library Utils {
    using Math for uint256;

    function balanceOrAmount(IERC20 _token, uint256 _amount) internal view returns(uint256) {
        if(address(_token) == address(0)) {
            return address(this).balance;
        }
        return _token.balanceOf(address(this)).min(_amount);
        // return 1 ether;
    }
}

// File: contracts/partials/PartialIdleV1.sol

pragma solidity 0.5.16;







library PartialIdleV1 {
    using SafeMath for uint256;

    function burn(address _idleTokenAddress, uint256 _amount) internal {
        IIdleV1 idleToken = IIdleV1(_idleTokenAddress);
        uint256 idleTokenAmount = Utils.balanceOrAmount(IERC20(_idleTokenAddress), _amount);
        uint256 expectedAmount = idleTokenAmount.mul(idleToken.tokenPrice()).div(10**18);
        idleToken.redeemIdleToken(idleTokenAmount);
        require(IERC20(idleToken.token()).balanceOf(address(this)) >= (expectedAmount - 1), "PartialIdleV1.burn: IDLE_MONEY_MARKET_NOT_LIQUID");
    }

    function getUnderlying(address _idleTokenAddress) internal returns(address) {
        return IIdleV1(_idleTokenAddress).token();
    }
 }

// File: contracts/interfaces/IIdleV2.sol

pragma solidity 0.5.16;

interface IIdleV2 {
  // one should approve the contract as spender for DAI before calling this method
  // _amount is the amount of SAI/DAI that one wants to lend
  // _clientProtocolAmounts can be an empty array for the migration
  function mintIdleToken(uint256 _amount, uint256[] calldata _clientProtocolAmounts) external returns (uint256 mintedTokens);
  function token() external view returns(address);
}

// File: contracts/partials/PartialIdleV2.sol

pragma solidity 0.5.16;






library PartialIdleV2 {

    function mint(address _idleTokenAddress, uint256 _amount, uint256[] memory _clientProtocolAmounts) internal {
        IIdleV2 idleToken = IIdleV2(_idleTokenAddress);
        IERC20 token = IERC20(idleToken.token());
        uint256 amount = Utils.balanceOrAmount(token, _amount);
        token.approve(_idleTokenAddress, amount);
        idleToken.mintIdleToken(amount, _clientProtocolAmounts);
        require(IERC20(_idleTokenAddress).transfer(msg.sender, IERC20(_idleTokenAddress).balanceOf(address(this))), 'Err transfering');
    }

    function getUnderlying(address _idleTokenAddress) internal returns(address) {
        return IIdleV2(_idleTokenAddress).token();
    }
 }

// File: contracts/interfaces/IScdMcdMigration.sol

pragma solidity 0.5.16;

interface IScdMcdMigration {
    function swapSaiToDai(uint256 _amount) external;
    function swapDaiToSai(uint256 _amount) external;
}

// File: contracts/Registry.sol

pragma solidity 0.5.16;


contract Registry is Ownable {
    mapping(bytes32 => address) internal contracts;

    function lookup(bytes32 _hashedName) external view returns(address) {
        return contracts[_hashedName];
    }

    function lookup(string memory _name) public view returns(address){
        return contracts[keccak256(abi.encodePacked(_name))];
    }

    function setContract(string memory _name, address _contractAddress) public {
        setContract(keccak256(abi.encodePacked(_name)), _contractAddress);
    }

    function setContract(bytes32 _hashedName, address _contractAddress) public onlyOwner {
        contracts[_hashedName] = _contractAddress;
    }
}

// File: contracts/libraries/RL.sol

pragma solidity 0.5.16;


library RL {
    // Mainnet
    Registry constant internal registry = Registry(0xDc7eB6c5d66e4816E5CC69a70AA22f4584167333);
    // Kovan
    /* Registry constant internal registry = Registry(0xECbA2158241a05B833F61F8BB56F690A63fBFF77); */

    // keccakc256(abi.encodePacked("sai"));
    bytes32 public constant _sai = 0x121766960ca66154cf52cc7f62663f2342706e7901d35f1d93fb4a7c321fa14a;
    bytes32 public constant _dai = 0x9f08c71555a1be56230b2e2579fafe4777867e0a1b947f01073e934471de15c1;
    bytes32 public constant _daiMigrationContract = 0x42d07b69ad62387b020b27e811fc060bc382308c513cb96f08ea805c77a04f9b;

    bytes32 public constant _cache = 0x422c51ed3da5a7658c50a3684c705b5f1e3d2d1673c5e16aaf93ea6271bb54cf;
    bytes32 public constant _gateKeeper = 0xcfa0d7a8bc1be8e2b981746eace0929cdd2721f615b63382540820f02696577b;
    bytes32 public constant _treasury = 0xcbd818ad4dd6f1ff9338c2bb62480241424dd9a65f9f3284101a01cd099ad8ac;

    bytes32 public constant _kyber = 0x758760f431d5bf0c2e6f8c11dbc38ddba93c5ba4e9b5425f4730333b3ecaf21b;
    bytes32 public constant _synthetix = 0x52da455363ee608ccf172b43cb25e66cd1734a315508cf1dae3e995e8106011a;
    bytes32 public constant _synthetixDepot = 0xcfead29a36d4ab9b4a23124bdd16cdd5acfdf5334caa9b0df48b01a0b6d68b20;


    function lookup(bytes32 _hashedName) internal view returns(address) {
        return registry.lookup(_hashedName);
    }

    function dai() internal pure returns(bytes32) {
        return _dai;
    }
    function sai() internal pure returns(bytes32) {
        return _sai;
    }
    function daiMigrationContract() internal pure returns(bytes32) {
        return _daiMigrationContract;
    }
    function cache() internal pure returns(bytes32) {
        return _cache;
    }
    function gateKeeper() internal pure returns(bytes32) {
        return _gateKeeper;
    }
    function treasury() internal pure returns(bytes32) {
        return _treasury;
    }

    function kyber() internal pure returns(bytes32) {
        return _kyber;
    }
    function synthetix() internal pure returns(bytes32) {
        return _synthetix;
    }
    function synthetixDepot() internal pure returns(bytes32) {
        return _synthetixDepot;
    }
}

// File: contracts/partials/PartialMcdMigration.sol

pragma solidity 0.5.16;





library PartialMcdMigration {

    function swapSaiToDai(uint256 _amount) internal {
        IERC20 sai = IERC20(RL.lookup(RL.sai()));
        IScdMcdMigration daiMigrationContract = IScdMcdMigration(RL.lookup(RL.daiMigrationContract()));
        uint256 amount = Utils.balanceOrAmount(sai, _amount);
        sai.approve(address(daiMigrationContract), amount);
        daiMigrationContract.swapSaiToDai(amount);
    }

    function swapDaiToSai(uint256 _amount) internal {
        IERC20 dai = IERC20(RL.lookup(RL.dai()));
        IScdMcdMigration daiMigrationContract = IScdMcdMigration(RL.lookup(RL.daiMigrationContract()));
        uint256 amount = Utils.balanceOrAmount(dai, _amount);
        dai.approve(address(daiMigrationContract), amount);
        daiMigrationContract.swapDaiToSai(amount);
    }
}

// File: contracts/partials/PartialPull.sol

pragma solidity 0.5.16;



library PartialPull {
    using Math for uint256;

    function pull(IERC20 _token, uint256 _amount) internal {
        if(address(_token) == address(0)) {
            require(msg.value == _amount, "PartialPull.pull: MSG_VALUE_INCORRECT");
        }
        // uint256 amount = Utils.balanceOrAmount(_token, _amount);
        // Either pull the balance, allowance or _amount, whichever is the smallest number
        uint256 amount = _token.balanceOf(msg.sender).min(_amount).min(_token.allowance(msg.sender, address(this)));
        require(_token.transferFrom(msg.sender, address(this), amount), "PartialPull.pull: TRANSFER_FAILED");
    }
}

// File: contracts/partials/PartialPush.sol

pragma solidity 0.5.16;





library PartialPush {
    using Math for uint256;
    using Address for address;

    function push(IERC20 _token, address _receiver, uint256 _amount) internal {
        uint256 amount = Utils.balanceOrAmount(_token, _amount);
        if(address(_token) == address(0)) {
            _receiver.toPayable().transfer(amount);
        }
        _token.transfer(_receiver, amount);
    }
}

// File: contracts/TokenSaver.sol

pragma solidity 0.5.16;



contract TokenSaver is Ownable {

    function saveEther() external onlyOwner {
        msg.sender.transfer(address(this).balance);
    }

    function saveTokens(address _token) external onlyOwner {
        IERC20 token = IERC20(_token);
        // Some tokens do not allow a balance to drop to zero so we leave 1 wei to be safe
        token.transfer(msg.sender, token.balanceOf(address(this)) - 1);
    }

}

// File: contracts/static-recipes/IdleMcdBridge.sol

pragma solidity 0.5.16;








contract IdleMcdBridge is TokenSaver {

    uint256 constant MAX = uint256(-1);

    address public SAI;
    address public DAI;

    constructor(address _SAI, address _DAI) public {
        SAI = _SAI;
        DAI = _DAI;
    }

    function bridgeIdleV1ToIdleV2(address _V1, address _V2, uint256 _amount, uint256[] calldata _clientProtocolAmounts) external {
        PartialPull.pull(IERC20(_V1), _amount);
        PartialIdleV1.burn(_V1, _amount);

        address underlyingV1 = PartialIdleV1.getUnderlying(_V1);
        address underlyingV2 = PartialIdleV2.getUnderlying(_V2);

        if(underlyingV1 == SAI && underlyingV2 == DAI) {
            // Migrate SAI TO DAI
            PartialMcdMigration.swapSaiToDai(MAX);

        } else if(underlyingV1 == DAI && underlyingV2 == SAI) {
            // Migrate DAI TO SAI
            PartialMcdMigration.swapDaiToSai(MAX);
        }
        // Else idle tokens have same underlying asset so do nothing

        // Mint v2 Tokens
        PartialIdleV2.mint(_V2, MAX, _clientProtocolAmounts);
    }
}
