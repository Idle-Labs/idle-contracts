pragma solidity 0.5.16;

contract DyDxStructs {
  enum ActionType { Deposit, Withdraw }
  enum AssetDenomination { Wei }
  enum AssetReference { Delta } // the amount is given as a delta from the current value

  struct AssetAmount {
    bool sign; // true if positive
    AssetDenomination denomination;
    AssetReference ref;
    uint256 value;
  }

  struct ActionArgs {
    ActionType actionType;
    uint256 accountId;
    AssetAmount amount;
    uint256 primaryMarketId;
    uint256 secondaryMarketId;
    address otherAddress;
    uint256 otherAccountId;
    bytes data;
  }

  struct Info {
    address owner;  // The address that owns the account
    uint256 number; // A nonce that allows a single address to control many accounts
  }

  struct Wei {
    bool sign; // true if positive
    uint256 value;
  }
}
