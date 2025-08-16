import axios, { AxiosError } from "axios";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types";

// Type definition for the raw pair data from the Bitget API.
interface BitgetRawPair {
  status: "online" | "offline";
  baseCoin: string;
  quoteCoin: string;
}

// Type definition for the raw ticker data from the Bitget API.
interface BitgetRawTicker {
  askPr: string;
  bidPr: string;
}

// Type definition for a single network chain from the Bitget API.
interface BitgetChain {
  chain: string;
  rechargeable: "true" | "false";
  withdrawable: "true" | "false";
}

// Type definition for the raw coin info data from the Bitget API.
interface BitgetCoinInfo {
  coin: string;
  chains: BitgetChain[];
}

/**
 * Implements the IExchangeRepository interface for the Bitget exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the Bitget API.
 */
class BitgetApi implements IExchangeRepository {
  // Public API Endpoints for Bitget
  private readonly SYMBOLS_URL =
    "https://api.bitget.com/api/v2/spot/public/symbols";
  private readonly TICKER_URL =
    "https://api.bitget.com/api/v2/spot/market/tickers";
  private readonly ALL_COINS_URL =
    "https://api.bitget.com/api/v2/spot/public/coins";

  /**
   * Fetches all available trading pairs from the Bitget exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from Bitget (via Axios)...");
      const response = await axios.get<{ data: BitgetRawPair[] }>(
        this.SYMBOLS_URL
      );

      if (
        !response.data ||
        !response.data.data ||
        !Array.isArray(response.data.data)
      ) {
        throw new Error(
          "Unexpected response format from Bitget API (fetchAllPairs)"
        );
      }

      const rawPairs = response.data.data;
      const pairs: StandardPair[] = rawPairs
        .filter((market) => market.status === "online")
        .map((market) => ({
          symbol: `${market.baseCoin}/${market.quoteCoin}`,
          base: market.baseCoin,
          quote: market.quoteCoin,
          exchange: "bitget",
          raw: market,
        }));

      console.log(`Found ${pairs.length} pairs on Bitget.`);
      return pairs;
    } catch (error) {
      console.error(
        "Error fetching pairs from Bitget:",
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
    const apiSymbol = `${pair.raw.baseCoin}${pair.raw.quoteCoin}`;
    try {
      const response = await axios.get<{ data: BitgetRawTicker[] }>(
        this.TICKER_URL,
        { params: { symbol: apiSymbol } }
      );

      if (
        !response.data ||
        !response.data.data ||
        !Array.isArray(response.data.data) ||
        response.data.data.length === 0
      ) {
        throw new Error(
          `Bitget API did not return ticker data for ${apiSymbol}`
        );
      }

      const ticker = response.data.data[0];
      return {
        exchange: "bitget",
        price: parseFloat(ticker.askPr),
        bid: parseFloat(ticker.bidPr),
        ask: parseFloat(ticker.askPr),
        raw: ticker,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching ticker for ${apiSymbol} on Bitget:`,
        (error as Error).message
      );
      if (axios.isAxiosError(error) && error.response) {
        console.error("API Response:", error.response.data);
      }
      return null;
    }
  }

  /**
   * Fetches the deposit and withdrawal status for a specific asset.
   * This implementation fetches all coin data from a public endpoint.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    try {
      const response = await axios.get<{ data: BitgetCoinInfo[] }>(
        this.ALL_COINS_URL
      );

      if (
        !response.data ||
        !response.data.data ||
        !Array.isArray(response.data.data)
      ) {
        throw new Error("Invalid response from Bitget coins API.");
      }

      const allAssetsFromApi = response.data.data;

      const assetInfo = allAssetsFromApi.find(
        (coin) => coin.coin.toUpperCase() === asset.toUpperCase()
      );

      if (!assetInfo) {
        return null;
      }

      const depositNetworks = assetInfo.chains
        .filter((chain) => chain.rechargeable === "true")
        .map((chain) => chain.chain.toUpperCase());

      const withdrawNetworks = assetInfo.chains
        .filter((chain) => chain.withdrawable === "true")
        .map((chain) => chain.chain.toUpperCase());

      return {
        canDeposit: depositNetworks.length > 0,
        canWithdraw: withdrawNetworks.length > 0,
        depositNetworks: depositNetworks,
        withdrawNetworks: withdrawNetworks,
        assetInfo: assetInfo,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching status for ${asset} on Bitget:`,
        (error as Error).message
      );
      return null;
    }
  }
}

export default new BitgetApi();
