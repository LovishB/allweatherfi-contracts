-include .env

.PHONY: all deploy-base-sepolia deploy-local help

DEFAULT_ANVIL_KEY := 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

help:
	@echo "Usage:"
	@echo "  make deploy-base-sepolia - Deploy to Base Sepolia network"
	@echo "  make deploy-local - Deploy to Anvil local"

# Local deployment
deploy-local:
	@forge script script/AllWeatherEscrow.s.sol:AllWeatherEscrowScript \
	--rpc-url http://localhost:8545 \
	--private-key $(DEFAULT_ANVIL_KEY) \
	--broadcast

# Deploy to Base Sepolia
deploy-base-sepolia:
	@forge script script/AllWeatherEscrow.s.sol:AllWeatherEscrowScript \
	--rpc-url $(BASE_SEPOLIA_RPC_URL) \
	--private-key $(PRIVATE_KEY) \
	--broadcast \
	--verify \
	--etherscan-api-key $(BASESCAN_API_KEY) \
	-vvvv
