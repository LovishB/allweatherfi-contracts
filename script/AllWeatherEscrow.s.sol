// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {AllWeatherEscrow} from "../src/AllWeatherEscrow.sol";
import {AllWeatherPriceOracle} from "../src/AllWeatherPriceOracle.sol";
import {HelperConfig} from "./helperconfig.s.sol";

contract AllWeatherEscrowScript is Script {

    function run() external {
        HelperConfig helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getActiveNetworkConfig();

        vm.startBroadcast(config.deployerPrivateKey);
        
        // Deploy the price oracle first
        AllWeatherPriceOracle oracle = new AllWeatherPriceOracle(config.pythContract);
        console.log("AllWeatherPriceOracle deployed at:", address(oracle));
        
        // Deploy the escrow contract with oracle address
        AllWeatherEscrow escrow = new AllWeatherEscrow(payable(address(oracle)));
        console.log("AllWeatherEscrow deployed at:", address(escrow));

        vm.stopBroadcast();
    }
}
