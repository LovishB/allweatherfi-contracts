// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {AllWeatherPriceOracle} from "./AllWeatherPriceOracle.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract AllWeatherEscrow {
    /** 
    State Variables
    */
    uint256 public latestNav;
    uint256[4] public latestPrices;
    address public owner;
    uint256[4] public targetWeights;
    AllWeatherPriceOracle public immutable PRICE_ORACLE;

    /**
    Events
    */
    event BuyRequested(address indexed user, uint256 amountEth, uint256[4] prices);
    event SellRequested(address indexed user, uint256 amountEtf, uint256[4] prices);
    event NavUpdated(uint256 newNav);
    event WithdrawExecuted(address indexed user, uint256 payoutEth);
    event TargetWeightsUpdated(uint256[4] newWeights);
    event PriceUpdateFailed(string reason);

    /**
    Modifiers
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address _priceOracle) {
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
     */
    function buy(bytes[] calldata priceUpdateData) external payable {
        require(msg.value > 0, "Must send ETH to buy");
        
        // Get the fee required for price update
        uint256 updateFee = PRICE_ORACLE.getUpdateFee(priceUpdateData);
        require(msg.value > updateFee, "Insufficient ETH for price update and purchase");
        
        // Update prices through the oracle
        PythStructs.Price[4] memory prices;
        try PRICE_ORACLE.updateAndGetPrices{value: updateFee}(priceUpdateData) returns (PythStructs.Price[4] memory updatedPrices) {
            prices = updatedPrices;
            // Store the raw price values for compatibility with events
            for (uint i = 0; i < 4; i++) {
                latestPrices[i] = uint256(uint64(prices[i].price));
            }
        } catch Error(string memory reason) {
            emit PriceUpdateFailed(reason);
            // Fallback to last known prices if available
            require(latestPrices[0] > 0, "No valid price data available");
        } catch {
            emit PriceUpdateFailed("Unknown error during price update");
            // Fallback to last known prices if available
            require(latestPrices[0] > 0, "No valid price data available");
        }
        
        emit BuyRequested(msg.sender, msg.value - updateFee, latestPrices);
    }

    /**
     * @notice User sells ETF by specifying token amount. Updates prices from Pyth and emits SellRequested event
     * @param amountEtf Amount of ETF tokens to sell
     * @param priceUpdateData Price update data from Hermes for Pyth price feeds
     */
    function sell(uint256 amountEtf, bytes[] calldata priceUpdateData) external payable {
        require(amountEtf > 0, "Amount must be greater than 0");
        
        // Get the fee required for price update
        uint256 updateFee = PRICE_ORACLE.getUpdateFee(priceUpdateData);
        require(msg.value >= updateFee, "Insufficient ETH for price update");
        
        // Update prices through the oracle
        PythStructs.Price[4] memory prices;
        try PRICE_ORACLE.updateAndGetPrices{value: updateFee}(priceUpdateData) returns (PythStructs.Price[4] memory updatedPrices) {
            prices = updatedPrices;
            // Store the raw price values for compatibility with events
            for (uint i = 0; i < 4; i++) {
                latestPrices[i] = uint256(uint64(prices[i].price));
            }
        } catch Error(string memory reason) {
            emit PriceUpdateFailed(reason);
            // Fallback to last known prices if available
            require(latestPrices[0] > 0, "No valid price data available");
        } catch {
            emit PriceUpdateFailed("Unknown error during price update");
            // Fallback to last known prices if available
            require(latestPrices[0] > 0, "No valid price data available");
        }
        
        emit SellRequested(msg.sender, amountEtf, latestPrices);
    }

    /**
     * @notice Owner updates the latest NAV
     */
    function updateLatestNav(uint256 newNav) external onlyOwner {
        latestNav = newNav;
        emit NavUpdated(newNav);
    }

    /**
     * @notice Owner updates the target asset allocation weights
     * @param newWeights Array of 4 uint256 representing new target weights for [S&P, Bonds, Gold, Oil]
     */
    function updateTargetWeights(uint256[4] calldata newWeights) external onlyOwner {
        uint256 sum = newWeights[0] + newWeights[1] + newWeights[2] + newWeights[3];
        require(sum == 100, "Target weights must sum to 100");
        
        targetWeights = newWeights;
        emit TargetWeightsUpdated(newWeights);
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