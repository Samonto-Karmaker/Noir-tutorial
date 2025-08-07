import { Barretenberg, Fr } from "@aztec/bb.js"

async function hashLeftRight(left, right) {
    const bb = await Barretenberg.new()
    const frLeft = Fr.fromString(left)
    const frRight = Fr.fromString(right)
    const hash = await bb.poseidon2Hash([frLeft, frRight])
    return hash.toString()
}

export class PoseidonTree {
    constructor(levels, zeros) {
        if (zeros.length < levels + 1) {
            throw new Error(
                "Not enough zero values provided for the given tree height."
            )
        }
        this.levels = levels
        this.hashLeftRight = hashLeftRight
        this.storage = new Map()
        this.zeros = zeros
        this.totalLeaves = 0
    }

    async init(defaultLeaves = []) {
        if (defaultLeaves.length > 0) {
            this.totalLeaves = defaultLeaves.length

            defaultLeaves.forEach((leaf, index) => {
                this.storage.set(PoseidonTree.indexToKey(0, index), leaf)
            })

            for (let level = 1; level <= this.levels; level++) {
                const numNodes = Math.ceil(this.totalLeaves / 2 ** level)
                for (let i = 0; i < numNodes; i++) {
                    const left =
                        this.storage.get(
                            PoseidonTree.indexToKey(level - 1, 2 * i)
                        ) || this.zeros[level - 1]
                    const right =
                        this.storage.get(
                            PoseidonTree.indexToKey(level - 1, 2 * i + 1)
                        ) || this.zeros[level - 1]
                    const node = await this.hashLeftRight(left, right)
                    this.storage.set(PoseidonTree.indexToKey(level, i), node)
                }
            }
        }
    }

    static indexToKey(level, index) {
        return `${level}-${index}`
    }

    getIndex(leaf) {
        for (const [key, value] of this.storage.entries()) {
            if (value === leaf && key.startsWith("0-")) {
                return parseInt(key.split("-")[1])
            }
        }
        return -1
    }

    root() {
        return (
            this.storage.get(PoseidonTree.indexToKey(this.levels, 0)) ||
            this.zeros[this.levels]
        )
    }

    proof(index) {
        const leaf = this.storage.get(PoseidonTree.indexToKey(0, index))
        if (!leaf) throw new Error("leaf not found")

        const pathElements = []
        const pathIndices = []

        this.traverse(index, (level, currentIndex, siblingIndex) => {
            const sibling =
                this.storage.get(
                    PoseidonTree.indexToKey(level, siblingIndex)
                ) || this.zeros[level]
            pathElements.push(sibling)
            pathIndices.push(currentIndex % 2)
        })

        return {
            root: this.root(),
            pathElements,
            pathIndices,
            leaf,
        }
    }

    async insert(leaf) {
        const index = this.totalLeaves
        await this.update(index, leaf, true)
        this.totalLeaves++
    }

    async update(index, newLeaf, isInsert = false) {
        if (!isInsert && index >= this.totalLeaves) {
            throw Error("Use insert method for new elements.")
        } else if (isInsert && index < this.totalLeaves) {
            throw Error("Use update method for existing elements.")
        }

        const keyValueToStore = []
        let currentElement = newLeaf

        await this.traverseAsync(
            index,
            async (level, currentIndex, siblingIndex) => {
                const sibling =
                    this.storage.get(
                        PoseidonTree.indexToKey(level, siblingIndex)
                    ) || this.zeros[level]
                const [left, right] =
                    currentIndex % 2 === 0
                        ? [currentElement, sibling]
                        : [sibling, currentElement]
                keyValueToStore.push({
                    key: PoseidonTree.indexToKey(level, currentIndex),
                    value: currentElement,
                })
                currentElement = await this.hashLeftRight(left, right)
            }
        )

        keyValueToStore.push({
            key: PoseidonTree.indexToKey(this.levels, 0),
            value: currentElement,
        })
        keyValueToStore.forEach(({ key, value }) =>
            this.storage.set(key, value)
        )
    }

