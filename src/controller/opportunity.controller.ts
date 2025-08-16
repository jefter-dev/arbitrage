import { Request, Response } from "express";
import { IOpportunityRepository } from "../types";

/**
 * Handles incoming HTTP requests for arbitrage opportunities. It acts as the
 * bridge between the API routes and the data layer (repository).
 */
export class OpportunityController {
  /**
   * Initializes the controller with a dependency on an opportunity repository.
   * @param opportunityRepository An instance that implements IOpportunityRepository
   * to fetch opportunity data.
   */
  constructor(private readonly opportunityRepository: IOpportunityRepository) {}

  /**
   * Handles the GET request to retrieve all opportunities (both executable and potential).
   * @param req The Express request object.
   * @param res The Express response object.
   */
  public async getAllOpportunities(req: Request, res: Response): Promise<void> {
    try {
      const data = await this.opportunityRepository.getAll();
      console.log("[ALL] executable: ", data.executable.length);
      console.log("[ALL] potential: ", data.potential.length);

      res.status(200).json(data);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Handles the GET request to retrieve only the executable opportunities.
   * @param req The Express request object.
   * @param res The Express response object.
   */
  public async getExecutableOpportunities(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { executable } = await this.opportunityRepository.getAll();
      console.log("executable: ", executable.length);

      res.status(200).json(executable);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Handles the GET request to retrieve only the potential opportunities.
   * @param req The Express request object.
   * @param res The Express response object.
   */
  public async getPotentialOpportunities(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { potential } = await this.opportunityRepository.getAll();
      console.log("potential: ", potential.length);

      res.status(200).json(potential);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Centralizes error handling for all route handlers in this controller.
   * Logs the error and sends a generic 500 server error response.
   * @param res The Express response object.
   * @param error The caught error object.
   */
  private handleError(res: Response, error: unknown): void {
    console.error("Error in controller while fetching opportunities:", error);
    res
      .status(500)
      .json({ message: "Internal server error while fetching data." });
  }
}
