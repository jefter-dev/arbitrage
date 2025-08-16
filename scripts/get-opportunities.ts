import { join } from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { DbSchema } from "../src/repository/opportunity.repository";
import { Opportunity } from "../src/model/opportunity.model";

// Defines the constant path to the JSON database file.
const DB_PATH = join(process.cwd(), "db", "db.json");

/**
 * A helper function to display a list of opportunities in a formatted way.
 * @param title The section title to be displayed.
 * @param opportunities The array of opportunities to display.
 */
function displayOpportunities(
  title: string,
  opportunities: Opportunity[]
): void {
  console.log(`\n--- ${title} (${opportunities.length} found) ---`);
  if (opportunities.length === 0) {
    console.log("No opportunities in this category.");
    return;
  }

  // Sort by highest profit for better visualization
  opportunities
    .sort((a, b) => b.profitPercentage - a.profitPercentage)
    .forEach((opp, index) => {
      console.log(
        `\n#${index + 1}: ${opp.pair} | Gross Profit: ${opp.profitPercentage}%`
      );
      console.log(`  Buy at: ${opp.buyAt.exchange} @ ${opp.buyAt.price}`);
      console.log(`  Sell at:  ${opp.sellAt.exchange} @ ${opp.sellAt.price}`);
      if (
        opp.validation?.commonNetworks &&
        opp.validation.commonNetworks.length > 0
      ) {
        console.log(
          `  Networks:   ${opp.validation.commonNetworks.join(", ")}`
        );
      } else if (opp.validation) {
        console.log(`  Networks:   No common networks found.`);
      }
    });
}

/**
 * The main function that reads and displays the data from the local database.
 */
async function main() {
  console.log(`Reading data from the database at: ${DB_PATH}`);

  // Set up lowdb to read the file
  const adapter = new JSONFile<DbSchema>(DB_PATH);
  // Provide default data in case the file doesn't exist to prevent errors.
  const defaultData: DbSchema = { executable: [], potential: [] };
  const db = new Low<DbSchema>(adapter, defaultData);

  // Read data from the file into memory
  await db.read();

  if (!db.data) {
    throw new Error(
      "Could not read the database. The file might be empty or corrupted."
    );
  }

  // Display both lists of opportunities
  displayOpportunities("✅ Executable Opportunities", db.data.executable);
  displayOpportunities("⚠️ Potential Opportunities", db.data.potential);
}

// Execute the script
main().catch((error) => {
  console.error("\nError fetching the data:", (error as Error).message);
  process.exit(1);
});
