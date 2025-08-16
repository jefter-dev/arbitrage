import { join, dirname } from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import * as fs from "fs";
import { IOpportunityRepository } from "../types";
import { Opportunity } from "../model/opportunity.model";

export type DbSchema = {
  executable: Opportunity[];
  potential: Opportunity[];
};

/**
 * Implements the IOpportunityRepository interface using lowdb to persist arbitrage
 * opportunities to a local JSON file.
 */
export class OpportunityRepository implements IOpportunityRepository {
  private db: Low<DbSchema>;

  /**
   * Initializes the repository by setting up the lowdb instance and ensuring
   * the database directory exists.
   * @param dbPath The relative path to the JSON database file.
   */
  constructor(dbPath: string = "db/db.json") {
    const fullPath = join(process.cwd(), dbPath);
    const directory = dirname(fullPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    const adapter = new JSONFile<DbSchema>(fullPath);
    const defaultData: DbSchema = { executable: [], potential: [] };
    this.db = new Low<DbSchema>(adapter, defaultData);
  }

  /**
   * Adds a single opportunity to the appropriate collection in the database.
   * @param opportunity The opportunity object to add.
   * @param type The collection ('executable' or 'potential') to which the opportunity will be added.
   */
  public async add(
    opportunity: Opportunity,
    type: "executable" | "potential"
  ): Promise<void> {
    await this.db.read();
    this.db.data[type].push(opportunity);
    await this.db.write();
  }

  /**
   * Clears all opportunities from a specified collection.
   * @param type The collection ('executable' or 'potential') to clear.
   */
  public async clear(type: "executable" | "potential"): Promise<void> {
    await this.db.read();
    this.db.data[type] = [];
    await this.db.write();
  }

  /**
   * Reads and returns the entire content of the database.
   * Forces a re-read from disk on every call to ensure data is fresh.
   * @returns An object containing both executable and potential opportunity lists.
   */
  public async getAll(): Promise<DbSchema> {
    await this.db.read();
    return this.db.data;
  }
}
