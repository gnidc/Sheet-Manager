# replit.md

## Overview

This is a Korean ETF (Exchange-Traded Fund) information dashboard application, specifically focused on covered call ETFs and other investment products. The application allows users to browse, search, filter, create, update, and delete ETF entries. It displays financial data including fees, yields, market cap, dividend cycles, and underlying assets. The app is designed as a financial reference tool for Korean investors tracking ETF products.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite for fast development and optimized production builds

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/` (Home, EtfDetail, not-found)
- Reusable components in `client/src/components/`
- Custom hooks in `client/src/hooks/` for data fetching (`use-etfs.ts`)
- shadcn/ui components in `client/src/components/ui/`

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON API with Zod schema validation
- **Database ORM**: Drizzle ORM for type-safe database queries

The server structure includes:
- `server/index.ts` - Express app setup and middleware
- `server/routes.ts` - API endpoint definitions
- `server/storage.ts` - Database access layer (repository pattern)
- `server/db.ts` - Database connection configuration

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` - defines the `etfs` table with fields for ETF metadata, real-time pricing data, and recommendation flags
- **Migrations**: Generated to `./migrations` directory via `drizzle-kit push`

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- `shared/schema.ts` - Database schema and Zod validation schemas
- `shared/routes.ts` - API route definitions with type-safe request/response schemas

### Build System
- Development: Vite dev server with HMR for frontend, tsx for backend
- Production: Custom build script (`script/build.ts`) using esbuild for server bundling and Vite for client

## External Dependencies

### Database
- **PostgreSQL**: Required via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage for PostgreSQL

### Optional External APIs
- **Finnhub API**: Optional real-time stock price data (via `FINNHUB_API_KEY` environment variable). Falls back to simulated price updates if not configured.

### Key NPM Packages
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm** + **drizzle-zod**: Type-safe database operations
- **zod**: Runtime schema validation
- **axios**: HTTP client for external API calls
- **date-fns**: Date formatting utilities
- **react-hook-form** + **@hookform/resolvers**: Form handling with Zod integration

### UI Framework Dependencies
- Full shadcn/ui component library (Radix UI based)
- Tailwind CSS for styling
- Lucide React for icons
- Recharts for potential data visualization

## Data Synchronization

Development and production databases are separate in Replit. Use these API endpoints to sync data:

### Export Data (from any environment)
```
GET /api/export
```
Returns all ETF data as JSON. Use this on the production site to get the current data.

### Import Data (to any environment)
```
POST /api/import
Content-Type: application/json

{ "data": [...] }
```
Imports ETF data from JSON. This will **replace all existing data** in the database.

### Workflow for Syncing Production to Development:
1. Go to production site and call `GET /api/export`
2. Copy the `data` array from the response
3. Call `POST /api/import` on development with `{ "data": [copied data] }`

### Auto-Seed Feature
When the app starts with fewer than 50 ETFs in the database, it automatically seeds with the default ETF data from the seed script.