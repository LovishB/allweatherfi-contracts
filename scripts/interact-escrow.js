const { HermesClient } = require('@pythnetwork/hermes-client');
const { ethers } = require('ethers');

// Hardcoded configuration for Hedera Testnet
const PRIVATE_KEY = ""; // Without 0x prefix
const RPC_URL = "https://testnet.hashio.io/api";
const CONTRACT_ADDRESS = "0xb619f10d6b38227bbb0abf2787f7e2822d75a8aa"; // AllWeatherEscrow contract address

// AllWeatherEscrow Contract ABI
const ESCROW_CONTRACT_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "payable",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amountHbar",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256[4]",
                "name": "prices",
                "type": "uint256[4]"
            },
            {
                "indexed": false,
                "internalType": "uint256[3]",
                "name": "weights",
                "type": "uint256[3]"
            }
        ],
        "name": "BuyRequested",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "string",
                "name": "reason",
                "type": "string"
            }
        ],
        "name": "PriceUpdateFailed",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amountHbar",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256[4]",
                "name": "prices",
                "type": "uint256[4]"
            }
        ],
        "name": "SellRequested",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "payoutHbar",
                "type": "uint256"
            }
        ],
        "name": "WithdrawExecuted",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "bytes[]",
                "name": "priceUpdateData",
                "type": "bytes[]"
            },
            {
                "internalType": "uint256[3]",
                "name": "weights",
                "type": "uint256[3]"
            }
        ],
        "name": "buy",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAum",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "latestPrices",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "PRICE_ORACLE",
        "outputs": [
            {
                "internalType": "contract AllWeatherPriceOracle",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "amountHbar",
                "type": "uint256"
            },
            {
                "internalType": "bytes[]",
                "name": "priceUpdateData",
                "type": "bytes[]"
            }
        ],
        "name": "sell",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "payoutEth",
                "type": "uint256"
            }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    },
    {
        "stateMutability": "payable",
        "type": "fallback"
    }
];

// Price Oracle ABI (minimal, just for getting update fee)
const PRICE_ORACLE_ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes[]",
                "name": "priceUpdateData",
                "type": "bytes[]"
            }
        ],
        "name": "getUpdateFee",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "fee",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Asset information mapping
const ASSETS = {
    0: { name: 'VOO', description: 'Vanguard S&P 500 ETF' },
    1: { name: 'LQD', description: 'iShares iBoxx Investment Grade Corporate Bond ETF' },
    2: { name: 'Gold', description: 'Gold (XAU/USD)' },
    3: { name: 'HBAR', description: 'Hedera Hashgraph' }
};

// Price feed IDs from Pyth
const PRICE_FEED_IDS = [
    "0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179", // VOO/USD
    "0xe4ff71a60c3d5d5d37c1bba559c2e92745c1501ebd81a97d150cf7cd5119aa9c", // LQD/USD
    "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2", // XAU/USD (Gold)
    "0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd"  // HBAR/USD
];

class AllWeatherEscrowInteraction {
    constructor() {
        this.hermesClient = new HermesClient("https://hermes.pyth.network", {});
        this.provider = null;
        this.signer = null;
        this.escrowContract = null;
        this.priceOracleContract = null;
        this.contractAddress = CONTRACT_ADDRESS;
        
        this.initializeWeb3();
    }

    async initializeWeb3() {
        try {
            // Initialize provider with hardcoded RPC URL
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            
            // Initialize signer with hardcoded private key
            this.signer = new ethers.Wallet(PRIVATE_KEY, this.provider);
            console.log(`Wallet address: ${this.signer.address}`);
            
            // Initialize escrow contract
            this.escrowContract = new ethers.Contract(
                this.contractAddress, 
                ESCROW_CONTRACT_ABI, 
                this.signer
            );
            
            console.log(`Escrow Contract initialized at: ${this.contractAddress}`);
            console.log(`Connected to: ${RPC_URL}`);

            // Get price oracle address from escrow contract
            const priceOracleAddress = await this.escrowContract.PRICE_ORACLE();
            console.log(`Price Oracle address: ${priceOracleAddress}`);
            
            // Initialize price oracle contract for getting update fee
            this.priceOracleContract = new ethers.Contract(
                priceOracleAddress,
                PRICE_ORACLE_ABI,
                this.signer
            );
            
        } catch (error) {
            console.error("Failed to initialize Web3:", error.message);
            throw error;
        }
    }

