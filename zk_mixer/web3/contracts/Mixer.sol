// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVerifier} from "./IVerifier.sol";
import {IncrementalMerkleTree} from "./IncrementalMerkleTree.sol";

contract Mixer is IncrementalMerkleTree {
    IVerifier public immutable i_verifier;
    uint256 public constant DEPOSIT_AMOUNT = 0.001 ether;

    mapping(bytes32 => bool) public s_commitments;

    event Mixer__Deposit(
        bytes32 indexed commitment,
        uint256 indexed leafIndex,
        uint256 timestamp
    );

    error Mixer__CommitmentAlreadyExists(bytes32 commitment);
    error Mixer__DepositAmountNotMet(
        uint256 amountSent,
        uint256 requiredAmount
    );

    constructor(
        IVerifier _verifier,
        uint256 _treeDepth
    ) IncrementalMerkleTree(_treeDepth) {
        i_verifier = _verifier;
    }

    function deposit(bytes32 _commitment) external payable {
        if (s_commitments[_commitment]) {
            revert Mixer__CommitmentAlreadyExists(_commitment);
        }
        if (msg.value != DEPOSIT_AMOUNT) {
            revert Mixer__DepositAmountNotMet(msg.value, DEPOSIT_AMOUNT);
        }

        s_commitments[_commitment] = true;
        uint256 leafIndex = _insert(_commitment);
        emit Mixer__Deposit(_commitment, leafIndex, block.timestamp);
    }

    function withdraw() external {
        // Implement withdrawal logic
    }
}
