import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types";

// Type definition for the raw pair data from the Coinbase API.
interface CoinbaseRawPair {
  id: string;
  status: "online" | string;
  trading_disabled: boolean;
  base_currency: string;
  quote_currency: string;
}

// Type definition for the raw ticker data from the Coinbase API.
interface CoinbaseRawTicker {
  ask: string;
  bid: string;
  price: string;
}

// Type definition for the public currency endpoint response.
interface CoinbaseCurrencyDetails {
  id: string;
  name: string;
  min_size: string;
}

/**
 * Implements the IExchangeRepository interface for the Coinbase exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the Coinbase API.
 */
class CoinbaseApi implements IExchangeRepository {
  // Endpoints
  private readonly EXCHANGE_URL = "https://api.exchange.coinbase.com"; // For market data (pairs, tickers)
  private readonly API_URL = "https://api.coinbase.com"; // For general data (currencies)

  // API keys are not required for the public endpoints used in this adapter.
  // They are kept here for potential future implementation of private endpoints.
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;

  constructor() {
    this.apiKey = process.env.COINBASE_KEY;
    this.apiSecret = process.env.COINBASE_SECRET;
  }

  /**
   * Fetches all available trading pairs from the Coinbase Exchange API.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from Coinbase (via Exchange API)...");
      const response = await axios.get<CoinbaseRawPair[]>(
        `${this.EXCHANGE_URL}/products`
      );
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error(
          "Unexpected response format from Coinbase API (fetchAllPairs)"
        );
      }
      const rawPairs = response.data;
      const pairs: StandardPair[] = rawPairs
        .filter(
          (market) =>
            market.status === "online" && market.trading_disabled === false
        )
        .map((market) => ({
          symbol: market.id.replace("-", "/"),
          base: market.base_currency,
          quote: market.quote_currency,
          exchange: "coinbase",
          raw: market,
        }));
      console.log(`Found ${pairs.length} pairs on Coinbase.`);
      return pairs;
    } catch (error) {
      console.error(
        "Error fetching pairs from Coinbase:",
        (error as Error).message
      );
      return [];
    }
  }

  /**
   * Fetches the latest price data (ticker) for a specific trading pair.
   * @param pair The standardized pair object for which to fetch the ticker.
   * @returns A promise that resolves to a standardized ticker object, or null if not found.
   */
  public async fetchTicker(pair: StandardPair): Promise<StandardTicker | null> {
    const apiSymbol = pair.raw.id;
    const tickerUrl = `${this.EXCHANGE_URL}/products/${apiSymbol}/ticker`;
    try {
      const response = await axios.get<CoinbaseRawTicker>(tickerUrl);
      const ticker = response.data;
      if (!ticker || !ticker.ask || !ticker.bid) {
        throw new Error(
          `Coinbase API did not return valid ticker data for ${apiSymbol}`
        );
      }
      return {
        exchange: "coinbase",
        price: parseFloat(ticker.ask),
        bid: parseFloat(ticker.bid),
        ask: parseFloat(ticker.ask),
        raw: ticker,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching ticker for ${apiSymbol} on Coinbase:`,
        (error as Error).message
      );
      if (axios.isAxiosError(error) && error.response) {
        console.error("API Response:", error.response.data);
      }
      return null;
    }
  }

  /**
   * Fetches the status of an asset using Coinbase's public currency endpoint.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    const url = `${this.API_URL}/v2/currencies/${asset.toUpperCase()}`;

    try {
      const { data } = await axios.get<{ data: CoinbaseCurrencyDetails }>(url);
      const assetInfo = data.data;

      if (!assetInfo) return null;

      // The public API does not provide detailed network or deposit/withdrawal statuses.
      // We assume that if the asset exists, it is operational on its main network.
      // This is the best possible approximation with the available public data.
      const isEnabled = true;
      const network = assetInfo.id.toUpperCase(); // e.g., 'BTC', 'ETH'

      return {
        canDeposit: isEnabled,
        canWithdraw: isEnabled,
        depositNetworks: [network],
        withdrawNetworks: [network],
        assetInfo: assetInfo,
      };
    } catch (error) {
      // A 404 error is expected for unsupported assets and should not pollute the logs.
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        console.error(
          `Error fetching status for ${asset} on Coinbase:`,
          error.response?.data?.errors?.[0]?.message || error.message
        );
      }
      return null;
    }
  }
}

export default new CoinbaseApi();
