import { Opportunity } from "../model/opportunity.model";
import { StandardPair, StandardTicker, AssetStatus } from "./domain.types";

/**
 * Interface for interacting with a cryptocurrency exchange.
 */
export interface IExchangeRepository {
  /**
   * Fetches all trading pairs available on the exchange.
   * @returns A promise resolving to an array of standardized pairs.
   */
  fetchAllPairs(): Promise<StandardPair[]>;

  /**
   * Fetches the current ticker (price data) for a given trading pair.
   * @param pair The trading pair to fetch ticker info for.
   * @returns A promise resolving to the ticker data, or null if unavailable.
   */
  fetchTicker(pair: StandardPair): Promise<StandardTicker | null>;

  /**
   * Retrieves the deposit and withdrawal status of a given asset.
   * @param asset The symbol of the asset (e.g., 'USDT').
   * @returns A promise resolving to the asset status, or null if not found.
   */
  getAssetStatus(asset: string): Promise<AssetStatus | null>;
}

/**
 * Interface for persisting arbitrage opportunities.
 */
export interface IOpportunityRepository {
  /**
   * Adds a single opportunity to the database.
   * @param opportunity The opportunity object to save.
   * @param type Specifies whether the opportunity is 'executable' or 'potential'.
   */
  add(
    opportunity: Opportunity,
    type: "executable" | "potential"
  ): Promise<void>;

  /**
   * Clears all opportunities of a given type.
   * Useful for starting a new session or refresh.
   * @param type The type of opportunities to clear ('executable' | 'potential').
   */
  clear(type: "executable" | "potential"): Promise<void>;

  /**
   * Retrieves all stored opportunities, grouped by type.
   * @returns A promise resolving to an object containing arrays of executable and potential opportunities.
   */
  getAll(): Promise<{
    executable: Opportunity[];
    potential: Opportunity[];
  }>;
}
