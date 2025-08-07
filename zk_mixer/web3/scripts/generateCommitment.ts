import { Barretenberg, Fr } from "@aztec/bb.js"

// BN254 field modulus - ensures all generated values are within the valid field range
// This is critical for ZK circuits as values outside this range would cause proof failures
const FIELD_MODULUS = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
)

// Enhanced commitment data structure with both Solidity and Noir compatible formats
export interface CommitmentData {
    // Solidity-compatible hex strings (with 0x prefix) for contract interactions
    commitment: string
    nullifier: string
    secret: string
    nullifierHash: string
    // Noir-compatible hex strings (without 0x prefix) for circuit inputs
    commitmentField: string
    nullifierField: string
    secretField: string
    nullifierHashField: string
}

/**
 * Validates that a field element is within the BN254 curve modulus
 * This prevents circuit failures by ensuring all values are valid field elements
 * @param value - The Fr element to validate
 * @returns true if valid, false otherwise
 */
function validateFieldElement(value: Fr): boolean {
    const valueBigInt = BigInt(
        `0x${Buffer.from(value.toBuffer()).toString("hex")}`
    )
    return valueBigInt < FIELD_MODULUS
}

/**
 * Validates that a commitment is not zero (required by IncrementalMerkleTree)
 * Zero commitments are rejected by the tree's _insert function
 * @param commitment - The commitment hex string to validate
 * @returns true if valid (non-zero), false otherwise
 */
function validateCommitmentForTree(commitment: string): boolean {
    return (
        commitment !==
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    )
}

/**
 * Converts Fr element to both Solidity and Noir compatible formats
 * @param value - Fr element to convert
 * @returns object with both hex formats
 */
function formatFieldElement(value: Fr): { solidity: string; noir: string } {
    const hex = Buffer.from(value.toBuffer()).toString("hex")
    return {
        solidity: `0x${hex}`, // With 0x prefix for Solidity contracts
        noir: hex, // Without 0x prefix for Noir circuits
    }
}

// Utility function to generate commitment for ZK mixer
export async function generateCommitment(): Promise<CommitmentData> {
    // Initialize Barretenberg
    const bb = await Barretenberg.new()

    try {
        let nullifier!: Fr, secret!: Fr, commitment!: Fr, nullifierHash!: Fr
        let attempts = 0
        const maxAttempts = 10

        // Retry loop to ensure we generate valid field elements and non-zero commitment
        // This prevents edge cases where random generation creates invalid values
        do {
            if (attempts >= maxAttempts) {
                throw new Error(
                    "Failed to generate valid commitment after maximum attempts"
                )
            }

            // 1. Generate random nullifier
            nullifier = Fr.random()

            // 2. Generate random secret
            secret = Fr.random()

            // Validate that generated values are within field modulus
            // This prevents ZK circuit failures due to invalid field elements
            if (
                !validateFieldElement(nullifier) ||
                !validateFieldElement(secret)
            ) {
                attempts++
                continue
            }

            // 3. Create commitment using Poseidon2 hash
            commitment = await bb.poseidon2Hash([nullifier, secret])

            // 4. Generate nullifier hash (for public input in withdrawal)
            nullifierHash = await bb.poseidon2Hash([nullifier])

            // Check if commitment is valid for tree insertion (non-zero)
            const commitmentHex = `0x${Buffer.from(
                commitment.toBuffer()
            ).toString("hex")}`
            if (validateCommitmentForTree(commitmentHex)) {
                break // Valid commitment found, exit loop
            }

            attempts++
        } while (attempts < maxAttempts)

        // Format all values for both Solidity and Noir compatibility
        const commitmentFormatted = formatFieldElement(commitment)
        const nullifierFormatted = formatFieldElement(nullifier)
        const secretFormatted = formatFieldElement(secret)
        const nullifierHashFormatted = formatFieldElement(nullifierHash)

        // Return structured data with both format types for maximum compatibility
        return {
            // Solidity format (with 0x prefix) for contract interactions
            commitment: commitmentFormatted.solidity,
            nullifier: nullifierFormatted.solidity,
            secret: secretFormatted.solidity,
            nullifierHash: nullifierHashFormatted.solidity,
            // Noir format (without 0x prefix) for circuit inputs
            commitmentField: commitmentFormatted.noir,
            nullifierField: nullifierFormatted.noir,
            secretField: secretFormatted.noir,
            nullifierHashField: nullifierHashFormatted.noir,
        }
    } finally {
        // Clean up Barretenberg instance
        await bb.destroy()
    }
}