    /**
     * Get latest price updates from Hermes
     */
    async getLatestPriceUpdates() {
        try {
            console.log("Fetching latest price updates from Hermes...");
            const priceUpdates = await this.hermesClient.getLatestPriceUpdates(PRICE_FEED_IDS);
            console.log(`Received ${priceUpdates.binary.data.length} price updates`);
            
            // Convert each price update to proper hex format for ethers.js
            const formattedUpdates = priceUpdates.binary.data.map(update => {
                // Ensure the update is in proper hex format
                if (update.startsWith('0x')) {
                    return update;
                }
                return '0x' + update;
            });
            
            return formattedUpdates;
        } catch (error) {
            console.error("Failed to fetch price updates:", error.message);
            throw error;
        }
    }

    /**
     * Buy ETF tokens with specified allocation weights
     * @param {string} ethAmount - Amount of ETH to send (in ETH, e.g., "0.1")
     * @param {Array} weights - Array of 3 weights [S&P, Bonds, Gold] that sum to 100
     */
    async buyETF(ethAmount, weights = [40, 40, 20]) {
        try {
            // Validate weights
            const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
            if (weightSum !== 100) {
                throw new Error(`Weights must sum to 100, got ${weightSum}`);
            }

            console.log(`\n=== Buy ETF ===`);
            console.log(`Amount: ${ethAmount} ETH`);
            console.log(`Allocation: S&P ${weights[0]}%, Bonds ${weights[1]}%, Gold ${weights[2]}%`);

            // Get latest price updates
            const priceUpdateData = await this.getLatestPriceUpdates();
            
            // Get update fee
            const updateFee = await this.priceOracleContract.getUpdateFee(priceUpdateData);
            console.log(`Price update fee: ${ethers.formatEther(updateFee)} ETH`);

            // Calculate total value to send (ETH amount + update fee)
            const ethValue = ethers.parseEther(ethAmount);
            const totalValue = ethValue + updateFee;
            
            console.log(`Total transaction value: ${ethers.formatEther(totalValue)} ETH`);

            // Check wallet balance
            const balance = await this.provider.getBalance(this.signer.address);
            console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
            
            if (balance < totalValue) {
                throw new Error("Insufficient wallet balance for transaction");
            }

            // Get gas estimation
            const gasLimit = await this.escrowContract.buy.estimateGas(priceUpdateData, weights, {
                value: totalValue
            });
            
            // Get current gas price
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice * BigInt(110) / BigInt(100); // 10% buffer
            
            console.log(`Estimated gas: ${gasLimit.toString()}`);
            console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            // Send buy transaction
            console.log("Sending buy transaction...");
            const tx = await this.escrowContract.buy(priceUpdateData, weights, {
                value: totalValue,
                gasLimit: gasLimit,
                gasPrice: gasPrice
            });
            
            console.log(`Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            console.log("Waiting for transaction confirmation...");
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);
            
            // Parse events
            const buyRequestedEvent = receipt.logs.find(log => {
                try {
                    const parsed = this.escrowContract.interface.parseLog(log);
                    return parsed.name === 'BuyRequested';
                } catch (e) {
                    return false;
                }
            });
            
            if (buyRequestedEvent) {
                const parsed = this.escrowContract.interface.parseLog(buyRequestedEvent);
                console.log(`\n=== Buy Request Details ===`);
                console.log(`User: ${parsed.args.user}`);
                console.log(`Amount: ${ethers.formatEther(parsed.args.amountHbar)} ETH`);
                console.log(`Prices: [${parsed.args.prices.map(p => p.toString()).join(', ')}]`);
                console.log(`Weights: [${parsed.args.weights.map(w => w.toString()).join(', ')}]%`);
            }
            
            return { tx, receipt };
        } catch (error) {
            console.error("Failed to buy ETF:", error.message);
            throw error;
        }
    }

    /**
     * Sell ETF tokens
     * @param {string} tokenAmount - Amount of tokens to sell (in HBAR/ETH units)
     */
    async sellETF(tokenAmount) {
        try {
            console.log(`\n=== Sell ETF ===`);
            console.log(`Token amount: ${tokenAmount} HBAR`);

            // Get latest price updates
            const priceUpdateData = await this.getLatestPriceUpdates();
            
            // Get update fee
            const updateFee = await this.priceOracleContract.getUpdateFee(priceUpdateData);
            console.log(`Price update fee: ${ethers.formatEther(updateFee)} ETH`);

            // Check wallet balance for update fee
            const balance = await this.provider.getBalance(this.signer.address);
            console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
            
            if (balance < updateFee) {
                throw new Error("Insufficient wallet balance for price update fee");
            }

            // Convert token amount to wei
            const tokenAmountWei = ethers.parseEther(tokenAmount);

            // Get gas estimation
            const gasLimit = await this.escrowContract.sell.estimateGas(tokenAmountWei, priceUpdateData, {
                value: updateFee
            });
            
            // Get current gas price
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice * BigInt(110) / BigInt(100); // 10% buffer
            
            console.log(`Estimated gas: ${gasLimit.toString()}`);
            console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            // Send sell transaction
            console.log("Sending sell transaction...");
            const tx = await this.escrowContract.sell(tokenAmountWei, priceUpdateData, {
                value: updateFee,
                gasLimit: gasLimit,
                gasPrice: gasPrice
            });
            
            console.log(`Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            console.log("Waiting for transaction confirmation...");
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);
            
            // Parse events
            const sellRequestedEvent = receipt.logs.find(log => {
                try {
                    const parsed = this.escrowContract.interface.parseLog(log);
                    return parsed.name === 'SellRequested';
                } catch (e) {
                    return false;
                }
            });
            
            if (sellRequestedEvent) {
                const parsed = this.escrowContract.interface.parseLog(sellRequestedEvent);
                console.log(`\n=== Sell Request Details ===`);
                console.log(`User: ${parsed.args.user}`);
                console.log(`Token Amount: ${ethers.formatEther(parsed.args.amountHbar)} HBAR`);
                console.log(`Prices: [${parsed.args.prices.map(p => p.toString()).join(', ')}]`);
            }
            
            return { tx, receipt };
        } catch (error) {
            console.error("Failed to sell ETF:", error.message);
            throw error;
        }
    }

