const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');
require('dotenv').config();

// Load API credentials from environment variables.
const API_KEY = process.env.MEXC_KEY;
const API_SECRET = process.env.MEXC_SECRET;
const BASE_URL = 'https://api.mexc.com';

/**
 * Checks if a specific trading pair against USDT exists on MEXC.
 * @param {string} symbol - The base currency symbol (e.g., 'BTC').
 * @returns {Promise<boolean>} Returns true if the pair exists, otherwise false.
 */
async function checkUsdtPairExists(symbol) {
    try {
        // MEXC's public endpoint for a single symbol. A successful response means it exists.
        const endpoint = `/api/v3/exchangeInfo?symbol=${symbol.toUpperCase()}USDT`;
        await axios.get(`${BASE_URL}${endpoint}`);
        return true;
    } catch (error) {
        // A request error (like a 404) indicates the pair does not exist.
        return false;
    }
}

/**
 * Fetches and displays detailed information for a single asset from the user's
 * MEXC wallet, including its supported networks and contract addresses.
 * Requires API authentication.
 * @param {string} symbol - The asset's symbol (e.g., 'BTC').
 * @returns {Promise<void>}
 */
async function getSingleAssetInfo(symbol) {
    if (!API_KEY || !API_SECRET) {
        console.error("ERROR: Environment variables MEXC_KEY and MEXC_SECRET are not set.");
        return;
    }

    const timestamp = Date.now();
    const endpoint = '/api/v3/capital/config/getall';
    const queryString = `timestamp=${timestamp}`;

    // Create the HMAC SHA256 signature required by the MEXC API.
    const signature = crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');

    const url = `${BASE_URL}${endpoint}?${queryString}&signature=${signature}`;
    const headers = {
        'X-MEXC-APIKEY': API_KEY,
    };

    console.log(`\nFetching configuration details for ${symbol.toUpperCase()} on MEXC...`);

    try {
        const response = await axios.get(url, { headers });
        const allAssets = response.data;

        if (!Array.isArray(allAssets)) {
            if (allAssets.code && allAssets.msg) {
                throw new Error(`MEXC API Error: ${allAssets.msg} (code: ${allAssets.code})`);
            }
            throw new Error("API response was not the expected array.");
        }

        const assetInfo = allAssets.find(asset => asset.coin.toUpperCase() === symbol.toUpperCase());

        if (assetInfo) {
            console.log("\n--- ASSET FOUND ---");
            console.log(`Symbol: ${assetInfo.coin}`);
            console.log(`Name: ${assetInfo.name}`);
            console.log("\n--- Networks and Contracts ---");
            console.log(JSON.stringify(assetInfo.networkList, null, 2));
        } else {
            console.log(`\nAsset '${symbol.toUpperCase()}' not found in your MEXC wallet details.`);
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

    rl.question('Enter the asset symbol (e.g., BTC, MX): ', async (symbol) => {
        if (!symbol) {
            console.log("No symbol was provided.");
            rl.close();
            return;
        }
        const normalizedSymbol = symbol.trim().toUpperCase();
        try {
            console.log(`1. Checking if the ${normalizedSymbol}/USDT pair exists on MEXC...`);
            const pairExists = await checkUsdtPairExists(normalizedSymbol);
            if (pairExists) {
                console.log(`   ✅ Success! The ${normalizedSymbol}/USDT pair was found.`);
                await getSingleAssetInfo(normalizedSymbol);
            } else {
                console.log(`   ❌ Failed. The ${normalizedSymbol}/USDT pair does not exist or is not available on MEXC.`);
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