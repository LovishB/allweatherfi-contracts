const { HermesClient } = require('@pythnetwork/hermes-client');
const { ethers } = require('ethers');

// Hardcoded configuration for Hedera Testnet
const PRIVATE_KEY = ""; // Without 0x prefix
const RPC_URL = "https://testnet.hashio.io/api";
const CONTRACT_ADDRESS = "0x4d02570931b579056fc058f947ec7e8e2be4ee59";

// Contract ABI (only including the functions we need)
const CONTRACT_ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes[]",
                "name": "priceUpdateData",
                "type": "bytes[]"
            }
        ],
        "name": "updateAndGetPrices",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "int64",
                        "name": "price",
                        "type": "int64"
                    },
                    {
                        "internalType": "uint64",
                        "name": "conf",
                        "type": "uint64"
                    },
                    {
                        "internalType": "int32",
                        "name": "expo",
                        "type": "int32"
                    },
                    {
                        "internalType": "uint256",
                        "name": "publishTime",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct PythStructs.Price[4]",
                "name": "prices",
                "type": "tuple[4]"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getCurrentPrices",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "int64",
                        "name": "price",
                        "type": "int64"
                    },
                    {
                        "internalType": "uint64",
                        "name": "conf",
                        "type": "uint64"
                    },
                    {
                        "internalType": "int32",
                        "name": "expo",
                        "type": "int32"
                    },
                    {
                        "internalType": "uint256",
                        "name": "publishTime",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct PythStructs.Price[4]",
                "name": "prices",
                "type": "tuple[4]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
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
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "assetIndex",
                "type": "uint256"
            }
        ],
        "name": "getAssetPrice",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "int64",
                        "name": "price",
                        "type": "int64"
                    },
                    {
                        "internalType": "uint64",
                        "name": "conf",
                        "type": "uint64"
                    },
                    {
                        "internalType": "int32",
                        "name": "expo",
                        "type": "int32"
                    },
                    {
                        "internalType": "uint256",
                        "name": "publishTime",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct PythStructs.Price",
                "name": "price",
                "type": "tuple"
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

// Price feed IDs from the contract
const PRICE_FEED_IDS = [
    "0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179", // VOO/USD
    "0xe4ff71a60c3d5d5d37c1bba559c2e92745c1501ebd81a97d150cf7cd5119aa9c", // LQD/USD
    "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2", // XAU/USD (Gold)
    "0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd"  // HBAR/USD
];

class AllWeatherPriceOracle {
    constructor() {
        this.hermesClient = new HermesClient("https://hermes.pyth.network", {});
        this.provider = null;
        this.signer = null;
        this.contract = null;
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
            
            // Initialize contract
            this.contract = new ethers.Contract(
                this.contractAddress, 
                CONTRACT_ABI, 
                this.signer
            );
            
            console.log(`Contract initialized at: ${this.contractAddress}`);
            console.log(`Connected to: ${RPC_URL}`);
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
                // Ensure it's a proper hex string
                if (typeof update === 'string') {
                    return update.startsWith('0x') ? update : '0x' + update;
                } else if (update instanceof Uint8Array) {
                    return '0x' + Array.from(update).map(b => b.toString(16).padStart(2, '0')).join('');
                }
                return update;
            });
            
            return formattedUpdates;
        } catch (error) {
            console.error("Failed to fetch price updates:", error.message);
            throw error;
        }
    }

    /**
     * Get current prices from the contract (read-only)
     */
    async getCurrentPrices() {
        try {
            console.log("Fetching current prices from contract...");
            const prices = await this.contract.getCurrentPrices();
            
            this.displayPrices(prices, "Current Contract Prices");
            return prices;
        } catch (error) {
            console.error("Failed to get current prices:", error.message);
            throw error;
        }
    }

    /**
     * Get individual asset price by index
     */
    async getAssetPrice(assetIndex) {
        try {
            if (assetIndex < 0 || assetIndex > 3) {
                throw new Error("Asset index must be between 0 and 3");
            }
            
            console.log(`Fetching price for asset ${ASSETS[assetIndex].name}...`);
            const price = await this.contract.getAssetPrice(assetIndex);
            
            console.log(`\n${ASSETS[assetIndex].name} (${ASSETS[assetIndex].description}) Price:`);
            this.displaySinglePrice(price, assetIndex);
            
            return price;
        } catch (error) {
            console.error(`Failed to get asset price for index ${assetIndex}:`, error.message);
            throw error;
        }
    }

    /**
     * Update price feeds and get updated prices
     */
    async updateAndGetPrices() {
        try {
            // Get latest price update data
            const priceUpdateData = await this.getLatestPriceUpdates();
            
            // Get the required fee
            console.log("Calculating update fee...");
            const pythFee = await this.contract.getUpdateFee(priceUpdateData);
            console.log(`Pyth update fee: ${ethers.formatEther(pythFee)} ETH`);
            
            // Hedera requires minimum 1 tinybar (10^10 wei) for non-zero value transactions
            const minHederaValue = BigInt("10000000000"); // 1 tinybar in wei
            const fee = pythFee > minHederaValue ? pythFee : minHederaValue;
            console.log(`Using transaction value: ${ethers.formatEther(fee)} ETH (${ethers.formatUnits(fee, 'gwei')} gwei)`);
            
            // Check wallet balance
            const balance = await this.provider.getBalance(this.signer.address);
            console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
            
            if (balance < fee) {
                throw new Error("Insufficient balance to pay for price update");
            }
            
            // Send transaction to update prices
            console.log("Updating price feeds...");
            
            // Get gas price from network
            console.log("Fetching current gas price from network...");
            const feeData = await this.provider.getFeeData();
            const networkGasPrice = feeData.gasPrice;
            
            // Use network gas price with a small buffer for faster confirmation
            const gasPrice = networkGasPrice * BigInt(110) / BigInt(100); // 10% buffer for faster confirmation
            
            console.log(`Network gas price: ${ethers.formatUnits(networkGasPrice, 'gwei')} gwei`);
            console.log(`Using gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
            
            // Estimate gas limit for the transaction
            console.log("Estimating gas limit...");
            let gasLimit;
            try {
                const estimatedGas = await this.contract.updateAndGetPrices.estimateGas(priceUpdateData, { value: fee });
                gasLimit = estimatedGas * BigInt(120) / BigInt(100); // 20% buffer for safety
                console.log(`Estimated gas: ${estimatedGas.toString()}`);
                console.log(`Using gas limit: ${gasLimit.toString()}`);
            } catch (gasEstimationError) {
                console.warn("Gas estimation failed, using fallback:", gasEstimationError.message);
                gasLimit = BigInt(500000); // Fallback gas limit
                console.log(`Using fallback gas limit: ${gasLimit}`);
            }
            
            const txOptions = {
                value: fee,
                gasLimit: gasLimit,
                gasPrice: gasPrice
            };
            
            const tx = await this.contract.updateAndGetPrices(priceUpdateData, txOptions);
            console.log(`Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            console.log("Waiting for transaction confirmation...");
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);
            
            // Parse the updated prices from the transaction receipt
            const prices = await this.contract.getCurrentPrices();
            this.displayPrices(prices, "Updated Prices");
            
            return { prices, receipt };
        } catch (error) {
            console.error("Failed to update prices:", error.message);
            throw error;
        }
    }

    /**
     * Get network information including gas prices and fee data
     */
    async getNetworkInfo() {
        try {
            console.log("Fetching network information...");
            
            // Get fee data (includes gas prices for EIP-1559 and legacy)
            const feeData = await this.provider.getFeeData();
            
            // Get network details
            const network = await this.provider.getNetwork();
            
            // Get latest block for context
            const block = await this.provider.getBlock('latest');
            
            console.log("\n=== Network Information ===");
            console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`Latest Block: ${block.number}`);
            console.log(`Block Gas Limit: ${block.gasLimit.toString()}`);
            console.log(`Block Gas Used: ${block.gasUsed.toString()} (${(Number(block.gasUsed) / Number(block.gasLimit) * 100).toFixed(2)}%)`);
            
            if (feeData.gasPrice) {
                console.log(`Gas Price (Legacy): ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
            }
            
            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                console.log(`Max Fee Per Gas (EIP-1559): ${ethers.formatUnits(feeData.maxFeePerGas, 'gwei')} gwei`);
                console.log(`Max Priority Fee Per Gas (EIP-1559): ${ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} gwei`);
            }
            
            return { feeData, network, block };
        } catch (error) {
            console.error("Failed to get network info:", error.message);
            throw error;
        }
    }

    /**
     * Get update fee for price feeds
     */
    async getUpdateFee() {
        try {
            const priceUpdateData = await this.getLatestPriceUpdates();
            const fee = await this.contract.getUpdateFee(priceUpdateData);
            console.log(`Current update fee: ${ethers.formatEther(fee)} ETH`);
            return fee;
        } catch (error) {
            console.error("Failed to get update fee:", error.message);
            throw error;
        }
    }

    /**
     * Display formatted price information
     */
    displayPrices(prices, title = "Prices") {
        console.log(`\n=== ${title} ===`);
        prices.forEach((price, index) => {
            this.displaySinglePrice(price, index);
        });
    }

    /**
     * Display a single price with formatting
     */
    displaySinglePrice(price, index) {
        const asset = ASSETS[index];
        const formattedPrice = this.formatPrice(price.price, price.expo);
        const confidence = this.formatPrice(price.conf, price.expo);
        const publishTime = new Date(Number(price.publishTime) * 1000).toISOString();
        
        console.log(`${asset.name} (${asset.description}):`);
        console.log(`  Price: $${formattedPrice}`);
        console.log(`  Confidence: ±$${confidence}`);
        console.log(`  Published: ${publishTime}`);
        console.log('');
    }

    /**
     * Format price with proper decimals based on exponent
     */
    formatPrice(price, expo) {
        const decimals = Math.abs(Number(expo));
        const formattedPrice = (Number(price) / Math.pow(10, decimals)).toFixed(decimals > 6 ? 6 : decimals);
        return formattedPrice;
    }

    /**
     * Get price feeds information for all assets
     */
    async getPriceFeedsInfo() {
        try {
            console.log("Fetching price feeds information...");
            
            // Get price feeds for each asset
            const priceFeeds = [];
            for (let i = 0; i < PRICE_FEED_IDS.length; i++) {
                try {
                    // Use getPriceFeeds method instead of getPriceFeed
                    const feedsInfo = await this.hermesClient.getPriceFeeds();
                    const feedInfo = feedsInfo.find(feed => feed.id === PRICE_FEED_IDS[i]);
                    
                    priceFeeds.push({
                        asset: ASSETS[i],
                        feedId: PRICE_FEED_IDS[i],
                        info: feedInfo || { id: PRICE_FEED_IDS[i], attributes: { symbol: 'Unknown' } }
                    });
                } catch (error) {
                    console.warn(`Failed to get price feed info for ${ASSETS[i].name}:`, error.message);
                    // Add fallback info
                    priceFeeds.push({
                        asset: ASSETS[i],
                        feedId: PRICE_FEED_IDS[i],
                        info: { id: PRICE_FEED_IDS[i], attributes: { symbol: 'Unknown' } }
                    });
                }
            }
            
            // Display price feeds information
            console.log("\n=== Price Feeds Information ===");
            priceFeeds.forEach(feed => {
                console.log(`${feed.asset.name}:`);
                console.log(`  Feed ID: ${feed.feedId}`);
                console.log(`  Symbol: ${feed.info.attributes?.symbol || feed.info.id || 'N/A'}`);
                console.log('');
            });
            
            return priceFeeds;
        } catch (error) {
            console.error("Failed to get price feeds info:", error.message);
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
        console.log("AllWeather Price Oracle CLI");
        console.log("\nUsage: node interact.js <command> [args]");
        console.log("\nCommands:");
        console.log("  current          - Get current prices from contract");
        console.log("  update           - Update price feeds and get new prices");
        console.log("  asset <index>    - Get price for specific asset (0-3)");
        console.log("  fee              - Get current update fee");
        console.log("  info             - Get price feeds information");
        console.log("  network          - Get network information and gas prices");
        console.log("  help             - Show this help message");
        console.log("\nAsset Indices:");
        Object.entries(ASSETS).forEach(([index, asset]) => {
            console.log(`  ${index}: ${asset.name} - ${asset.description}`);
        });
        console.log("\nConfiguration:");
        console.log(`  RPC URL: ${RPC_URL}`);
        console.log(`  Contract: ${CONTRACT_ADDRESS}`);
        console.log(`  Wallet: Configured with hardcoded private key`);
        return;
    }
    
    try {
        const oracle = new AllWeatherPriceOracle();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for initialization
        
        switch (command) {
            case 'current':
                await oracle.getCurrentPrices();
                break;
                
            case 'update':
                await oracle.updateAndGetPrices();
                break;
                
            case 'asset':
                const assetIndex = parseInt(args[1]);
                if (isNaN(assetIndex)) {
                    console.error("Please provide asset index (0-3)");
                    console.log("0: VOO, 1: LQD, 2: Gold, 3: HBAR");
                    return;
                }
                await oracle.getAssetPrice(assetIndex);
                break;
                
            case 'fee':
                await oracle.getUpdateFee();
                break;
                
            case 'info':
                await oracle.getPriceFeedsInfo();
                break;
                
            case 'network':
                await oracle.getNetworkInfo();
                break;
                
            default:
                console.log(`Unknown command: ${command}`);
                console.log("Use 'node interact.js help' for available commands");
                break;
        }
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

// Export the class for use in other scripts
module.exports = AllWeatherPriceOracle;

// Run CLI if this file is executed directly
if (require.main === module) {
    main();
}