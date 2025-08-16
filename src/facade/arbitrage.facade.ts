import {
  ArbitrageConfig,
  IExchangeRepository,
  IOpportunityRepository,
} from "../types";
import { ArbitrageService } from "../service/arbitrage.service";
import { OpportunityRepository } from "../repository/opportunity.repository";
import { blue, green, red, reset, yellow } from "../lib/colors";
import { Opportunity } from "../model/opportunity.model";

type ExchangeName = string;

/**
 * Facade that orchestrates the arbitrage workflow.
 * It defines the sequence of steps to be executed and manages the display
 * of results and progress in the console.
 */
export class ArbitrageFacade {
  private readonly arbitrageService: ArbitrageService;
  private readonly opportunityRepository: IOpportunityRepository;

  /**
   * Initializes the facade by creating and injecting the necessary dependencies.
   */
  constructor(
    exchangeImplementations: { name: string; instance: IExchangeRepository }[],
    config: ArbitrageConfig
  ) {
    const repositoriesMap = new Map<ExchangeName, IExchangeRepository>(
      exchangeImplementations.map((repo) => [repo.name, repo.instance])
    );

    this.opportunityRepository = new OpportunityRepository();
    this.arbitrageService = new ArbitrageService(repositoriesMap, config);

    console.log("Arbitrage Facade initialized successfully.");
  }

  /**
   * Executes the end-to-end arbitrage workflow, orchestrating the analysis,
   * display, and persistence of opportunities.
   */
  public async run(initialIndex: number, finalIndex: number): Promise<void> {
    this._logInitialHeader(initialIndex, finalIndex);

    await this.opportunityRepository.clear("executable");
    await this.opportunityRepository.clear("potential");

    const exchangePairResults =
      await this.arbitrageService.fetchAllPairsFromRepositories();
    const sharedPairs =
      this.arbitrageService.findSharedPairs(exchangePairResults);

    this._logSharedPairsFound(sharedPairs.length);

    let executableCount = 0;
    let potentialCount = 0;

    const pairsToAnalyze = sharedPairs.slice(initialIndex, finalIndex);

    for await (const opportunity of this.arbitrageService.streamOpportunities(
      pairsToAnalyze
    )) {
      if (opportunity.validation?.isExecutable) {
        executableCount++;
        this._logExecutableOpportunity(opportunity, executableCount);
        await this.opportunityRepository.add(opportunity, "executable");
      } else {
        potentialCount++;
        this._logPotentialOpportunity(opportunity, potentialCount);
        await this.opportunityRepository.add(opportunity, "potential");
      }
    }

    this._logFinalSummary(executableCount, potentialCount);
  }

  // --- PRIVATE LOGGING METHODS ---

  /**
   * Displays the initial header and the database clearing step.
   */
  private _logInitialHeader(initialIndex: number, finalIndex: number): void {
    console.log("\n--- Executing arbitrage workflow via Facade ---");
    console.log("\nBot Configuration:");
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║               🔧 CONFIGURATION BOT                   ║");
    console.log("║ ---------------------------------------------------- ║");

    const padLine = (text: string, totalLength = 54) => {
      const visibleLength = text.replace(/\x1b\[[0-9;]*m/g, "").length;
      const padding = totalLength - visibleLength;
      return `║ ${text}${" ".repeat(padding - 1)}║`;
    };

    console.log(
      padLine(`- Analyzing pairs from index: ${yellow}${initialIndex}${reset}`)
    );
    console.log(
      padLine(`- Analyzing pairs up to index: ${yellow}${finalIndex}${reset}`)
    );
    console.log(
      padLine(
        `- Minimum Profit Percentage: ${yellow}${
          this.arbitrageService.getConfig().minProfitPercentage
        }%${reset}`
      )
    );
    console.log(
      padLine(
        `- Quote Assets Filter: ${yellow}[${this.arbitrageService
          .getConfig()
          .quoteAssetsFilter?.join(", ")}]${reset}`
      )
    );
    console.log(padLine(""));
    console.log(padLine(`--- ${red}Clearing previous database${reset} ---`));
    console.log("╚══════════════════════════════════════════════════════╝\n");
  }

  /**
   * Displays the number of shared pair combinations found.
   * @param count The number of shared pairs.
   */
  private _logSharedPairsFound(count: number): void {
    console.log(`${count} shared pair combinations found for analysis.`);
  }

  /**
   * Displays the details of a found executable opportunity.
   * @param opportunity The opportunity object.
   * @param count The counter for executable opportunities.
   */
  private _logExecutableOpportunity(
    opportunity: Opportunity,
    count: number
  ): void {
    console.log(
      `\n\n✅ [${green}EXECUTABLE OPPORTUNITY${reset}] #${count} FOUND!`
    );
    console.log(`   Pair: ${opportunity.pair}`);
    console.log(
      `   Gross Profit: ${blue}${opportunity.profitPercentage}%${reset}`
    );
    console.log(
      `   Buy at: ${opportunity.buyAt.exchange} @ ${opportunity.buyAt.price}`
    );
    console.log(
      `   Sell at: ${opportunity.sellAt.exchange} @ ${opportunity.sellAt.price}`
    );
    console.log(
      `   Common Networks: ${opportunity.validation?.commonNetworks.join(", ")}`
    );
  }

  /**
   * Displays a concise message for a found potential opportunity.
   * @param opportunity The opportunity object.
   * @param count The counter for potential opportunities.
   */
  private _logPotentialOpportunity(
    opportunity: Opportunity,
    count: number
  ): void {
    process.stdout.write(
      `  ⚠️ -> ${yellow}Potential${reset} #${count} found for ${opportunity.pair} (${opportunity.profitPercentage}%)\n`
    );
  }

  /**
   * Displays the final summary upon process completion.
   * @param executableCount The total number of executable opportunities found.
   * @param potentialCount The total number of potential opportunities found.
   */
  private _logFinalSummary(
    executableCount: number,
    potentialCount: number
  ): void {
    console.log(
      `\n--- Process Finished. ${executableCount} executable and ${potentialCount} potential opportunities were saved to the database. ---`
    );
  }
}
