# Configurable SKU Support & Dashboard Filters

**Date**: 2026-02-24
**Status**: Approved

## Problem

The pricing tracker misses high-memory competitor configurations because:

1. **Vultr**: `vbm-64c-1536gb-amd` (EPYC 9354, 64c, 1536GB, $2,925/mo) is in the API but has 0 locations — the script skips plans with no available locations
2. **OVH**: HGR-HCI-a2 supports up to 1.5TB RAM via addons, but the script only imports the base/default RAM tier
3. **Hetzner**: AX162-S is hardcoded up to 768GB — the 1152GB RAM upgrade variant is missing
4. **Teraswitch**: Genoa 9554P can be configured to 1152GB RAM + custom NVMe — may not appear in API responses
5. **DataPacket**: EPYC 9555 base is 192GB RAM, configurable to 1536GB — only 2 hardcoded products exist

These gaps mean the rs4.metal.xlarge (64c, 1536GB, $1,799/mo) has almost no competitive comparisons.

## Approach: Hybrid (Per-Script Fixes + Schema + Dashboard)

Fix each import script to handle configurable variants, add schema fields for transparency, and add dashboard filters.

## Schema Changes

Add two fields to `CompetitorProduct`:

```prisma
model CompetitorProduct {
  // ... existing fields ...
  isConfigured      Boolean      @default(false)   // true = RAM/storage upgraded from base
  baseProductName   String?                         // links variants to their base SKU
}
```

- `isConfigured: false` = provider's standard/base offering
- `isConfigured: true` = RAM or storage upgraded from base config
- `baseProductName` groups variants (e.g., all OVH HGR-HCI-a2 RAM tiers share the same base name)
- Existing products default to `isConfigured: false` (additive migration)

## Per-Provider Import Fixes

### Vultr (`import_vultr_api.ts`)

- Remove the `locations.length === 0` skip (line 121-124)
- Plans with no locations: create a single product assigned to a generic "Vultr Global" city with `inStock: false`
- Plans with locations: keep current behavior (one product per location)
- Result: `vbm-64c-1536gb-amd` gets captured as out-of-stock

### OVH (`import_ovh_api.ts`)

- Loop over all `memoryFamily.addons` from the API (currently only takes `defaultMemory`)
- For each RAM addon: fetch its price from the catalog, add to base server price
- Create one `CompetitorProduct` per RAM tier
- Naming: `OVH-{model}-{ram}GB` (e.g., `OVH-HGR-HCI-a2-1536GB`)
- Base RAM variant: `isConfigured: false`
- Upgraded variants: `isConfigured: true`, `baseProductName` set to model name

### Hetzner (`import_hetzner.ts`)

- Build a web scraper targeting Hetzner's server configurator to extract RAM upgrade options and monthly prices
- Replace hardcoded product list with scraped data + variant expansion
- Each non-base RAM tier: `isConfigured: true`
- Target: AX162-S variants up to 1152GB (or whatever the configurator allows)

### DataPacket (`import_datapacket_api.ts`)

- Build a web scraper for DataPacket's configurator to extract RAM upgrade options and pricing
- Target the EPYC 9555 system (base 192GB) with variants up to 1536GB
- Each non-base RAM tier: `isConfigured: true`

### Teraswitch (`import_teraswitch_api.ts`)

- Verify API returns the high-RAM configs (Genoa 9554P + 1152GB)
- Mark non-base-RAM variants with `isConfigured: true`
- No major structural changes needed (already handles variants correctly)

## Dashboard UI Changes

### In-Stock / Out-of-Stock Filter

- Remove the `inStock: true` filter from comparison creation — create comparisons for all products
- Add a filter dropdown on the comparisons page:
  - **In Stock Only** (default)
  - **Out of Stock Only**
  - **All**
- Implemented as client-side filter using URL search params (shareable/bookmarkable)

### Configured SKU Indicator

- Products with `isConfigured: true` show a "Configured" badge next to the product name
- Tooltip on hover: "Upgraded configuration from base SKU ({baseProductName})"

### Comparisons Table

- New **Stock** column with green/red dot indicator
- **Configured** badge inline with product name
- Filter controls above the table

### No Changes To

- Price history page
- Latitude product management page
- Alert emails

## Out of Scope (Follow-Up)

- Adding new providers (BudgetVM, Hostkey, OpenMetal)
- Storage/network matching in spec criteria
- Multi-tier comparison layers (compute+RAM, high-memory, storage-heavy)
