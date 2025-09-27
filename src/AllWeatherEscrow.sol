// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {AllWeatherPriceOracle} from "./AllWeatherPriceOracle.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract AllWeatherEscrow {
    /** 
    State Variables
    */
    uint256[4] public latestPrices;
    address public owner;
    AllWeatherPriceOracle public immutable PRICE_ORACLE;

    /**
    Events
    */
    event BuyRequested(address indexed user, uint256 amountHbar, uint256[4] prices, uint256[3] weights);
    event SellRequested(address indexed user, uint256 amountHbar, uint256[4] prices);
    event WithdrawExecuted(address indexed user, uint256 payoutHbar);
    event PriceUpdateFailed(string reason);

    /**
    Modifiers
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address payable _priceOracle) {
        require(_priceOracle != address(0), "Invalid price oracle address");
        owner = msg.sender;
        PRICE_ORACLE = AllWeatherPriceOracle(_priceOracle);
    }

    /**
    Functions
    */

    /**
     * @notice User buys ETF by sending ETH. Updates prices from Pyth and emits BuyRequested event
     * @param priceUpdateData Price update data from Hermes for Pyth price feeds
     * @param weights Array of 3 uint256 representing allocation weights for [S&P, Bonds, Gold] - must sum to 100
     */
    function buy(bytes[] calldata priceUpdateData, uint256[3] calldata weights) external payable {
        require(msg.value > 0, "Must send ETH to buy");
        
        // Validate weights sum to 100
        uint256 sum = weights[0] + weights[1] + weights[2];
        require(sum == 100, "Weights must sum to 100");
        
        // Get the fee required for price update
        uint256 updateFee = PRICE_ORACLE.getUpdateFee(priceUpdateData);
        require(address(this).balance >= updateFee, "Insufficient contract balance for price update");
        
        // Update prices through the oracle
        PythStructs.Price[4] memory prices;
        try PRICE_ORACLE.updateAndGetPrices(priceUpdateData) returns (PythStructs.Price[4] memory updatedPrices) {
            prices = updatedPrices;
            // Store the raw price values for compatibility with events
            for (uint i = 0; i < 4; i++) {
                latestPrices[i] = uint256(uint64(prices[i].price));
            }
        } catch Error(string memory reason) {
            emit PriceUpdateFailed(reason);
            // Fallback to last known prices
        } catch {
            emit PriceUpdateFailed("Unknown error during price update");
            // Fallback to last known prices
        }
        
        emit BuyRequested(msg.sender, msg.value, latestPrices, weights);
    }

    /**
     * @notice User sells ETF by specifying token amount. Updates prices from Pyth and emits SellRequested event
     * @param amountHbar Amount of ETF tokens to sell
     * @param priceUpdateData Price update data from Hermes for Pyth price feeds
     */
    function sell(uint256 amountHbar, bytes[] calldata priceUpdateData) external payable {
        require(amountHbar > 0, "Amount must be greater than 0");
        
        // Get the fee required for price update
        uint256 updateFee = PRICE_ORACLE.getUpdateFee(priceUpdateData);
        require(address(this).balance >= updateFee, "Insufficient contract balance for price update");
        
        // Update prices through the oracle
        PythStructs.Price[4] memory prices;
        try PRICE_ORACLE.updateAndGetPrices(priceUpdateData) returns (PythStructs.Price[4] memory updatedPrices) {
            prices = updatedPrices;
            // Store the raw price values for compatibility with events
            for (uint i = 0; i < 4; i++) {
                latestPrices[i] = uint256(uint64(prices[i].price));
            }
        } catch Error(string memory reason) {
            emit PriceUpdateFailed(reason);
            // Fallback to last known prices if available
        } catch {
            emit PriceUpdateFailed("Unknown error during price update");
            // Fallback to last known prices if available
        }
        
        emit SellRequested(msg.sender, amountHbar, latestPrices);
    }

    /**
     * @notice Owner withdraws ETH to pay user after sell is processed off-chain
     * @param user Address of the user to pay
     * @param payoutEth Amount of ETH to send to user
     */
    function withdraw(address user, uint256 payoutEth) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(payoutEth > 0, "Payout must be greater than 0");
        require(address(this).balance >= payoutEth, "Insufficient contract balance");
        
        (bool success, ) = payable(user).call{value: payoutEth}("");
        require(success, "ETH transfer failed");
        
        emit WithdrawExecuted(user, payoutEth);
    }

    /**
     * @notice Get the current ETH balance of the contract
     * @return uint256 Current ETH balance
     */
    function getAum() external view returns (uint256) {
        return address(this).balance;
    }
}