    /**
     * Owner withdraws ETH to pay user (only owner can call this)
     * @param {string} userAddress - Address of the user to pay
     * @param {string} payoutAmount - Amount of ETH to send (in ETH, e.g., "0.1")
     */
    async withdraw(userAddress, payoutAmount) {
        try {
            console.log(`\n=== Withdraw ===`);
            console.log(`User: ${userAddress}`);
            console.log(`Payout: ${payoutAmount} ETH`);

            const payoutWei = ethers.parseEther(payoutAmount);

            // Check if current signer is the owner
            const owner = await this.escrowContract.owner();
            if (this.signer.address.toLowerCase() !== owner.toLowerCase()) {
                throw new Error(`Only owner can withdraw. Owner: ${owner}, Current signer: ${this.signer.address}`);
            }

            // Check contract balance
            const contractBalance = await this.escrowContract.getAum();
            console.log(`Contract balance: ${ethers.formatEther(contractBalance)} ETH`);
            
            if (contractBalance < payoutWei) {
                throw new Error("Insufficient contract balance for withdrawal");
            }

            // Get gas estimation
            const gasLimit = await this.escrowContract.withdraw.estimateGas(userAddress, payoutWei);
            
            // Get current gas price
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice * BigInt(110) / BigInt(100); // 10% buffer
            
            console.log(`Estimated gas: ${gasLimit.toString()}`);
            console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            // Send withdraw transaction
            console.log("Sending withdraw transaction...");
            const tx = await this.escrowContract.withdraw(userAddress, payoutWei, {
                gasLimit: gasLimit,
                gasPrice: gasPrice
            });
            
            console.log(`Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            console.log("Waiting for transaction confirmation...");
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);
            
            // Parse events
            const withdrawEvent = receipt.logs.find(log => {
                try {
                    const parsed = this.escrowContract.interface.parseLog(log);
                    return parsed.name === 'WithdrawExecuted';
                } catch (e) {
                    return false;
                }
            });
            
            if (withdrawEvent) {
                const parsed = this.escrowContract.interface.parseLog(withdrawEvent);
                console.log(`\n=== Withdraw Details ===`);
                console.log(`User: ${parsed.args.user}`);
                console.log(`Payout: ${ethers.formatEther(parsed.args.payoutHbar)} ETH`);
            }
            
            return { tx, receipt };
        } catch (error) {
            console.error("Failed to withdraw:", error.message);
            throw error;
        }
    }

    /**
     * Get contract information
     */
    async getContractInfo() {
        try {
            console.log(`\n=== Contract Information ===`);
            
            const owner = await this.escrowContract.owner();
            const priceOracle = await this.escrowContract.PRICE_ORACLE();
            const aum = await this.escrowContract.getAum();
            
            console.log(`Contract Address: ${this.contractAddress}`);
            console.log(`Owner: ${owner}`);
            console.log(`Price Oracle: ${priceOracle}`);
            console.log(`Assets Under Management: ${ethers.formatEther(aum)} ETH`);
            
            // Get latest prices
            console.log(`\nLatest Prices:`);
            for (let i = 0; i < 4; i++) {
                try {
                    const price = await this.escrowContract.latestPrices(i);
                    const asset = ASSETS[i];
                    console.log(`  ${asset.name}: ${price.toString()}`);
                } catch (e) {
                    console.log(`  Asset ${i}: Unable to fetch price`);
                }
            }
            
            return { owner, priceOracle, aum };
        } catch (error) {
            console.error("Failed to get contract info:", error.message);
            throw error;
        }
    }

    /**
     * Send ETH to contract (for topping up balance for price updates)
     * @param {string} amount - Amount of ETH to send (e.g., "0.1")
     */
    async topUpContract(amount) {
        try {
            console.log(`\n=== Top Up Contract ===`);
            console.log(`Amount: ${amount} ETH`);

            const amountWei = ethers.parseEther(amount);
            
            // Check wallet balance
            const balance = await this.provider.getBalance(this.signer.address);
            console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
            
            if (balance < amountWei) {
                throw new Error("Insufficient wallet balance");
            }

            // Send ETH to contract
            console.log("Sending ETH to contract...");
            const tx = await this.signer.sendTransaction({
                to: this.contractAddress,
                value: amountWei
            });
            
            console.log(`Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
            
            // Check new contract balance
            const newBalance = await this.escrowContract.getAum();
            console.log(`New contract balance: ${ethers.formatEther(newBalance)} ETH`);
            
            return { tx, receipt };
        } catch (error) {
            console.error("Failed to top up contract:", error.message);
            throw error;
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    // Handle help command without initialization
    if (command === 'help' || !command) {
        console.log("AllWeather Escrow Contract CLI");
        console.log("\nUsage: node interact-escrow.js <command> [args]");
        console.log("\nCommands:");
        console.log("  buy <eth_amount> [s&p_weight] [bond_weight] [gold_weight]");
        console.log("    - Buy ETF with specified ETH amount and allocation weights");
        console.log("    - Example: buy 0.1 40 40 20 (invests 0.1 ETH with 40% S&P, 40% bonds, 20% gold)");
        console.log("    - Default weights: 40% S&P, 40% bonds, 20% gold");
        console.log("");
        console.log("  sell <token_amount>");
        console.log("    - Sell ETF tokens");
        console.log("    - Example: sell 1000 (sells 1000 token units)");
        console.log("");
        console.log("  withdraw <user_address> <payout_amount>");
        console.log("    - Owner withdraws ETH to pay user (owner only)");
        console.log("    - Example: withdraw 0x123...abc 0.05");
        console.log("");
        console.log("  info           - Get contract information");
        console.log("  topup <amount> - Send ETH to contract for price updates");
        console.log("  help           - Show this help message");
        console.log("");
        console.log("Configuration:");
        console.log(`  RPC URL: ${RPC_URL}`);
        console.log(`  Contract: ${CONTRACT_ADDRESS}`);
        console.log(`  Wallet: Configured with hardcoded private key`);
        return;
    }
    
    try {
        const escrow = new AllWeatherEscrowInteraction();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for initialization
        
        switch (command) {
            case 'buy':
                const ethAmount = args[1];
                if (!ethAmount) {
                    console.error("Please provide ETH amount to buy");
                    process.exit(1);
                }
                
                const spWeight = parseInt(args[2]) || 40;
                const bondWeight = parseInt(args[3]) || 40;
                const goldWeight = parseInt(args[4]) || 20;
                
                await escrow.buyETF(ethAmount, [spWeight, bondWeight, goldWeight]);
                break;
                
            case 'sell':
                const tokenAmount = args[1];
                if (!tokenAmount) {
                    console.error("Please provide token amount to sell");
                    process.exit(1);
                }
                await escrow.sellETF(tokenAmount);
                break;
                
            case 'withdraw':
                const userAddress = args[1];
                const payoutAmount = args[2];
                if (!userAddress || !payoutAmount) {
                    console.error("Please provide user address and payout amount");
                    process.exit(1);
                }
                await escrow.withdraw(userAddress, payoutAmount);
                break;
                
            case 'info':
                await escrow.getContractInfo();
                break;
                
            case 'topup':
                const topupAmount = args[1];
                if (!topupAmount) {
                    console.error("Please provide amount to top up");
                    process.exit(1);
                }
                await escrow.topUpContract(topupAmount);
                break;
                
            default:
                console.error("Unknown command. Use 'help' to see available commands.");
                process.exit(1);
        }
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

// Export the class for use in other scripts
module.exports = AllWeatherEscrowInteraction;

// Run CLI if this file is executed directly
if (require.main === module) {
    main();
}
