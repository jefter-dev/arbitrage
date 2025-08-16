const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

// Base URL for the Bitget public API.
const BASE_URL = 'https://api.bitget.com';

/**
 * Checks if a specific trading pair against USDT exists on Bitget.
 * @param {string} symbol - The base currency symbol (e.g., 'BTC').
 * @returns {Promise<boolean>} Returns true if the pair exists, otherwise false.
 */
async function checkUsdtPairExists(symbol) {
    try {
        // Bitget uses the format BTCUSDT (without '/') for its symbol parameter.
        const pairSymbol = `${symbol.toUpperCase()}USDT`;
        const endpoint = `/api/v2/spot/public/symbols?symbol=${pairSymbol}`;
        const response = await axios.get(`${BASE_URL}${endpoint}`);

        // The Bitget API returns a 'data' array. If it's not empty, the pair exists.
        return response.data && Array.isArray(response.data.data) && response.data.data.length > 0;
    } catch (error) {
        // Any error during the request implies the pair is not available or doesn't exist.
        return false;
    }
}

/**
 * Fetches and displays detailed information for a single asset, including its
 * supported networks and contract addresses on Bitget.
 * @param {string} symbol - The asset's symbol (e.g., 'BTC').
 * @returns {Promise<void>}
 */
async function getSingleAssetInfo(symbol) {
    // This Bitget endpoint is public and does not require authentication.
    const endpoint = '/api/v2/spot/public/coins';
    const url = `${BASE_URL}${endpoint}`;

    console.log(`\nFetching configuration details for ${symbol.toUpperCase()} on Bitget...`);

    try {
        const response = await axios.get(url);
        const allAssets = response.data.data;

        if (!Array.isArray(allAssets)) {
            if (response.data.code && response.data.msg) {
                throw new Error(`Bitget API Error: ${response.data.msg} (code: ${response.data.code})`);
            }
            throw new Error("API response was not the expected array.");
        }

        const assetInfo = allAssets.find(asset => asset.coin.toUpperCase() === symbol.toUpperCase());

        if (assetInfo) {
            console.log("\n--- ASSET FOUND ---");
            console.log(`Symbol: ${assetInfo.coin}`);
            console.log(`Name: ${assetInfo.name}`);
            console.log("\n--- Networks and Contracts ---");
            // The corresponding field in the Bitget API is 'chains'.
            console.log(JSON.stringify(assetInfo.chains, null, 2));
        } else {
            console.log(`\nAsset '${symbol.toUpperCase()}' not found in Bitget's details.`);
        }
    } catch (error) {
        if (error.response) {
            console.error("Error fetching asset info:", error.response.data);
        } else {
            console.error("Request error:", error.message);
        }
    }
}

/**
 * The main function to orchestrate the script's execution. It prompts the user
 * for an asset symbol and then performs the necessary checks and fetches.
 */
async function run() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the asset symbol (e.g., BTC, TON): ', async (symbol) => {
        if (!symbol) {
            console.log("No symbol was provided.");
            rl.close();
            return;
        }
        const normalizedSymbol = symbol.trim().toUpperCase();
        try {
            console.log(`1. Checking if the ${normalizedSymbol}/USDT pair exists on Bitget...`);
            const pairExists = await checkUsdtPairExists(normalizedSymbol);
            if (pairExists) {
                console.log(`   ✅ Success! The ${normalizedSymbol}/USDT pair was found.`);
                await getSingleAssetInfo(normalizedSymbol);
            } else {
                console.log(`   ❌ Failed. The ${normalizedSymbol}/USDT pair does not exist or is not available on Bitget.`);
            }
        } catch (error) {
            console.error("\nAn error occurred during verification:", error.message);
        } finally {
            rl.close();
        }
    });
}

// Starts the script.
run();