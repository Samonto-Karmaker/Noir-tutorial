use dep::keccak256;

fn main(guess_hash: Field, answer_double_hash: pub Field, prover_address: pub Field) {
    let guess_hash_decomposed: [u8; 32] = guess_hash.to_be_bytes();
    let guess_double_hash_decomposed: [u8; 32] = keccak256::keccak256(guess_hash_decomposed, 32);
    let guess_double_hash = Field::from_be_bytes(guess_double_hash_decomposed);

    assert(prover_address != 0);
    assert(guess_double_hash == answer_double_hash);
}