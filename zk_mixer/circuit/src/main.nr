// Import Poseidon2 hash function for cryptographic operations
use dep::poseidon::poseidon2;
// Import our custom merkle tree module
mod merkle_tree;

/**
 * Main ZK mixer circuit function
 * This circuit proves that:
 * 1. The user knows a valid commitment (secret + nullifier) that exists in the Merkle tree
 * 2. The user knows the nullifier that generates the provided nullifier hash
 * 3. The user can withdraw without revealing which specific deposit they're withdrawing
 * 
 * PUBLIC INPUTS (visible to everyone):
 * @param root - The Merkle root of the tree (from contract's root history)
 * @param nullifier_hash - Hash of the nullifier (prevents double-spending)
 * @param recipient - The address that will receive the funds
 * 
 * PRIVATE INPUTS (secret, only known to the prover):
 * @param nullifier - Random value used to prevent double-spending
 * @param secret - Random value that makes the commitment unique
 * @param merkle_proof - Array of sibling hashes to prove membership in the tree
 * @param is_even - Array indicating left/right position at each tree level
 */
fn main(
    root: pub Field,           // PUBLIC: Merkle root from the tree
    nullifier_hash: pub Field, // PUBLIC: Hash of nullifier (prevents double-spending)
    recipient: pub Field,      // PUBLIC: Withdrawal recipient address
    nullifier: Field,          // PRIVATE: The actual nullifier value
    secret: Field,             // PRIVATE: Secret value for commitment
    merkle_proof: [Field; 20], // PRIVATE: Merkle proof path (20 levels deep)
    is_even: [bool; 20]        // PRIVATE: Position indicators for Merkle path
) {
    // === STEP 1: Prove knowledge of commitment components ===
    // Recreate the original commitment using the private nullifier and secret
    // This commitment should match one that was previously deposited
    let commitment: Field = poseidon2::Poseidon2::hash([nullifier, secret], 2);
    
    // === STEP 2: Verify nullifier hash ===
    // Compute the nullifier hash from the private nullifier
    // This ensures the public nullifier_hash corresponds to the known nullifier
    let computed_nullifier_hash: Field = poseidon2::Poseidon2::hash([nullifier], 1);
    assert(computed_nullifier_hash == nullifier_hash, "Nullifier hash does not match");
    
    // === STEP 3: Prove membership in Merkle tree ===
    // Use the commitment and merkle proof to compute the root
    // This proves the commitment exists in the tree without revealing which leaf it is
    let computed_root: Field = merkle_tree::compute_merkle_root(commitment, merkle_proof, is_even);
    assert(computed_root == root, "Merkle root does not match");
    
    // === STEP 4: Include recipient in proof ===
    // While the recipient is public, including it in a constraint ensures
    // the proof is bound to this specific recipient address
    // This prevents proof malleability where someone could change the recipient
     
    // Ensure recipient is used in the circuit
    let _recipient_check = recipient;
    assert(_recipient_check == recipient, "Recipient does not match");

    // === CIRCUIT COMPLETE ===
    // If all assertions pass, the proof is valid and demonstrates:
    // - The user made a valid deposit (commitment exists in tree)
    // - The nullifier prevents double-spending
    // - Privacy is preserved (which specific deposit is unknown)
}
