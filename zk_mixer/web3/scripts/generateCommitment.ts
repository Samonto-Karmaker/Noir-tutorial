import { Barretenberg, Fr } from "@aztec/bb.js"

// Commitment data structure for better type safety
export interface CommitmentData {
    commitment: string
    nullifier: string
    secret: string
    nullifierHash: string
}

// Utility function to generate commitment for ZK mixer
export async function generateCommitment(): Promise<CommitmentData> {
    // Initialize Barretenberg
    const bb = await Barretenberg.new()

    try {
        // 1. Generate random nullifier
        const nullifier = Fr.random()

        // 2. Generate random secret
        const secret = Fr.random()

        // 3. Create commitment using Poseidon2 hash
        const commitment: Fr = await bb.poseidon2Hash([nullifier, secret])

        // 4. Generate nullifier hash (for public input in withdrawal)
        const nullifierHash: Fr = await bb.poseidon2Hash([nullifier])

        // Return structured data as hex strings for easy use in tests
        return {
            commitment: `0x${Buffer.from(commitment.toBuffer()).toString(
                "hex"
            )}`,
            nullifier: `0x${Buffer.from(nullifier.toBuffer()).toString("hex")}`,
            secret: `0x${Buffer.from(secret.toBuffer()).toString("hex")}`,
            nullifierHash: `0x${Buffer.from(nullifierHash.toBuffer()).toString(
                "hex"
            )}`,
        }
    } finally {
        // Clean up Barretenberg instance
        await bb.destroy()
    }
}

// Helper function to create commitment from existing nullifier and secret
export async function createCommitmentFromValues(
    nullifierHex: string,
    secretHex: string
): Promise<CommitmentData> {
    const bb = await Barretenberg.new()

    try {
        // Convert hex strings to Fr elements
        const nullifier = new Fr(Buffer.from(nullifierHex.slice(2), "hex"))
        const secret = new Fr(Buffer.from(secretHex.slice(2), "hex"))

        // Create commitment and nullifier hash
        const commitment: Fr = await bb.poseidon2Hash([nullifier, secret])
        const nullifierHash: Fr = await bb.poseidon2Hash([nullifier])

        return {
            commitment: `0x${Buffer.from(commitment.toBuffer()).toString(
                "hex"
            )}`,
            nullifier: nullifierHex,
            secret: secretHex,
            nullifierHash: `0x${Buffer.from(nullifierHash.toBuffer()).toString(
                "hex"
            )}`,
        }
    } finally {
        await bb.destroy()
    }
}
