# ZK Panagram Game

A decentralized word puzzle game using zero-knowledge proofs to verify correct answers without revealing them. Players compete to solve word puzzles while maintaining privacy through cryptographic proofs.

## Overview

The ZK Panagram game demonstrates practical zero-knowledge cryptography in a gaming context. Players submit proofs that they know the correct answer to a word puzzle without revealing the actual word or their guess. The first correct submission wins the round and receives a unique NFT.

## Architecture

### Components

-   **Noir Circuit** (`circuit/`): Zero-knowledge circuit that validates guesses
-   **Smart Contracts** (`contracts/`): Ethereum contracts managing game logic and verification
-   **Proof Generation** (`scripts/`): Tools for generating zero-knowledge proofs
-   **Tests** (`test/`): Comprehensive test suite

### Technology Stack

-   **Noir**: Zero-knowledge circuit development
-   **Aztec BB.js**: Ultra Honk proof system backend
-   **Solidity**: Smart contract implementation
-   **Hardhat**: Development and testing framework
-   **OpenZeppelin**: Secure contract templates (ERC1155, Ownable)

## Smart Contracts

### `contracts/Panagram.sol`

Main game contract handling:

-   Round management with configurable duration
-   Proof verification using Honk verifier
-   NFT rewards (winner vs participant tokens)
-   Player tracking and leaderboards

### `contracts/Verifier.sol`

Auto-generated Honk verifier contract that validates zero-knowledge proofs on-chain.

## Circuit Logic

The Noir circuit (`circuit/src/main.nr`) enforces:

```noir
fn main(guess_hash: Field, answer_hash: pub Field, prover_address: pub Field) {
    assert(prover_address != 0);           // Valid player address
    assert(guess_hash == answer_hash);     // Correct answer knowledge
}
```

## Getting Started

### Prerequisites

```bash
# Install Noir
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
noirup

# Install Barrentenberg Proving Backend
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
bbup

# Install Node.js dependencies
npm install
```

### Setup

1. **Compile the circuit:**

```bash
cd circuit
nargo compile
```

2. **Deploy contracts:**

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

3. **Run tests:**

```bash
npx hardhat test
```

## Usage

### Starting a New Round

Only the contract owner can start rounds:

```solidity
function newRound(bytes32 _correctAnswerHash) external onlyOwner
```

### Making a Guess

Players generate proofs and submit them:

```javascript
// Generate proof
const proof = await generateProof(guessHash, answerHash, playerAddress)

// Submit to contract
await panagram.makeGuess(proof)
```

### Proof Generation

Use the provided script to generate proofs:

```bash
node scripts/generate-proof.mjs <guessHash> <answerHash> <proverAddress>
```

## Game Mechanics

### Rewards

-   **Winner** (first correct guess): Special NFT (token ID 0) + increment win counter
-   **Participants** (subsequent correct guesses): Standard NFT (token ID 1)

### Round Rules

-   Minimum 1-day duration between rounds
-   Requires at least one winner before starting new round
-   Players can only guess once per round
-   All proofs verified on-chain

### Privacy Features

-   Actual guesses never revealed on-chain
-   Only proof verification results are public
-   Field element constraints ensure cryptographic security

## Testing

The test suite includes:

-   Proof generation and verification
-   Game state management
-   NFT minting and distribution
-   Access control and edge cases
-   Time-based round mechanics

Run comprehensive tests:

```bash
npx hardhat test --verbose
```

## Configuration

### Network Settings

Configured for high gas limits due to proof verification complexity:

```javascript
networks: {
    hardhat: {
        allowUnlimitedContractSize: true,
        gas: 100000000,
        blockGasLimit: 100000000
    }
}
```

### Field Constraints

All values must fit within BN254 field modulus:

```
21888242871839275222246405745257275088548364400416034343698204186575808495617
```

## Development

### Adding New Features

1. **Circuit Changes**: Modify `circuit/src/main.nr` and recompile
2. **Contract Updates**: Update Solidity contracts and regenerate verifier
3. **Proof Scripts**: Update generation scripts for new circuit parameters
4. **Tests**: Add corresponding test cases

### Debugging

-   Use `console.error()` in proof generation for debugging
-   Enable verbose logging in tests
-   Check field modulus constraints for proof failures

## Security Considerations

-   Verifier contract is auto-generated and immutable
-   Game owner controls round timing and answer hashes
-   All cryptographic operations use audited libraries
-   NFT metadata stored on IPFS for decentralization
