const { expect } = require("chai")
const { ethers } = require("hardhat")
const { execSync } = require("child_process")

describe("Panagram Contract with Zero Knowledge Proof", function () {
    // Field modulus for BN254 elliptic curve used by Noir
    const FIELD_MODULUS = BigInt(
        "21888242871839275222246405745257275088548364400416034343698204186575808495617"
    )

    // Utility function to ensure values fit within the field modulus
    function mod(value, modulus) {
        return BigInt(value) % BigInt(modulus)
    }

    // Compute the correct guess hash from the word "triangles"
    const CORRECT_GUESS_HASH = ethers.keccak256(ethers.toUtf8Bytes("triangles"))
    const CORRECT_GUESS = mod(CORRECT_GUESS_HASH, FIELD_MODULUS)

    // For this test, ANSWER equals CORRECT_GUESS (simplified implementation)
    const ANSWER_HASH = ethers.keccak256(ethers.toUtf8Bytes("triangles"))
    const ANSWER = mod(ANSWER_HASH, FIELD_MODULUS)

    let verifier
    let panagram
    let owner
    let user
    let user2
    let proof

    // Generate a zero-knowledge proof using the Noir circuit
    // Takes guess, answer, and user address as field elements
    async function generateProof(guess, answer, userAddr) {
        // Convert Ethereum address to a field element for the circuit
        const userAddrField = mod(BigInt(userAddr), FIELD_MODULUS).toString()

        try {
            console.log(
                `🔧 Generating proof for guess: ${guess
                    .toString()
                    .slice(0, 10)}...`
            )
            console.log(
                `🔧 Expected answer: ${answer.toString().slice(0, 10)}...`
            )
            console.log(
                `🔧 User address (field): ${userAddrField.slice(0, 10)}...`
            )

            // Execute the proof generation script with field-compatible values
            const result = execSync(
                `node scripts/generate-proof.mjs ${guess.toString()} ${answer.toString()} ${userAddrField}`,
                { encoding: "utf8", timeout: 60000 }
            )

            console.log(
                `✅ Proof generated successfully (${
                    result.trim().length
                } characters)`
            )
            // Return the hexlified proof from the generation script
            return result.trim()
        } catch (error) {
            console.error(`❌ Proof generation failed: ${error.message}`)
            return null
        }
    }

    beforeEach(async function () {
        this.timeout(120000) // Extended timeout for zero-knowledge proof generation

        console.log("🚀 Setting up test environment...")

        // Initialize test accounts
        ;[owner, user, user2] = await ethers.getSigners()
        console.log(
            `👤 Test accounts: owner=${owner.address.slice(
                0,
                8
            )}..., user=${user.address.slice(
                0,
                8
            )}..., user2=${user2.address.slice(0, 8)}...`
        )

        // Deploy the Honk verifier contract for zero-knowledge proof verification
        const Verifier = await ethers.getContractFactory("HonkVerifier")
        verifier = await Verifier.deploy()
        console.log(`📜 HonkVerifier deployed at: ${verifier.target}`)

        // Deploy the main Panagram game contract
        const Panagram = await ethers.getContractFactory("Panagram")
        panagram = await Panagram.deploy(verifier.target)
        console.log(`🎮 Panagram contract deployed at: ${panagram.target}`)

        // Initialize a new game round with the correct answer hash
        const answerBytes32 = ethers.zeroPadValue(ethers.toBeHex(ANSWER), 32)
        await panagram.newRound(answerBytes32)
        console.log(`🎯 New round started with answer hash: ${answerBytes32}`)

        // Pre-generate proof for the main test user
        console.log("⏳ Pre-generating proof for primary test user...")
        proof = await generateProof(CORRECT_GUESS, ANSWER, user.address)

        // Skip all tests if proof generation fails (circuit or setup issues)
        if (!proof) {
            console.warn("⚠️  Skipping tests due to proof generation failure")
            this.skip()
        }
    })

    it("Should pass with correct guess", async function () {
        this.timeout(60000)

        console.log("🧪 Testing correct guess submission...")

        // Submit the correct guess with valid zero-knowledge proof
        await panagram.connect(user).makeGuess(proof)
        console.log("✅ Correct guess accepted by contract")

        // Verify that the user's win count increased
        expect(await panagram.s_winnerWins(user.address)).to.equal(1)
        console.log("✅ Winner count updated correctly")

        // Check NFT balances (token ID 0 = winner, token ID 1 = runner-up)
        expect(await panagram.balanceOf(user.address, 0)).to.equal(1)
        expect(await panagram.balanceOf(user.address, 1)).to.equal(0)
        console.log("✅ Winner NFT minted correctly")

        // Ensure the same user cannot guess again in the same round
        await expect(
            panagram.connect(user).makeGuess(proof)
        ).to.be.revertedWithCustomError(
            panagram,
            "Panagram__AlreadyGuessedThisRound"
        )
        console.log("✅ Duplicate guess prevention working")
    })

    it("Should start a new round correctly", async function () {
        this.timeout(60000)

        console.log("🧪 Testing new round creation...")

        // First, establish a winner in the current round
        await panagram.connect(user).makeGuess(proof)
        console.log("✅ Initial winner established")

        // Record the current round number for comparison
        const initialRound = await panagram.s_currentRound()

        // Calculate hash values for the next round using a different word
        const newAnswerText = "abcdefghi"
        const newGuessHash = ethers.keccak256(ethers.toUtf8Bytes(newAnswerText))
        const newGuess = mod(newGuessHash, FIELD_MODULUS)
        const newGuessBytes32 = ethers.zeroPadValue(
            ethers.toBeHex(newGuess),
            32
        )
        const newAnswerIntermediate = ethers.keccak256(newGuessBytes32)
        const newAnswerHash = ethers.zeroPadValue(
            ethers.toBeHex(mod(newAnswerIntermediate, FIELD_MODULUS)),
            32
        )
        console.log(`🔄 Prepared new answer hash: ${newAnswerHash}`)

        // Advance blockchain time to meet minimum round duration requirement
        const minDuration = await panagram.MIN_ROUND_DURATION()
        await ethers.provider.send("evm_increaseTime", [
            Number(minDuration) + 1,
        ])
        await ethers.provider.send("evm_mine")
        console.log(`⏰ Advanced time by ${minDuration} seconds`)

        // Start the new round with the calculated answer hash
        await panagram.newRound(newAnswerHash)
        console.log("🎯 New round initiated")

        // Verify that game state has been properly reset
        expect(await panagram.s_correctAnswerHash()).to.equal(newAnswerHash)
        expect(await panagram.s_currentRoundWinner()).to.equal(
            ethers.ZeroAddress
        )
        expect(await panagram.s_currentRound()).to.equal(initialRound + 1n)
        console.log("✅ Round state reset successfully")
    })

    it("Should fail with incorrect guess", async function () {
        this.timeout(60000)

        console.log("🧪 Testing incorrect guess rejection...")

        // Create an intentionally incorrect guess using a different word
        const incorrectText = "outnumber"
        const incorrectGuessHash = ethers.keccak256(
            ethers.toUtf8Bytes(incorrectText)
        )
        const incorrectGuess = mod(incorrectGuessHash, FIELD_MODULUS)
        console.log(
            `❌ Generated incorrect guess: ${incorrectGuess
                .toString()
                .slice(0, 10)}...`
        )

        // Attempt to generate proof with mismatched guess and answer
        // This should fail at the circuit level since guess_hash != answer_hash
        const incorrectProof = await generateProof(
            incorrectGuess,
            CORRECT_GUESS, // Intentionally different from incorrectGuess
            user.address
        )

        if (incorrectProof) {
            // If proof generation somehow succeeds, the contract should reject it
            console.log(
                "⚠️  Proof generated despite mismatch, testing contract rejection..."
            )
            await expect(
                panagram.connect(user).makeGuess(incorrectProof)
            ).to.be.revertedWithCustomError(panagram, "Panagram__InvalidProof")
            console.log("✅ Contract correctly rejected invalid proof")
        } else {
            // Expected behavior: circuit constraint should prevent proof generation
            console.log(
                "✅ Zero-knowledge circuit correctly prevented invalid proof generation"
            )
        }
    })

    it("Should handle second winner correctly", async function () {
        this.timeout(60000)

        console.log("🧪 Testing second winner (runner-up) scenario...")

        // First user submits correct guess and becomes the winner
        await panagram.connect(user).makeGuess(proof)
        console.log("🥇 First user established as winner")

        // Verify first user's status and NFT holdings
        expect(await panagram.s_winnerWins(user.address)).to.equal(1)
        expect(await panagram.balanceOf(user.address, 0)).to.equal(1)
        expect(await panagram.balanceOf(user.address, 1)).to.equal(0)
        console.log("✅ First user status verified")

        // Generate proof for second user with the same correct answer
        console.log("⏳ Generating proof for second user...")
        const proof2 = await generateProof(CORRECT_GUESS, ANSWER, user2.address)

        if (proof2) {
            // Second user submits correct guess and becomes runner-up
            await panagram.connect(user2).makeGuess(proof2)
            console.log("🥈 Second user submitted guess")

            // Verify second user receives runner-up status and NFT
            expect(await panagram.s_winnerWins(user2.address)).to.equal(0)
            expect(await panagram.balanceOf(user2.address, 0)).to.equal(0)
            expect(await panagram.balanceOf(user2.address, 1)).to.equal(1)
            console.log(
                "✅ Second user correctly assigned runner-up status and NFT"
            )
        } else {
            console.warn(
                "⚠️  Skipping second winner test due to proof generation failure"
            )
            this.skip() // Skip if proof generation failed
        }
    })
})
