require("@nomicfoundation/hardhat-toolbox")

module.exports = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
            gas: 100000000,
            blockGasLimit: 100000000,
            gasPrice: 1000000000, // Changed from 1 to 1 Gwei (1,000,000,000)
            // Alternative approach using EIP-1559 gas settings:
            initialBaseFeePerGas: 0, // Set initial base fee to zero
        },
    },
}
