#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { ethers } from "ethers"
import { Noir } from "@noir-lang/noir_js"
import { UltraHonkBackend } from "@aztec/bb.js"
import { fileURLToPath } from "url"

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
    const [guessHashHex, answerHashHex, proverAddressDec] =
        process.argv.slice(2)
    if (!guessHashHex || !answerHashHex || !proverAddressDec) {
        console.error(
            "Usage: generate-proof <guessHash> <answerHash> <proverAddress>"
        )
        process.exit(1)
    }

    // load your compiled Noir circuit
    const circuitPath = path.resolve(
        __dirname,
        "../../circuit/target/zk_panagram.json"
    )
    const circuit = JSON.parse(fs.readFileSync(circuitPath, "utf8"))

    const input = {
        guess_hash: guessHashHex,
        answer_hash: answerHashHex,
        prover_address: proverAddressDec,
    }
    console.error("Field inputs:", input)

    const noir = new Noir(circuit)
    const { witness } = await noir.execute(input)

    const honk = new UltraHonkBackend(circuit.bytecode, { threads: 1 })
    const { proof } = await honk.generateProof(witness, {
        keccak: true,
    })

    const hexProof = ethers.hexlify(proof)

    console.error("Proof length:", proof.length)
    process.stdout.write(hexProof)
}
main().catch((err) => {
    console.error(err)
    process.exit(1)
})
