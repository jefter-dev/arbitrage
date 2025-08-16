import { green, reset } from "../lib/colors";
import { Opportunity } from "../model/opportunity.model";
import {
  EnrichedPair,
  ExchangeData,
  ExchangeName,
  IExchangeRepository,
  SharedPairInfo,
} from "../types";
import { StandardPair, StandardTicker, ArbitrageConfig } from "../types";

/**
 * Service for arbitrage logic, including fetching pairs, analyzing opportunities,
 * and validating them for execution.
 */
export class ArbitrageService {
  private readonly exchangeRepositories: Map<ExchangeName, IExchangeRepository>;
  private readonly config: ArbitrageConfig;

  constructor(
    exchangeRepositories: Map<ExchangeName, IExchangeRepository>,
    config: ArbitrageConfig
  ) {
    this.exchangeRepositories = exchangeRepositories;
    this.config = config;
  }

  /** Fetches all trading pairs from all registered exchange repositories. */
  public async fetchAllPairsFromRepositories(): Promise<ExchangeData[]> {
    return Promise.all(
      Array.from(this.exchangeRepositories.entries()).map(
        async ([name, repo]) => ({
          name,
          pairs: await repo.fetchAllPairs(),
        })
      )
    );
  }

  /** Finds pairs that are available on at least two exchanges. */
  public findSharedPairs(exchangeData: ExchangeData[]): SharedPairInfo[] {
    const filterActive =
      this.config.quoteAssetsFilter && this.config.quoteAssetsFilter.length > 0;

    const pairMap = new Map<
      string,
      { name: ExchangeName; pairData: StandardPair }[]
    >();
    for (const exchange of exchangeData) {
      for (const pair of exchange.pairs) {
        if (
          filterActive &&
          !this.config.quoteAssetsFilter!.includes(pair.quote)
        ) {
          continue;
        }
        if (!pairMap.has(pair.symbol)) pairMap.set(pair.symbol, []);
        pairMap.get(pair.symbol)!.push({ name: exchange.name, pairData: pair });
      }
    }

    const sharedPairs: SharedPairInfo[] = [];
    for (const [symbol, exchanges] of pairMap.entries()) {
      if (exchanges.length >= 2) sharedPairs.push({ symbol, exchanges });
    }
    return sharedPairs;
  }