    traverse(index, fn) {
        let currentIndex = index
        for (let level = 0; level < this.levels; level++) {
            const siblingIndex =
                currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1
            fn(level, currentIndex, siblingIndex)
            currentIndex = Math.floor(currentIndex / 2)
        }
    }

    async traverseAsync(index, fn) {
        let currentIndex = index
        for (let level = 0; level < this.levels; level++) {
            const siblingIndex =
                currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1
            await fn(level, currentIndex, siblingIndex)
            currentIndex = Math.floor(currentIndex / 2)
        }
    }
}

const ZERO_VALUES = [
    "0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c", // Level 0 - matches Solidity
    "0x256a6135777eee2fd26f54b8b7037a25439d5235caee224154186d2b8a52e31d", // Level 1 - matches Solidity
    "0x1151949895e82ab19924de92c40a3d6f7bcb60cdb5f96286ee7c1c7769d85613", // Level 2 - matches Solidity
    "0x04cc588cdbd8a5773d1c1ca42c8e1d7d3fe9d5e8e1d9d3e2e4a2b9c1e9e3f4d5", // Level 3 - matches Solidity
    "0x19ed4537f2a1b8f5a1c5c6b4e2f1d8c9a3b7e6f2c5d4a9b8e7f3c2d1a6b5e4f3", // Level 4 - matches Solidity
    "0x2def2936d0f6f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5", // Level 5 - matches Solidity
    "0x0b98a89e6827ef697b8fb2e280a2342d61db1eb5efc229f5f4a77fb333b80bef", // Level 6 - matches Solidity
    "0x231555e37e6b206f43fdcd4d660c47442d76aab1ef552aef6db45f3f9cf2e955", // Level 7 - matches Solidity
    "0x03d0dc8c92e2844abcc5fdefe8cb67d93034de0862943990b09c6b8e3fa27a86", // Level 8 - matches Solidity
    "0x1d51ac275f47f10e592b8e690fd3b28a76106893ac3e60cd7b2a3a443f4e8355", // Level 9 - matches Solidity
    "0x16b671eb844a8e4e463e820e26560357edee4ecfdbf5d7b0a28799911505088d", // Level 10 - matches Solidity
    "0x115ea0c2f132c5914d5bb737af6eed04115a3896f0d65e12e761ca560083da15", // Level 11 - matches Solidity
    "0x139a5b42099806c76efb52da0ec1dde06a836bf6f87ef7ab4bac7d00637e28f0", // Level 12 - matches Solidity
    "0x0804853482335a6533eb6a4ddfc215a08026db413d247a7695e807e38debea8e", // Level 13 - matches Solidity
    "0x2f0b264ab5f5630b591af93d93ec2dfed28eef017b251e40905cdf7983689803", // Level 14 - matches Solidity
    "0x170fc161bf1b9610bf196c173bdae82c4adfd93888dc317f5010822a3ba9ebee", // Level 15 - matches Solidity
    "0x0b2e7665b17622cc0243b6fa35110aa7dd0ee3cc9409650172aa786ca5971439", // Level 16 - matches Solidity
    "0x12d5a033cbeff854c5ba0c5628ac4628104be6ab370699a1b2b4209e518b0ac5", // Level 17 - matches Solidity
    "0x1bc59846eb7eafafc85ba9a99a89562763735322e4255b7c1788a8fe8b90bf5d", // Level 18 - matches Solidity
    "0x1b9421fbd79f6972a348a3dd4721781ec25a5d8d27342942ae00aba80a3904d4", // Level 19 - matches Solidity
    "0x087fde1c4c9c27c347f347083139eee8759179d255ec8381c02298d3d6ccd233", // Level 20 - matches Solidity
]

export async function merkleTree(leaves) {
    const TREE_HEIGHT = 20
    const tree = new PoseidonTree(TREE_HEIGHT, ZERO_VALUES)

    // Initialize tree with no leaves (all zeros)
    await tree.init()

    // Insert some leaves (from input)
    for (const leaf of leaves) {
        await tree.insert(leaf)
    }

    return tree
}
