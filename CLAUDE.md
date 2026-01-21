# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Latitude Pricing Tracker is a Next.js 14 application that tracks and compares Latitude.sh Gen4 bare metal server pricing against competitors (Vultr, OVHcloud, Hetzner, Teraswitch, Cherry Servers, Limestone Networks, ServersComm, DataPacket). It monitors competitive pricing positions, tracks historical price changes, and sends email alerts for significant pricing shifts.

## Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000

# Build & Production
npm run build            # Create optimized production build
npm run start            # Run production server
npm run lint             # ESLint check

# Database
npm run db:seed          # Seed database with Latitude products and cities
npm run db:reset         # Reset database (destructive)
npx prisma db push       # Push schema changes to database
npx prisma generate      # Regenerate Prisma client after schema changes

# Run scripts (data import, maintenance)
npx ts-node scripts/daily_update.ts           # Main orchestrator - updates prices, sends alerts
npx ts-node scripts/create_all_city_comparisons.ts  # Generate comparisons based on spec matching
npx ts-node scripts/import_ovh.ts             # Import OVH competitor data
npx ts-node scripts/import_vultr.ts           # Import Vultr data (from /tmp/vultr_plans.json)
npx ts-node scripts/import_teraswitch_api.ts  # Import Teraswitch via API
```

## Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router, server components)
- **Database**: PostgreSQL with Prisma ORM (Neon in production, local PostgreSQL for dev)
- **Hosting**: Vercel (auto-deploys from main branch)
- **UI**: Tailwind CSS + shadcn/ui (Radix primitives)
- **Email**: Resend API for price alerts

### Data Model (Prisma)
```
City ──1────∞── CompetitorProduct ──∞────1── Comparison ──1────∞── LatitudeProduct
                                                  │
                                            PriceHistory (tracks changes >10%)
```

Key relationships:
- `Comparison` links one `LatitudeProduct` to one `CompetitorProduct` with cascade delete
- `CompetitorProduct` belongs to a `City` and has a unique constraint on `[competitor, name, cityId]`
- `priceDifferencePercent`: positive = Latitude cheaper, negative = Latitude more expensive

### Application Structure
- `/app/page.tsx` - Dashboard with aggregate stats by competitor
- `/app/latitude/` - Latitude product management (CRUD)
- `/app/comparisons/` - Price comparisons with dual views (by SKU, by competitor)
- `/app/price-history/` - Historical price change tracking
- `/app/api/` - RESTful endpoints for all entities

### Key Patterns
- **Server Components First**: Pages fetch data directly via Prisma, no redundant API calls
- **Client Components**: Only for interactive features (forms, tabs, navigation active state)
- **Price Calculation**: `((competitorPrice - latitudePrice) / latitudePrice) * 100`
- **Thresholds**: >10% cheaper (green), ±10% competitive (amber), <-10% expensive (red)

### Scripts Architecture (`/scripts/`)
- `daily_update.ts` - Main orchestrator: captures prices, fetches updates, detects changes, sends alerts
- `import_*.ts` - Per-competitor import scripts with city/region mapping
- `create_all_city_comparisons.ts` - Generates comparisons based on spec matching criteria
- Scripts filter for modern AMD EPYC CPUs (4xxx Raphael/Bergamo, 9xxx Genoa/Turin)

### Component Organization
- `/components/ui/` - shadcn/ui primitives (button, card, dialog, table, etc.)
- `/components/forms/` - Modal forms for CRUD (LatitudeProductForm, CompetitorProductForm, ComparisonForm, DeleteButton)
- `/components/layout/` - Navigation sidebar
- `/components/product-tooltip.tsx` - Spec details on hover

### Utility Functions (`/lib/`)
- `calculations.ts` - Price difference, spec similarity, formatting, color coding
- `email.ts` - Resend API integration for price alerts
- `prisma.ts` - Singleton Prisma client

## Deployment

### Production (Vercel + Neon)
- Hosted on Vercel, auto-deploys from `main` branch
- Production database on Neon (PostgreSQL)
- Deploy manually: `vercel --prod`

### Database Migrations
When schema changes are made, push to production database:
```bash
# Production DATABASE_URL is stored in .env as DATABASE_URL_PROD
DATABASE_URL=$DATABASE_URL_PROD npx prisma db push
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string (local dev uses localhost, prod uses Neon)
- `RESEND_API_KEY` - (Optional) For email alerts on price changes >10%

### API Keys (in `.env`)
- `LATITUDE_API_KEY` - Latitude.sh API for regional pricing
- `OVH_APP_KEY`, `OVH_APP_SECRET`, `OVH_CONSUMER_KEY` - OVH API credentials
- `TERASWITCH_API_KEY`, `TERASWITCH_API_SECRET` - Teraswitch API credentials

## Important Notes

- Comparisons filter for `inStock: true` products only
- OVH products currently marked as out of stock ("Soon available" on website)
- Price history only records changes exceeding 10% threshold
- UI uses dark mode by default with Latitude.sh-inspired color scheme
- Path alias `@/*` maps to project root for imports
