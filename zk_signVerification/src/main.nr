/// Verifies that a signature was created by the owner of an Ethereum address
/// @param pub_key_x - The x-coordinate of the public key
/// @param pub_key_y - The y-coordinate of the public key
/// @param signature - The 64-byte signature (r and s concatenated)
/// @param hashed_message - The 32-byte hash of the message that was signed
/// @param expected_address - The Ethereum address that should have created the signature

use dep::ecrecover;

fn main(
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
    signature: [u8; 64],
    hashed_message: pub [u8; 32],
    expected_address: pub Field
) {
    let address = ecrecover::ecrecover(
        pub_key_x,
        pub_key_y,
        signature,
        hashed_message
    );

    assert(address == expected_address, "Address does not match expected address");
}
