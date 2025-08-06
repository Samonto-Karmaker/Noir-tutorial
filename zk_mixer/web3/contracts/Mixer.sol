// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVerifier} from "./Verifier.sol";
import {IncrementalMerkleTree} from "./IncrementalMerkleTree.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Mixer is IncrementalMerkleTree, ReentrancyGuard {
    IVerifier public immutable i_verifier;
    uint256 public constant DEPOSIT_AMOUNT = 0.001 ether;

    mapping(bytes32 => bool) public s_commitments;
    mapping(bytes32 => bool) public s_nullifierHashes;

    event Mixer__Deposit(
        bytes32 indexed commitment,
        uint256 leafIndex,
        uint256 timestamp
    );
    event Mixer__Withdraw(
        address indexed recipient,
        bytes32 nullifierHash,
        uint256 timestamp
    );

    error Mixer__CommitmentAlreadyExists(bytes32 commitment);
    error Mixer__DepositAmountNotMet(
        uint256 amountSent,
        uint256 requiredAmount
    );
    error Mixer__NullifierAlreadyUsed(bytes32 nullifierHash);
    error Mixer__UnknownRoot(bytes32 root);
    error Mixer__InvalidProof();
    error Mixer__WithdrawFailed(address recipient);

    constructor(
        IVerifier _verifier,
        uint256 _treeDepth
    ) IncrementalMerkleTree(_treeDepth) {
        i_verifier = _verifier;
    }

    function deposit(bytes32 _commitment) external payable nonReentrant {
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

    function withdraw(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient
    ) external nonReentrant {
        if (s_nullifierHashes[_nullifierHash]) {
            revert Mixer__NullifierAlreadyUsed(_nullifierHash);
        }
        if (!isKnownRoot(_root)) {
            revert Mixer__UnknownRoot(_root);
        }

        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = _root;
        publicInputs[1] = _nullifierHash;
        publicInputs[2] = bytes32(uint256(uint160(address(_recipient))));
        if (!i_verifier.verify(_proof, publicInputs)) {
            revert Mixer__InvalidProof();
        }

        s_nullifierHashes[_nullifierHash] = true;
        (bool success, ) = _recipient.call{value: DEPOSIT_AMOUNT}("");
        if (!success) {
            revert Mixer__WithdrawFailed(_recipient);
        }

        emit Mixer__Withdraw(_recipient, _nullifierHash, block.timestamp);
    }
}