  /**
   * Streams arbitrage opportunities by analyzing each shared pair sequentially.
   * Yields validated opportunities, both executable and potential.
   */
  public async *streamOpportunities(
    sharedPairs: SharedPairInfo[]
  ): AsyncGenerator<Opportunity> {
    for (let i = 0; i < sharedPairs.length; i++) {
      const sharedPair = sharedPairs[i];

      process.stdout.write(
        `Analisando: [${green}${sharedPair.symbol}${reset}] ${i + 1}/${
          sharedPairs.length
        } pares...\r`
      );

      const enrichedPair = await this._enrichSinglePairWithTickers(sharedPair);
      if (!enrichedPair) continue;

      const priceOpportunities =
        this._findOpportunitiesInSinglePair(enrichedPair);
      if (priceOpportunities.length === 0) continue;

      for (const priceOpp of priceOpportunities) {
        const validatedOpp = await this._validateSingleOpportunity(priceOpp);
        if (validatedOpp) yield validatedOpp;
      }

      await this.delay(30);
    }
    // Clear the line in final progress and write message in conclusion de conclusão
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `Analysis of ${sharedPairs.length} pairs completed.\n`
    );
  }

  /** Fetches tickers for a single shared pair and returns enriched pair data. */
  private async _enrichSinglePairWithTickers(
    sharedPair: SharedPairInfo
  ): Promise<EnrichedPair | null> {
    try {
      const tickerPromises = sharedPair.exchanges.map((ex) =>
        this.exchangeRepositories.get(ex.name)!.fetchTicker(ex.pairData)
      );
      const results = await Promise.all(tickerPromises);
      const validTickers = new Map<ExchangeName, StandardTicker>();
      results.forEach((ticker, index) => {
        if (ticker) validTickers.set(sharedPair.exchanges[index].name, ticker);
      });
      return validTickers.size >= 2
        ? { ...sharedPair, tickers: validTickers }
        : null;
    } catch {
      return null;
    }
  }

  /** Finds potential arbitrage opportunities within a single enriched pair. */
  private _findOpportunitiesInSinglePair(
    enrichedPair: EnrichedPair
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const tickers = Array.from(enrichedPair.tickers.entries());
    if (tickers.length < 2) return [];

    for (let i = 0; i < tickers.length; i++) {
      for (let j = 0; j < tickers.length; j++) {
        if (i === j) continue;

        const [buyExchange, buyTicker] = tickers[i];
        const [sellExchange, sellTicker] = tickers[j];

        if (buyTicker.ask > 0 && sellTicker.bid > buyTicker.ask) {
          const grossProfitPercentage =
            ((sellTicker.bid - buyTicker.ask) / buyTicker.ask) * 100;

          if (grossProfitPercentage >= this.config.minProfitPercentage) {
            opportunities.push({
              pair: enrichedPair.symbol,
              profitPercentage: parseFloat(grossProfitPercentage.toFixed(4)),
              buyAt: { exchange: buyExchange, price: buyTicker.ask },
              sellAt: { exchange: sellExchange, price: sellTicker.bid },
            });
          }
        }
      }
    }
    return opportunities;
  }

  /** Validates a single opportunity for executability and common networks. */
  private async _validateSingleOpportunity(
    opportunity: Opportunity
  ): Promise<Opportunity | null> {
    try {
      const [baseAsset, quoteAsset] = opportunity.pair.split("/");
      const buyRepository = this.exchangeRepositories.get(
        opportunity.buyAt.exchange
      )!;
      const sellRepository = this.exchangeRepositories.get(
        opportunity.sellAt.exchange
      )!;

      const [buyBaseStatus, buyQuoteStatus, sellBaseStatus, sellQuoteStatus] =
        await Promise.all([
          buyRepository.getAssetStatus(baseAsset),
          buyRepository.getAssetStatus(quoteAsset),
          sellRepository.getAssetStatus(baseAsset),
          sellRepository.getAssetStatus(quoteAsset),
        ]);

      const canWithdrawFromBuyExchange = buyBaseStatus?.canWithdraw ?? false;
      const canDepositOnSellExchange = sellBaseStatus?.canDeposit ?? false;
      const commonNetworks = (buyBaseStatus?.withdrawNetworks ?? []).filter(
        (net) => (sellBaseStatus?.depositNetworks ?? []).includes(net)
      );
      const isPathExecutable =
        canWithdrawFromBuyExchange &&
        canDepositOnSellExchange &&
        commonNetworks.length > 0;

      return {
        ...opportunity,
        validation: {
          isExecutable: isPathExecutable,
          commonNetworks,
          buyExchange: {
            canWithdraw: canWithdrawFromBuyExchange,
            withdrawNetworks: buyBaseStatus?.withdrawNetworks,
          },
          sellExchange: {
            canDeposit: canDepositOnSellExchange,
            depositNetworks: sellBaseStatus?.depositNetworks,
          },
          assetDetails: {
            baseAsset: {
              buyExchange: buyBaseStatus?.assetInfo || null,
              sellExchange: sellBaseStatus?.assetInfo || null,
            },
            quoteAsset: {
              buyExchange: buyQuoteStatus?.assetInfo || null,
              sellExchange: sellQuoteStatus?.assetInfo || null,
            },
          },
        },
      };
    } catch {
      return null;
    }
  }

  /** Simple delay utility for asynchronous processing. */
  private delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  /** get config to puplic. */
  public getConfig() {
    return this.config;
  }
}
