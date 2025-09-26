// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title AllWeatherPriceOracle
 * @notice Oracle contract to fetch real-time prices from Pyth Network for AllWeather ETF assets
 * @dev This contract handles price feeds for Gold (XAU), VOO ETF, and LQD Bond ETF
 */
contract AllWeatherPriceOracle {
    IPyth public immutable PYTH;
    
    // Price feed IDs for the 3 assets
    bytes32 public constant GOLD_PRICE_FEED_ID = 0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2; // XAU/USD
    bytes32 public constant VOO_PRICE_FEED_ID = 0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179; // VOO/USD
    bytes32 public constant LQD_PRICE_FEED_ID = 0xe4ff71a60c3d5d5d37c1bba559c2e92745c1501ebd81a97d150cf7cd5119aa9c; // LQD/USD
    
    /**
     * @notice Events
     */
    event PricesUpdated(PythStructs.Price[3] prices, uint256 timestamp);
    
    /**
     * @notice Initialize the oracle with Pyth contract address
     * @param _pythContract Address of the Pyth contract on the current network
     */
    constructor(address _pythContract) {
        require(_pythContract != address(0), "Invalid Pyth contract address");
        PYTH = IPyth(_pythContract);
    }
    
    /**
     * @notice Update price feeds and return current prices for all 3 assets
     * @param priceUpdateData Array of price update data from Hermes
     * @return prices Array of current raw Pyth prices [VOO, LQD, Gold]
     */
    function updateAndGetPrices(bytes[] calldata priceUpdateData) 
        external 
        payable 
        returns (PythStructs.Price[3] memory prices) 
    {
        // Calculate and pay the update fee
        uint256 fee = PYTH.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee for price update");
        
        // Update the price feeds
        PYTH.updatePriceFeeds{value: fee}(priceUpdateData);
        
        // Fetch current prices
        prices = getCurrentPrices();
        
        emit PricesUpdated(prices, block.timestamp);
        
        return prices;
    }
    
    /**
     * @notice Get current prices for all 3 assets without updating
     * @return prices Array of current raw Pyth prices [VOO, LQD, Gold]
     */
    function getCurrentPrices() public view returns (PythStructs.Price[3] memory prices) {
        // Get VOO price (S&P 500 ETF)
        prices[0] = PYTH.getPriceUnsafe(VOO_PRICE_FEED_ID);
        
        // Get LQD price (Bond ETF)
        prices[1] = PYTH.getPriceUnsafe(LQD_PRICE_FEED_ID);
        
        // Get Gold price
        prices[2] = PYTH.getPriceUnsafe(GOLD_PRICE_FEED_ID);
        
        return prices;
    }
    
    /**
     * @notice Get the fee required to update price feeds
     * @param priceUpdateData Array of price update data
     * @return fee The fee amount in wei
     */
    function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint256 fee) {
        return PYTH.getUpdateFee(priceUpdateData);
    }
    
    /**
     * @notice Get individual asset price by index
     * @param assetIndex Index of the asset (0=VOO, 1=LQD, 2=Gold)
     * @return price The current raw Pyth price
     */
    function getAssetPrice(uint256 assetIndex) external view returns (PythStructs.Price memory price) {
        require(assetIndex < 3, "Invalid asset index");
        
        bytes32 feedId;
        if (assetIndex == 0) feedId = VOO_PRICE_FEED_ID;
        else if (assetIndex == 1) feedId = LQD_PRICE_FEED_ID;
        else feedId = GOLD_PRICE_FEED_ID;
        
        return PYTH.getPriceUnsafe(feedId);
    }
}