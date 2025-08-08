import { Barretenberg, Fr, UltraHonkBackend } from "@aztec/bb.js"
import { Noir } from "@noir-lang/noir_js"
import path from "path"
import fs from "fs"

// @ts-ignore - JavaScript module without TypeScript declarations
import { merkleTree } from "./merkleTree.js"

// Load the compiled Noir circuit
const circuit = JSON.parse(
    fs.readFileSync(
        path.resolve(__dirname, "../../circuit/target/circuit.json"),
        "utf8"
    )
)

/**
 * Simple proof generation script
 * Usage: generateProof(nullifier, secret, recipient, allCommitments)
 */
export async function generateProof(
    nullifier: string,
    secret: string,
    recipient: string,
    allCommitments: string[]
): Promise<{ proof: Uint8Array; hexProof: string }> {
    const bb = await Barretenberg.new()

    try {
        // Convert inputs to Fr elements
        const nullifierFr = new Fr(
            Buffer.from(nullifier.replace("0x", ""), "hex")
        )
        const secretFr = new Fr(Buffer.from(secret.replace("0x", ""), "hex"))

        // Generate commitment and nullifier hash
        const commitment = await bb.poseidon2Hash([nullifierFr, secretFr])
        const nullifierHash = await bb.poseidon2Hash([nullifierFr])

        const commitmentHex = `0x${Buffer.from(commitment.toBuffer()).toString(
            "hex"
        )}`

        // Create merkle tree and find commitment
        const tree = await merkleTree(allCommitments)
        const commitmentIndex = tree.getIndex(commitmentHex)

        if (commitmentIndex === -1) {
            throw new Error(`Commitment ${commitmentHex} not found in tree`)
        }

        // Generate merkle proof
        const merkleProof = tree.proof(commitmentIndex)

        // Prepare circuit inputs
        const circuitInputs = {
            root: merkleProof.root,
            nullifier_hash: nullifierHash.toString(),
            recipient: recipient.replace("0x", ""),
            nullifier: nullifierFr.toString(),
            secret: secretFr.toString(),
            merkle_proof: merkleProof.pathElements.map((e: any) =>
                e.toString()
            ),
            is_even: merkleProof.pathIndices.map((i: any) => i % 2 === 0),
        }
        console.log("Circuit inputs:", circuitInputs)

        // Generate proof
        const noir = new Noir(circuit)
        const honk = new UltraHonkBackend(circuit.bytecode, { threads: 1 })

        const { witness } = await noir.execute(circuitInputs)
        const { proof } = await honk.generateProof(witness, {
            keccak: true,
        })

        const hexProof = `0x${Buffer.from(proof).toString("hex")}`
        console.error("Proof length:", proof.length)

        return { proof, hexProof }
    } finally {
        await bb.destroy()
    }
}

// CLI usage
async function main() {
    const args = process.argv.slice(2)

    if (args.length < 4) {
        console.log(
            "Usage: node simpleGenerateProof.js <nullifier> <secret> <recipient> <commitment1> [commitment2] ..."
        )
        process.exit(1)
    }

    const [nullifier, secret, recipient, ...commitments] = args

    try {
        const result = await generateProof(
            nullifier,
            secret,
            recipient,
            commitments
        )
        console.log("Generated proof (raw):", result.proof)
        console.log("Generated proof (hex):", result.hexProof)
    } catch (error) {
        console.error("Error:", error)
        process.exit(1)
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error("Error:", error)
        process.exit(1)
    })
}
