// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// Import the Forge-VM cheatcodes interface
import {Script} from "forge-std/Script.sol";

contract HelperConfig is Script {

    NetworkConfig public activeNetworkConfig;

    struct NetworkConfig {
        uint256 deployerPrivateKey;
        string rpcUrl;
        address pythContract;
    }

    constructor() {
        if(block.chainid == 296) {
            activeNetworkConfig = getHederaTestnetConfig();
        } else {
            activeNetworkConfig = getAnvilConfig();
        }
    }

    function getHederaTestnetConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            deployerPrivateKey: vm.envUint("PRIVATE_KEY"),
            rpcUrl: vm.envString("HEDERA_TESTNET_RPC_URL"),
            pythContract: 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729 // Pyth contract on Hedera Testnet
        });
    }

    function getAnvilConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            deployerPrivateKey: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80, //address is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
            rpcUrl: "http://localhost:8545",
            pythContract: address(0) // Mock address for local testing - you'll need to deploy a mock Pyth contract
        });
    }

    function getActiveNetworkConfig() public view returns (NetworkConfig memory) {
        return activeNetworkConfig;
    }
}
