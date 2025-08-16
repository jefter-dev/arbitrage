/**
 * Configuration parameters for running the arbitrage service.
 */
export interface ArbitrageConfig {
  /**
   * Minimum profit percentage required for an arbitrage opportunity
   * to be considered valid.
   *
   * Example:
   * - If `minProfitPercentage = 0.5`, only trades with profit ≥ 0.5%
   *   will be listed/executed.
   */
  minProfitPercentage: number;

  /**
   * Optional list of quote assets to filter trading pairs.
   *
   * - If defined, the service will only analyze pairs where the
   *   quote asset (`quote`) is included in this list.
   * - If empty or undefined, **all available pairs** will be analyzed.
   *
   * Example:
   * ```ts
   * quoteAssetsFilter: ['USDT', 'USDC']
   * ```
   * Only pairs ending in USDT or USDC will be evaluated (e.g., BTC/USDT, ETH/USDC).
   */
  quoteAssetsFilter?: string[];
}
