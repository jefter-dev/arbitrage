import express from "express";
import cors from "cors";
import { OpportunityController } from "./controller/opportunity.controller";
import { OpportunityRepository } from "./repository/opportunity.repository";
import path from "path";

const PORT = process.env.PORT || 8000;

// ╔══════════════════════════════════════════════════════╗
// ║        🗄️ REPOSITORY & CONTROLLER INSTANTIATION      ║
// ╚══════════════════════════════════════════════════════╝
// The repository handles data persistence (LowDB in this case),
// and the controller exposes the business logic via routes.
const opportunityRepository = new OpportunityRepository();
const opportunityController = new OpportunityController(opportunityRepository);

// ╔══════════════════════════════════════════════════════╗
// ║                  ⚙️ EXPRESS SETUP                    ║
// ╚══════════════════════════════════════════════════════╝
const app = express();
app.use(cors());
app.use(express.json());

// ╔══════════════════════════════════════════════════════╗
// ║             🌐 STATIC FILES (HTML INTERFACE)         ║
// ╚══════════════════════════════════════════════════════╝
// Define the path to the 'public' folder and tell Express
// to serve static files from there (e.g., index.html, CSS, JS).
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

// ╔══════════════════════════════════════════════════════╗
// ║                   📌 API ROUTES                      ║
// ╚══════════════════════════════════════════════════════╝

// Route to fetch ONLY executable opportunities
app.get(
  "/api/opportunities/executable",
  opportunityController.getExecutableOpportunities.bind(opportunityController)
);

// Route to fetch ONLY potential opportunities
app.get(
  "/api/opportunities/potential",
  opportunityController.getPotentialOpportunities.bind(opportunityController)
);

// Route to fetch ALL opportunities
app.get(
  "/api/opportunities",
  opportunityController.getAllOpportunities.bind(opportunityController)
);

// ╔══════════════════════════════════════════════════════╗
// ║                🚀 SERVER INITIALIZATION              ║
// ╚══════════════════════════════════════════════════════╝
app.listen(PORT, () => {
  console.log(`🚀 API Server running at http://localhost:${PORT}`);
  console.log(`   -> All:          http://localhost:${PORT}/api/opportunities`);
  console.log(
    `   -> Executables:  http://localhost:${PORT}/api/opportunities/executable`
  );
  console.log(
    `   -> Potentials:   http://localhost:${PORT}/api/opportunities/potential`
  );
});