// Helper function to create commitment from existing nullifier and secret
// Useful for testing scenarios where you need to recreate specific commitments
export async function createCommitmentFromValues(
    nullifierHex: string,
    secretHex: string
): Promise<CommitmentData> {
    const bb = await Barretenberg.new()

    try {
        // Convert hex strings to Fr elements (remove 0x prefix if present)
        const nullifier = new Fr(Buffer.from(nullifierHex.slice(2), "hex"))
        const secret = new Fr(Buffer.from(secretHex.slice(2), "hex"))

        // Validate input field elements are within valid range
        if (!validateFieldElement(nullifier) || !validateFieldElement(secret)) {
            throw new Error("Input values exceed field modulus")
        }

        // Create commitment and nullifier hash using same logic as generateCommitment
        const commitment: Fr = await bb.poseidon2Hash([nullifier, secret])
        const nullifierHash: Fr = await bb.poseidon2Hash([nullifier])

        // Validate the resulting commitment is valid for tree insertion
        const commitmentHex = `0x${Buffer.from(commitment.toBuffer()).toString(
            "hex"
        )}`
        if (!validateCommitmentForTree(commitmentHex)) {
            throw new Error(
                "Generated commitment is zero, invalid for tree insertion"
            )
        }

        // Format all values for both Solidity and Noir compatibility
        const commitmentFormatted = formatFieldElement(commitment)
        const nullifierFormatted = formatFieldElement(nullifier)
        const secretFormatted = formatFieldElement(secret)
        const nullifierHashFormatted = formatFieldElement(nullifierHash)

        return {
            // Solidity format (with 0x prefix) for contract interactions
            commitment: commitmentFormatted.solidity,
            nullifier: nullifierFormatted.solidity,
            secret: secretFormatted.solidity,
            nullifierHash: nullifierHashFormatted.solidity,
            // Noir format (without 0x prefix) for circuit inputs
            commitmentField: commitmentFormatted.noir,
            nullifierField: nullifierFormatted.noir,
            secretField: secretFormatted.noir,
            nullifierHashField: nullifierHashFormatted.noir,
        }
    } finally {
        await bb.destroy()
    }
}

// Additional utility functions for ZK mixer testing and integration

/**
 * Converts Solidity format (0x prefix) to Noir format (no prefix)
 * @param solidityHex - Hex string with 0x prefix
 * @returns Hex string without 0x prefix for Noir circuits
 */
export function toNoirFormat(solidityHex: string): string {
    return solidityHex.startsWith("0x") ? solidityHex.slice(2) : solidityHex
}

/**
 * Converts Noir format (no prefix) to Solidity format (0x prefix)
 * @param noirHex - Hex string without 0x prefix
 * @returns Hex string with 0x prefix for Solidity contracts
 */
export function toSolidityFormat(noirHex: string): string {
    return noirHex.startsWith("0x") ? noirHex : `0x${noirHex}`
}

/**
 * Validates that all commitment data is properly formatted and within field bounds
 * @param data - CommitmentData to validate
 * @returns true if all values are valid
 */
export function validateCommitmentData(data: CommitmentData): boolean {
    try {
        // Check all values are valid hex strings
        const values = [
            data.commitment,
            data.nullifier,
            data.secret,
            data.nullifierHash,
        ]
        for (const value of values) {
            if (!value.startsWith("0x") || value.length !== 66) {
                return false
            }
            const bigIntValue = BigInt(value)
            if (bigIntValue >= FIELD_MODULUS) {
                return false
            }
        }

        // Check commitment is not zero (required by tree)
        return validateCommitmentForTree(data.commitment)
    } catch {
        return false
    }
}

// Hardhat script execution support
// Allows this script to be run directly with `npx hardhat run scripts/generateCommitment.ts`
// while still being importable as a module in tests
async function main() {
    if (require.main === module) {
        console.log("🔄 Generating commitment for ZK mixer...")
        try {
            const data = await generateCommitment()
            console.log("✅ Generated commitment data:")
            console.log("📝 Solidity format (for contracts):")
            console.log(`   Commitment: ${data.commitment}`)
            console.log(`   Nullifier: ${data.nullifier}`)
            console.log(`   Secret: ${data.secret}`)
            console.log(`   Nullifier Hash: ${data.nullifierHash}`)
            console.log("🔧 Noir format (for circuits):")
            console.log(`   Commitment: ${data.commitmentField}`)
            console.log(`   Nullifier: ${data.nullifierField}`)
            console.log(`   Secret: ${data.secretField}`)
            console.log(`   Nullifier Hash: ${data.nullifierHashField}`)
        } catch (error) {
            console.error("❌ Error generating commitment:", error)
            process.exit(1)
        }
    }
}

// Execute main function if script is run directly
main().catch(console.error)
