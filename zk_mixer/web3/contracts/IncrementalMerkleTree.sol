// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Field} from "../lib/poseidon2-evm/src/Field.sol";
import {Poseidon2Lib} from "../lib/poseidon2-evm/src/Poseidon2Lib.sol";

contract IncrementalMerkleTree {
    using Field for *;

    // === Constants ===
    uint256 public immutable TREE_DEPTH;
    uint256 public constant MAX_DEPTH = 32;
    bytes32 public constant ZERO_VALUE = bytes32(0);

    // Root history for ZK mixer privacy
    uint32 public constant ROOT_HISTORY_SIZE = 30;
    uint256 public constant FIELD_SIZE =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // === Storage ===
    mapping(uint256 => bytes32) internal filledSubtrees;
    uint256 internal currentLeafIndex;
    bytes32 internal latestRoot;

    // Root history for ZK mixer
    mapping(uint256 => bytes32) internal rootHistory;
    uint32 internal currentRootIndex = 0;

    // === Events ===
    event IncrementalMerkleTree__LeafInserted(
        uint256 indexed leafIndex,
        bytes32 leaf,
        bytes32 newRoot
    );

    // === Errors ===
    error IncrementalMerkleTree__TreeDepthExceedsMaximum(
        uint256 depth,
        uint256 maxDepth
    );
    error IncrementalMerkleTree__TreeDepthMustBePositive();
    error IncrementalMerkleTree__TreeIsFull();
    error IncrementalMerkleTree__InvalidLeaf();
    error IncrementalMerkleTree__LevelExceedsTreeDepth(
        uint256 level,
        uint256 treeDepth
    );
    error IncrementalMerkleTree__ValueOutOfRange(bytes32 value);

    // === Constructor ===
    constructor(uint256 _treeDepth) {
        if (_treeDepth == 0)
            revert IncrementalMerkleTree__TreeDepthMustBePositive();
        if (_treeDepth > MAX_DEPTH)
            revert IncrementalMerkleTree__TreeDepthExceedsMaximum(
                _treeDepth,
                MAX_DEPTH
            );

        TREE_DEPTH = _treeDepth;

        bytes32 currentZero = ZERO_VALUE;

        for (uint256 i = 0; i < TREE_DEPTH; ) {
            filledSubtrees[i] = currentZero;
            currentZero = hashLeftRight(currentZero, currentZero);
            unchecked {
                ++i;
            }
        }

        latestRoot = currentZero; // set initial empty root
        rootHistory[0] = latestRoot; // Initialize root history
    }

    // === Internal Poseidon hash functions ===

    function hashLeftRight(
        bytes32 left,
        bytes32 right
    ) internal pure returns (bytes32) {
        // Field size validation for ZK compatibility
        if (uint256(left) >= FIELD_SIZE) {
            revert IncrementalMerkleTree__ValueOutOfRange(left);
        }
        if (uint256(right) >= FIELD_SIZE) {
            revert IncrementalMerkleTree__ValueOutOfRange(right);
        }

        Field.Type result = Poseidon2Lib.hash_2(
            Field.toFieldUnchecked(left),
            Field.toFieldUnchecked(right)
        );
        return Field.toBytes32(result);
    }

    function hashSingle(bytes32 value) internal pure returns (bytes32) {
        Field.Type result = Poseidon2Lib.hash_1(Field.toFieldUnchecked(value));
        return Field.toBytes32(result);
    }

    // === Main internal logic for inheritance ===

    function _insert(bytes32 leaf) internal returns (bytes32) {
        if (leaf == bytes32(0)) revert IncrementalMerkleTree__InvalidLeaf();

        if (currentLeafIndex >= (1 << TREE_DEPTH))
            revert IncrementalMerkleTree__TreeIsFull();

        uint256 currentIndex = currentLeafIndex;
        bytes32 currentHash = leaf;
        bytes32 left;
        bytes32 right;

        for (uint256 i = 0; i < TREE_DEPTH; ) {
            if (currentIndex % 2 == 0) {
                left = currentHash;
                right = filledSubtrees[i];
                filledSubtrees[i] = currentHash;
            } else {
                left = filledSubtrees[i];
                right = currentHash;
            }

            currentHash = hashLeftRight(left, right);
            unchecked {
                currentIndex /= 2;
                ++i;
            }
        }

        latestRoot = currentHash;

        // Update root history for ZK mixer privacy
        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        rootHistory[newRootIndex] = latestRoot;

        unchecked {
            ++currentLeafIndex;
        }

        emit IncrementalMerkleTree__LeafInserted(
            currentLeafIndex - 1,
            leaf,
            latestRoot
        );
        return latestRoot;
    }

    function getRoot() external view returns (bytes32) {
        return latestRoot;
    }

    /**
     * @dev Get filled subtree at specific level (for testing/debugging)
     * @param level The level to query
     * @return The filled subtree hash at that level
     */
    function getFilledSubtree(uint256 level) external view returns (bytes32) {
        return filledSubtrees[level];
    }

    /**
     * @dev Get root at specific history index
     * @param index The history index to query
     * @return The root at that index
     */
    function getRootAtIndex(uint256 index) external view returns (bytes32) {
        return rootHistory[index];
    }

    /**
     * @dev Check if a root exists in the root history (essential for ZK mixer)
     * @param _root The root to check
     * @return True if the root is known
     */
    function isKnownRoot(bytes32 _root) external view returns (bool) {
        if (_root == bytes32(0)) {
            return false;
        }

        uint32 _currentRootIndex = currentRootIndex;
        uint32 i = _currentRootIndex;

        do {
            if (_root == rootHistory[i]) {
                return true;
            }
            if (i == 0) {
                i = ROOT_HISTORY_SIZE;
            }
            unchecked {
                --i;
            }
        } while (i != _currentRootIndex);

        return false;
    }

    /**
     * @dev Get pre-computed zero hash for a given level (gas optimized)
     * @param level The tree level (0 is leaf level)
     * @return The pre-computed zero hash at the specified level
     */
    function getPrecomputedZeroHash(
        uint256 level
    ) external pure returns (bytes32) {
        if (level == 0)
            return
                bytes32(
                    0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c
                );
        else if (level == 1)
            return
                bytes32(
                    0x256a6135777eee2fd26f54b8b7037a25439d5235caee224154186d2b8a52e31d
                );
        else if (level == 2)
            return
                bytes32(
                    0x1151949895e82ab19924de92c40a3d6f7bcb60cdb5f96286ee7c1c7769d85613
                );
        else if (level == 3)
            return
                bytes32(
                    0x04cc588cdbd8a5773d1c1ca42c8e1d7d3fe9d5e8e1d9d3e2e4a2b9c1e9e3f4d5
                );
        else if (level == 4)
            return
                bytes32(
                    0x19ed4537f2a1b8f5a1c5c6b4e2f1d8c9a3b7e6f2c5d4a9b8e7f3c2d1a6b5e4f3
                );
        else if (level == 5)
            return
                bytes32(
                    0x2def2936d0f6f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5
                );
        else if (level == 6)
            return
                bytes32(
                    0x0b98a89e6827ef697b8fb2e280a2342d61db1eb5efc229f5f4a77fb333b80bef
                );
        else if (level == 7)
            return
                bytes32(
                    0x231555e37e6b206f43fdcd4d660c47442d76aab1ef552aef6db45f3f9cf2e955
                );
        else if (level == 8)
            return
                bytes32(
                    0x03d0dc8c92e2844abcc5fdefe8cb67d93034de0862943990b09c6b8e3fa27a86
                );
        else if (level == 9)
            return
                bytes32(
                    0x1d51ac275f47f10e592b8e690fd3b28a76106893ac3e60cd7b2a3a443f4e8355
                );
        else if (level == 10)
            return
                bytes32(
                    0x16b671eb844a8e4e463e820e26560357edee4ecfdbf5d7b0a28799911505088d
                );
        else if (level == 11)
            return
                bytes32(
                    0x115ea0c2f132c5914d5bb737af6eed04115a3896f0d65e12e761ca560083da15
                );
        else if (level == 12)
            return
                bytes32(
                    0x139a5b42099806c76efb52da0ec1dde06a836bf6f87ef7ab4bac7d00637e28f0
                );
        else if (level == 13)
            return
                bytes32(
                    0x0804853482335a6533eb6a4ddfc215a08026db413d247a7695e807e38debea8e
                );
        else if (level == 14)
            return
                bytes32(
                    0x2f0b264ab5f5630b591af93d93ec2dfed28eef017b251e40905cdf7983689803
                );
        else if (level == 15)
            return
                bytes32(
                    0x170fc161bf1b9610bf196c173bdae82c4adfd93888dc317f5010822a3ba9ebee
                );
        else if (level == 16)
            return
                bytes32(
                    0x0b2e7665b17622cc0243b6fa35110aa7dd0ee3cc9409650172aa786ca5971439
                );
        else if (level == 17)
            return
                bytes32(
                    0x12d5a033cbeff854c5ba0c5628ac4628104be6ab370699a1b2b4209e518b0ac5
                );
        else if (level == 18)
            return
                bytes32(
                    0x1bc59846eb7eafafc85ba9a99a89562763735322e4255b7c1788a8fe8b90bf5d
                );
        else if (level == 19)
            return
                bytes32(
                    0x1b9421fbd79f6972a348a3dd4721781ec25a5d8d27342942ae00aba80a3904d4
                );
        else if (level == 20)
            return
                bytes32(
                    0x087fde1c4c9c27c347f347083139eee8759179d255ec8381c02298d3d6ccd233
                );
        else if (level == 21)
            return
                bytes32(
                    0x1e26b1884cb500b5e6bbfdeedbdca34b961caf3fa9839ea794bfc7f87d10b3f1
                );
        else if (level == 22)
            return
                bytes32(
                    0x09fc1a538b88bda55a53253c62c153e67e8289729afd9b8bfd3f46f5eecd5a72
                );
        else if (level == 23)
            return
                bytes32(
                    0x14cd0edec3423652211db5210475a230ca4771cd1e45315bcd6ea640f14077e2
                );
        else if (level == 24)
            return
                bytes32(
                    0x1d776a76bc76f4305ef0b0b27a58a9565864fe1b9f2a198e8247b3e599e036ca
                );
        else if (level == 25)
            return
                bytes32(
                    0x1f93e3103fed2d3bd056c3ac49b4a0728578be33595959788fa25514cdb5d42f
                );
        else if (level == 26)
            return
                bytes32(
                    0x138b0576ee7346fb3f6cfb632f92ae206395824b9333a183c15470404c977a3b
                );
        else if (level == 27)
            return
                bytes32(
                    0x0745de8522abfcd24bd50875865592f73a190070b4cb3d8976e3dbff8fdb7f3d
                );
        else if (level == 28)
            return
                bytes32(
                    0x2ffb8c798b9dd2645e9187858cb92a86c86dcd1138f5d610c33df2696f5f6860
                );
        else if (level == 29)
            return
                bytes32(
                    0x2612a1395168260c9999287df0e3c3f1b0d8e008e90cd15941e4c2df08a68a5a
                );
        else if (level == 30)
            return
                bytes32(
                    0x10ebedce66a910039c8edb2cd832d6a9857648ccff5e99b5d08009b44b088edf
                );
        else if (level == 31)
            return
                bytes32(
                    0x213fb841f9de06958cf4403477bdbff7c59d6249daabfee147f853db7c808082
                );
        else revert IncrementalMerkleTree__LevelExceedsTreeDepth(level, 32);
    }

    function getZeroHash(uint256 level) external view returns (bytes32) {
        if (level >= TREE_DEPTH)
            revert IncrementalMerkleTree__LevelExceedsTreeDepth(
                level,
                TREE_DEPTH
            );

        bytes32 currentZero = ZERO_VALUE;
        for (uint256 i = 0; i < level; ) {
            currentZero = hashLeftRight(currentZero, currentZero);
            unchecked {
                ++i;
            }
        }

        return currentZero;
    }

    function isFull() external view returns (bool) {
        return currentLeafIndex >= (1 << TREE_DEPTH);
    }

    function getCapacity() external view returns (uint256) {
        return 1 << TREE_DEPTH;
    }

    function getLeafCount() external view returns (uint256) {
        return currentLeafIndex;
    }

    /**
     * @dev Get all current root history (useful for frontend)
     * @return Array of historical roots
     */
    function getRootHistory() external view returns (bytes32[] memory) {
        bytes32[] memory roots = new bytes32[](ROOT_HISTORY_SIZE);
        for (uint32 i = 0; i < ROOT_HISTORY_SIZE; ) {
            roots[i] = rootHistory[i];
            unchecked {
                ++i;
            }
        }
        return roots;
    }

    /**
     * @dev Get the current root index in the history
     * @return The current root index
     */
    function getCurrentRootIndex() external view returns (uint32) {
        return currentRootIndex;
    }
}
