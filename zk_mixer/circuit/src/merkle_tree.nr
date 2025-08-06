// Import Poseidon2 hash function from the poseidon library
use dep::poseidon::poseidon2;

/**
 * Computes the Merkle root given a leaf and its proof path
 * 
 * @param leaf - The leaf value we want to prove is in the tree
 * @param merkle_proof - Array of 20 sibling hashes along the path from leaf to root
 * @param is_even - Array of 20 booleans indicating if the current node is at an even position
 *                 - true: current node is left child (even position)
 *                 - false: current node is right child (odd position)
 * @return The computed Merkle root
 */
pub fn compute_merkle_root(leaf: Field, merkle_proof: [Field; 20], is_even: [bool; 20]) -> Field {
    // Start with the leaf as our current hash; it's a mutable variable
    let mut current_hash: Field = leaf;
    
    // Traverse up the tree level by level (20 levels for a tree of depth 20)
    for i in 0..20 {
        // Determine the order of hashing based on position
        let (left, right) = if is_even[i] {
            // If current position is even (left child):
            // current_hash goes on the left, sibling on the right
            (current_hash, merkle_proof[i])
        } else {
            // If current position is odd (right child):
            // sibling goes on the left, current_hash on the right
            (merkle_proof[i], current_hash)
        };
        
        // Hash the left and right values to get the parent hash
        // Using Poseidon2 with 2 inputs for cryptographic security
        current_hash = poseidon2::Poseidon2::hash([left, right], 2);
    }
    
    // After 20 iterations, we've reached the root
    current_hash
}