fn main(guess_hash: Field, answer_hash: pub Field, prover_address: pub Field) {
    assert(prover_address != 0);
    assert(guess_hash == answer_hash);
}