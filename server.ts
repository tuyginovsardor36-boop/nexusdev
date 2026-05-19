import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Mock Marketplace Data
  app.get("/api/products", (req, res) => {
    const category = req.query.category as string;
    const products = [
      {
        id: "sdk-001",
        name: "Enterprise Auth SDK",
        description: "Zero-config biometric and OAuth2 integration for React/Node.",
        price: 299,
        category: "Authentication SDKs",
        type: "SDK"
      },
      {
        id: "web-001",
        name: "SaaS Dashboard Pro",
        description: "Ultra-fast, responsive dashboard template with dark mode and charts.",
        price: 149,
        category: "Core Infrastructure",
        type: "Template"
      },
      {
        id: "sdk-002",
        name: "Vector DB Connector",
        description: "High-performance interface for Pinecone and Milvus with caching.",
        price: 180,
        category: "Data Orchestration",
        type: "SDK"
      },
      {
        id: "sdk-003",
        name: "CloudDeploy Automator",
        description: "Terraform-based automation provider for multi-cloud environments.",
        price: 450,
        category: "Cloud Automation",
        type: "SDK"
      },
      {
        id: "sdk-004",
        name: "SecureGate Shield",
        description: "AI-driven DDoS protection middleware for Express and NestJS.",
        price: 520,
        category: "Authentication SDKs",
        type: "Security"
      }
    ];

    if (category && category !== "all") {
      return res.json(products.filter(p => p.category === category));
    }
    res.json(products);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexus Dev Server running on http://localhost:${PORT}`);
  });
}

startServer();
