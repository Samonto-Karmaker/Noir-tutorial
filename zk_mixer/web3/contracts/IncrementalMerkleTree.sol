// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract IncrementalMerkleTree {
    uint256 public immutable TREE_DEPTH;
    uint256 public constant MAX_DEPTH = 32;

    // Hash of "Merkle" as zero value
    uint256 public constant ZERO_VALUE = uint256(keccak256("Merkle"));

    // Storage for the rightmost path of the tree
    mapping(uint256 => uint256) public filledSubtrees;

    // Current number of leaves in the tree
    uint256 public currentLeafIndex;

    // Events
    event LeafInserted(
        uint256 indexed leafIndex,
        uint256 leaf,
        uint256 newRoot
    );

    // Errors
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

    constructor(uint256 _treeDepth) {
        if (_treeDepth == 0) {
            revert IncrementalMerkleTree__TreeDepthMustBePositive();
        }
        if (_treeDepth > MAX_DEPTH) {
            revert IncrementalMerkleTree__TreeDepthExceedsMaximum(
                _treeDepth,
                MAX_DEPTH
            );
        }

        TREE_DEPTH = _treeDepth;

        // Initialize the zero hashes for each level
        // Level 0: leaf level with ZERO_VALUE
        // Level 1: hash(ZERO_VALUE, ZERO_VALUE)
        // Level 2: hash(level1_zero, level1_zero), etc.
        uint256 currentZero = ZERO_VALUE;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = currentZero;
            currentZero = hashLeftRight(currentZero, currentZero);
        }
    }

    /**
     * @dev Hash function for internal nodes
     * @param left Left child hash
     * @param right Right child hash
     * @return Hash of the two children
     */
    function hashLeftRight(
        uint256 left,
        uint256 right
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(left, right)));
    }

    /**
     * @dev Insert a new leaf into the tree
     * @param leaf The leaf value to insert
     * @return The new root hash after insertion
     */
    function insert(uint256 leaf) external returns (uint256) {
        if (leaf == 0) {
            revert IncrementalMerkleTree__InvalidLeaf();
        }

        if (currentLeafIndex >= 2 ** TREE_DEPTH) {
            revert IncrementalMerkleTree__TreeIsFull();
        }

        uint256 currentIndex = currentLeafIndex;
        uint256 currentLevelHash = leaf;
        uint256 left;
        uint256 right;

        // Update the tree level by level
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                // Current node is a left child
                left = currentLevelHash;
                right = filledSubtrees[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                // Current node is a right child
                left = filledSubtrees[i];
                right = currentLevelHash;
            }

            currentLevelHash = hashLeftRight(left, right);
            currentIndex = currentIndex / 2;
        }

        uint256 newRoot = currentLevelHash;
        currentLeafIndex++;

        emit LeafInserted(currentLeafIndex - 1, leaf, newRoot);

        return newRoot;
    }

    /**
     * @dev Get the current root of the tree
     * @return The current root hash
     */
    function getRoot() external view returns (uint256) {
        uint256 currentIndex = currentLeafIndex;
        uint256 currentLevelHash = filledSubtrees[0];

        // If tree is empty, return the zero hash at the root level
        if (currentLeafIndex == 0) {
            return filledSubtrees[TREE_DEPTH - 1];
        }

        // Reconstruct the path to the root
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                // We're on the left, so we hash with the right subtree
                currentLevelHash = hashLeftRight(
                    currentLevelHash,
                    filledSubtrees[i]
                );
            } else {
                // We're on the right, so we hash with the left subtree
                currentLevelHash = hashLeftRight(
                    filledSubtrees[i],
                    currentLevelHash
                );
            }
            currentIndex = currentIndex / 2;

            if (currentIndex == 0) {
                break;
            }
        }

        return currentLevelHash;
    }

    /**
     * @dev Get the zero hash at a specific level
     * @param level The tree level (0 is leaf level)
     * @return The zero hash at the specified level
     */
    function getZeroHash(uint256 level) external view returns (uint256) {
        if (level >= TREE_DEPTH) {
            revert IncrementalMerkleTree__LevelExceedsTreeDepth(
                level,
                TREE_DEPTH
            );
        }

        uint256 currentZero = ZERO_VALUE;
        for (uint256 i = 0; i < level; i++) {
            currentZero = hashLeftRight(currentZero, currentZero);
        }

        return currentZero;
    }

    /**
     * @dev Check if the tree is full
     * @return True if the tree cannot accept more leaves
     */
    function isFull() external view returns (bool) {
        return currentLeafIndex >= 2 ** TREE_DEPTH;
    }

    /**
     * @dev Get the maximum number of leaves the tree can hold
     * @return The maximum capacity
     */
    function getCapacity() external view returns (uint256) {
        return 2 ** TREE_DEPTH;
    }

    /**
     * @dev Get the number of leaves currently in the tree
     * @return The current number of leaves
     */
    function getLeafCount() external view returns (uint256) {
        return currentLeafIndex;
    }
}
