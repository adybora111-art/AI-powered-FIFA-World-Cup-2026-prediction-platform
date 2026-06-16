# WorldCupAI — FIFA World Cup 2026 Prediction Platform

A full-stack AI-powered platform that predicts FIFA World Cup 2026 outcomes using an ensemble machine learning model trained on real team statistics, with live tournament simulation, analytics dashboards, and explainable AI.

**Live demo:** https://ai-powered-fifa-world-cup-2026-pred.vercel.app

## Overview

WorldCupAI combines an ensemble of three machine learning models (Logistic Regression, Random Forest, and Gradient Boosting) to predict win probabilities for all 23 qualified nations in the 2026 World Cup. Predictions are explained using SHAP-style feature attribution rather than presented as a black box, and a Monte Carlo simulator runs thousands of virtual tournaments to generate confidence intervals on top of the point predictions.

## Features

- **Ensemble ML win probabilities** for all 23 qualified nations, weighted across three independently trained models
- **Feature importance and SHAP explainability**, showing exactly which signals (recent form, Elo rating, defensive record, squad value, etc.) drove each prediction
- **Monte Carlo tournament simulator** running up to 10,000 simulations with 95% confidence intervals on win frequency
- **Bracket simulator** that plays out the Round of 16 through the Final using a Dixon-Coles adjusted win model and a Poisson goal-scoring engine, complete with penalty shootouts on draws
- **Head-to-head team comparison** across squad metrics, historical pedigree, and tactical profile
- **Historical analytics**, including past champions, confederation win distribution, and full team rankings
- **Backtested against four real World Cups** (2010, 2014, 2018, 2022), correctly ranking the eventual champion first in all four

## Tech Stack

**Frontend**
- React 19 + TypeScript
- Vite
- Tailwind CSS
- Framer Motion for animation
- Recharts for data visualization
- Wouter for routing
- TanStack Query for data fetching

**Backend**
- Node.js + Express
- TypeScript
- Drizzle ORM
- PostgreSQL (hosted on Neon)

**Infrastructure**
- pnpm monorepo workspace
- Frontend deployed on Vercel
- API server containerized with Docker, deployed on Render
- Database hosted on Neon (serverless Postgres)

## Architecture

```
FIFA-Winner-prediction/
├── artifacts/
│   ├── fifa-predictor/      # React frontend
│   └── api-server/          # Express API server
├── lib/
│   ├── db/                  # Drizzle schema and database client
│   ├── api-client-react/    # Typed API client + React Query hooks
│   ├── api-spec/            # API contract / OpenAPI generation
│   └── api-zod/             # Zod validation schemas shared across client/server
└── Dockerfile                # Production container build for the API server
```

This is a pnpm workspace monorepo. The frontend and backend are independently deployable, communicating over a typed REST API with Zod-validated request and response schemas.

## The Model

Each team's win probability is produced by a weighted ensemble:

| Model | Weight | Description |
|---|---|---|
| Logistic Regression | 30% | Baseline linear model with sigmoid activation |
| Random Forest | 35% | 100 bootstrap trees with feature subsampling |
| Gradient Boosting | 35% | 50-round additive boosting with interaction terms |

Predictions are driven by 14 engineered features, the most heavily weighted being recent form (22%), Elo rating (18%), and defensive record (16%). Historical factors like World Cup titles are deliberately weighted low (2.2%) since the model prioritizes current form over legacy reputation — for example, it correctly demotes a recent World Cup winner with declining form well below the current form leader.

The model was backtested against the four most recent World Cups using only pre-tournament statistics, correctly identifying the eventual champion as the top-ranked team in all four tournaments.

## Running Locally

### Prerequisites
- Node.js 22+
- pnpm
- A PostgreSQL database (e.g. a free Neon project)

### Setup

```bash
# Install dependencies
pnpm install

# Push the database schema
pnpm --filter @workspace/db run push

# Start the API server (in one terminal)
cd artifacts/api-server
$env:DATABASE_URL="your-postgres-connection-string"
$env:PORT="5000"
pnpm run dev

# Start the frontend (in another terminal)
pnpm --filter @workspace/fifa-predictor run dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the backend at `http://localhost:5000`.

## Deployment

- **Frontend**: Deployed on Vercel from `artifacts/fifa-predictor`, calling the production API directly via a configured base URL.
- **API server**: Containerized with the root `Dockerfile` and deployed on Render as a web service.
- **Database**: Hosted on Neon, a serverless PostgreSQL provider.

## License

This project was built for educational and portfolio purposes.