# Configurable SKU Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture configurable/high-memory competitor SKUs that currently fall through the tracker's import logic, and add stock/configured filters to the dashboard.

**Architecture:** Schema gets two new fields (`isConfigured`, `baseProductName`) on `CompetitorProduct`. Each import script is fixed independently to handle configurable RAM variants. Dashboard gets a stock filter dropdown and a "Configured" badge. See `docs/plans/2026-02-24-configurable-skus-design.md` for full design.

**Tech Stack:** Next.js 14, Prisma/PostgreSQL, TypeScript, shadcn/ui, Vultr/OVH/Teraswitch APIs, Hetzner/DataPacket web scraping

---

### Task 1: Schema Migration — Add `isConfigured` and `baseProductName`

**Files:**
- Modify: `prisma/schema.prisma:49-73`

**Step 1: Add new fields to CompetitorProduct model**

In `prisma/schema.prisma`, add after the `quantity` field (line 68):

```prisma
  isConfigured       Boolean      @default(false)
  baseProductName    String?
```

**Step 2: Push schema to local database**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your schema."

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add isConfigured and baseProductName to CompetitorProduct"
```

---

### Task 2: Fix Vultr Import — Capture Plans With 0 Locations

**Files:**
- Modify: `scripts/import_vultr_api.ts:120-189`

**Step 1: Replace the location-skip logic**

In `import_vultr_api.ts`, replace lines 120-189 (the main `for (const plan of modernPlans)` loop body) with logic that:

1. If `plan.locations.length === 0`:
   - Get or create a city with code `vultr-global`, name `Global`, country `USA`
   - Create a single product with `inStock: false`, `isConfigured: false`
2. If `plan.locations.length > 0`:
   - Keep existing per-location behavior
   - Set `isConfigured: false` on all products

The key change is removing this block (lines 121-124):
```typescript
// REMOVE THIS:
if (plan.locations.length === 0) {
  console.log(`  Skipping ${plan.id} - no available locations`)
  continue
}
```

And replacing it with:
```typescript
if (plan.locations.length === 0) {
  // Import plans with no locations as out-of-stock global products
  const cityCode = 'vultr-global'
  let city = await prisma.city.findUnique({ where: { code: cityCode } })
  if (!city) {
    city = await prisma.city.create({
      data: { code: cityCode, name: 'Global', country: 'USA' }
    })
  }

  const ramGB = Math.round(plan.ram / 1024)
  const totalStorageGB = plan.disk * plan.disk_count
  const totalStorageTB = totalStorageGB / 1000
  const cpuDescription = `AMD ${plan.cpu_model} (${plan.cpu_cores}c/${plan.cpu_threads}t @ ${(plan.cpu_mhz / 1000).toFixed(1)}GHz)`
  const productName = `Vultr-${plan.cpu_model.replace(/\s+/g, '-')}-${ramGB}GB`

  await prisma.competitorProduct.create({
    data: {
      competitor: 'VULTR',
      name: productName,
      cpu: cpuDescription,
      cpuCores: plan.cpu_cores,
      ram: ramGB,
      storageDescription: `${plan.disk_count}x ${plan.disk}GB ${plan.type}`,
      storageTotalTB: totalStorageTB,
      networkGbps: 10,
      priceUsd: plan.monthly_cost,
      cityId: city.id,
      sourceUrl: 'https://www.vultr.com/products/bare-metal/',
      inStock: false,
      isConfigured: false,
      lastInventoryCheck: new Date(),
      lastVerified: new Date(),
    }
  })

  createdProducts.push({
    name: productName,
    cpu: plan.cpu_model,
    cores: plan.cpu_cores,
    ram: ramGB,
    price: plan.monthly_cost,
    city: 'Global',
    country: 'USA',
  })
  totalCreated++
  console.log(`  Created ${productName} as out-of-stock (no available locations)`)
  continue
}
```

Also add `isConfigured: false` to the existing `prisma.competitorProduct.create` call at line 160.

**Step 2: Verify the script runs**

Run: `npx ts-node scripts/import_vultr_api.ts`
Expected: Should show `vbm-64c-1536gb-amd` being created as out-of-stock instead of "Skipping"

**Step 3: Commit**

```bash
git add scripts/import_vultr_api.ts
git commit -m "fix(vultr): import plans with 0 locations as out-of-stock products"
```

---

### Task 3: Fix OVH Import — Generate RAM Addon Variants

**Files:**
- Modify: `scripts/import_ovh_api.ts:408-539`

**Step 1: Understand the OVH addon pricing structure**

The OVH catalog API returns `addonFamilies` for each plan. The `memory` family contains addon codes like `ram-128g-ecc-4800-26scaleamd01-v2`. Each addon has its own pricing in the catalog under `/order/catalog/public/baremetalServers`.

The current code (line 409-412) only takes `defaultMemory`. We need to:
1. Fetch addon pricing from the catalog for each memory addon
2. Calculate total price = base server price + (memory addon price - default memory addon price)
3. Create a product for each RAM tier

**Step 2: Add addon price lookup function**

Add this function before `main()`:

```typescript
function getAddonPrice(allPlans: OvhPlan[], addonCode: string): number {
  // Search all plans for addon pricing
  for (const plan of allPlans) {
    if (plan.planCode === addonCode) {
      const monthly = plan.pricings.find(p =>
        p.intervalUnit === 'month' &&
        p.capacities.includes('renew') &&
        p.commitment === 0 &&
        p.mode === 'default'
      )
      if (monthly) {
        return monthly.price / 100000000 // Convert from OVH units to CAD
      }
    }
  }
  return 0
}
```

Note: OVH addons may be in the catalog `addons` array, not `plans`. The actual implementation should check the catalog response structure. The catalog endpoint returns `{ plans: [...], addons: [...] }`. We need to also fetch and parse the `addons` array.

**Step 3: Modify the catalog fetch to include addons**

Update `fetchCatalog()` to return both plans and addons:

```typescript
async function fetchCatalog(): Promise<{ plans: OvhPlan[]; addons: any[] }> {
  console.log('Fetching OVH baremetalServers catalog...')
  const catalog = await ovhRequest('GET', '/order/catalog/public/baremetalServers?ovhSubsidiary=CA')
  return { plans: catalog.plans || [], addons: catalog.addons || [] }
}
```

**Step 4: Replace the single-RAM product creation with multi-RAM loop**

In the main product creation section (after line 412), replace the single product creation with a loop over all memory addons:

```typescript
// Get all memory options and their prices
const memoryFamily = basePlan.addonFamilies.find((f: { name: string }) => f.name === 'memory')
const memoryAddons = memoryFamily?.addons || []
const defaultMemoryAddon = memoryFamily?.default || memoryAddons[0]
const defaultRam = defaultMemoryAddon ? parseMemoryFromAddon(defaultMemoryAddon) : 128

// Get default memory addon price for delta calculation
const defaultMemoryPrice = getAddonPriceFromCatalog(catalogAddons, defaultMemoryAddon) * CAD_TO_USD

// Process each memory option
for (const memoryAddonCode of memoryAddons) {
  const ram = parseMemoryFromAddon(memoryAddonCode)
  if (ram === 0) continue

  const isBase = memoryAddonCode === defaultMemoryAddon
  const memoryAddonPrice = getAddonPriceFromCatalog(catalogAddons, memoryAddonCode) * CAD_TO_USD
  const ramPriceDelta = Math.round(memoryAddonPrice - defaultMemoryPrice)

  // Create product for each datacenter with this RAM config
  for (const [dcCode, avail] of Array.from(dcAvailability.entries())) {
    // ... existing DC logic ...
    const adjustedPrice = priceUsd + ramPriceDelta

    const productName = `${series.toUpperCase()} (${product}) ${ram}GB`

    await prisma.competitorProduct.create({
      data: {
        // ... existing fields ...
        ram: ram,
        priceUsd: adjustedPrice,
        name: productName,
        isConfigured: !isBase,
        baseProductName: isBase ? null : `${series.toUpperCase()} (${product})`,
      }
    })
  }
}
```

**Step 5: Verify the script runs**

Run: `npx ts-node scripts/import_ovh_api.ts`
Expected: Should show multiple RAM variants per OVH server model (e.g., SCALE-A6 128GB, SCALE-A6 256GB, SCALE-A6 512GB)

**Step 6: Commit**

```bash
git add scripts/import_ovh_api.ts
git commit -m "feat(ovh): import all RAM addon variants with calculated pricing"
```

---

### Task 4: Fix Hetzner Import — Add 1152GB RAM Variant & Scrape Configurator

**Files:**
- Modify: `scripts/import_hetzner.ts:15-120`

**Step 1: Research Hetzner configurator pricing**

Hetzner's server configurator is at `https://www.hetzner.com/dedicated-rootserver/ax162-s/configurator/`. We need to scrape RAM upgrade prices.

However, Hetzner's configurator may be JavaScript-rendered. As a pragmatic first step, we can:
1. Check if the configurator page has static HTML with RAM pricing
2. If not, extend the hardcoded list with the 1152GB variant based on Hetzner's known pricing pattern

The current hardcoded pattern shows RAM pricing increments:
- 128GB base: $215/mo
- 256GB: $275/mo (+$60)
- 512GB: $395/mo (+$120 from 256)
- 768GB: $515/mo (+$120 from 512)

Extrapolating: 1024GB ≈ $635/mo, 1152GB ≈ $695/mo

**Step 2: Add 1152GB and 1024GB variants to HETZNER_PRODUCTS**

Add after the AX162-S-768GB entry (line 89):

```typescript
{
  name: 'AX162-S-1024GB',
  cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
  cpuCores: 48,
  ram: 1024,
  storageDescription: '2x 3.84TB NVMe SSD Gen4 RAID1',
  storageTotalTB: 3.84,
  networkGbps: 1,
  priceUsd: 635, // Estimated from RAM pricing pattern
  isConfigured: true,
  baseProductName: 'AX162-S',
},
{
  name: 'AX162-S-1152GB',
  cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
  cpuCores: 48,
  ram: 1152,
  storageDescription: '2x 3.84TB NVMe SSD Gen4 RAID1',
  storageTotalTB: 3.84,
  networkGbps: 1,
  priceUsd: 695, // Estimated from RAM pricing pattern
  isConfigured: true,
  baseProductName: 'AX162-S',
},
```

Also add `isConfigured` and `baseProductName` fields to the interface and the existing hardcoded products (set `isConfigured: false` for base configs, `isConfigured: true` + `baseProductName` for existing RAM variants like AX162-S-256GB, AX162-S-512GB, AX162-S-768GB).

**Step 3: Update the product creation to pass new fields**

In the `for (const product of HETZNER_PRODUCTS)` loop (lines 150-168), add the new fields to the `prisma.competitorProduct.create` call:

```typescript
isConfigured: product.isConfigured || false,
baseProductName: product.baseProductName || null,
```

**Step 4: Build Hetzner configurator scraper (follow-up)**

Create a new script `scripts/scrape_hetzner_configurator.ts` that:
1. Fetches `https://www.hetzner.com/dedicated-rootserver/ax162-s/configurator/`
2. Parses RAM options and prices from the HTML
3. Outputs the data for verification

This can be a follow-up task since the hardcoded approach gives us immediate coverage.

**Step 5: Verify the script runs**

Run: `npx ts-node scripts/import_hetzner.ts`
Expected: Should show AX162-S-1024GB and AX162-S-1152GB being created

**Step 6: Commit**

```bash
git add scripts/import_hetzner.ts
git commit -m "feat(hetzner): add 1024GB and 1152GB RAM variants for AX162-S"
```

---

### Task 5: Fix DataPacket Import — Handle Configurable RAM

**Files:**
- Modify: `scripts/import_datapacket_api.ts:161-264`

**Step 1: Investigate DataPacket API for RAM options**

The DataPacket GraphQL API (`import_datapacket_api.ts`) already fetches `provisioningConfigurations` which returns `memory` as a single number. The API may not expose RAM upgrade options directly.

Check if the GraphQL schema has a `memoryOptions` or `customization` field:

```graphql
{
  provisioningConfigurations {
    configurationId
    memory
    # Check for these fields:
    # memoryOptions { size monthlyPrice }
    # customizations { memory { options { size price } } }
  }
}
```

**Step 2: If API doesn't expose RAM options, add hardcoded variants**

Based on user research, the EPYC 9555 is available with base 192GB configurable to 1536GB. DataPacket's pricing for RAM upgrades needs to be researched.

Add a RAM multiplier approach — after fetching base configs, generate additional variants:

```typescript
// RAM upgrade tiers for EPYC 9555 (64-core) based on DataPacket configurator
const RAM_UPGRADE_TIERS: Record<string, { sizes: number[]; pricePerGB: number }> = {
  'EPYC 9555': { sizes: [192, 384, 768, 1024, 1536], pricePerGB: 2.5 }, // ~$2.50/GB/mo estimated
  'EPYC 9554': { sizes: [128, 256, 512, 768, 1024, 1536], pricePerGB: 2.5 },
}
```

For each base config found, check if there's an upgrade tier defined, and create additional products for each RAM size above the base.

**Step 3: Mark configured variants**

For each generated RAM variant:
```typescript
isConfigured: ramSize > baseRam,
baseProductName: ramSize > baseRam ? `${cpu.name}-${baseRam}GB` : null,
```

**Step 4: Verify the script runs**

Run: `npx ts-node scripts/import_datapacket_api.ts`
Expected: Should show additional RAM variants for EPYC 9555

**Step 5: Commit**

```bash
git add scripts/import_datapacket_api.ts
git commit -m "feat(datapacket): add configurable RAM variants for high-memory EPYC systems"
```

---

### Task 6: Fix Teraswitch Import — Mark Configured Variants

**Files:**
- Modify: `scripts/import_teraswitch_api.ts:148-208`

**Step 1: Add isConfigured flag based on default memory**

In the product creation loop (lines 148-208), determine if the RAM option is the default:

```typescript
const isDefaultRam = item.tier.memoryOptions.find(m => m.default)?.gb === item.memoryGb
```

Then add to the `prisma.competitorProduct.create` call:

```typescript
isConfigured: !isDefaultRam,
baseProductName: isDefaultRam ? null : `TS-${item.tier.cpu.replace(/AMD EPYC /, '').replace(/ /g, '-')}`,
```

**Step 2: Verify the script runs**

Run: `npx ts-node scripts/import_teraswitch_api.ts`
Expected: Products with non-default RAM should show `isConfigured: true`

**Step 3: Commit**

```bash
git add scripts/import_teraswitch_api.ts
git commit -m "feat(teraswitch): mark non-default RAM configurations with isConfigured flag"
```

---

### Task 7: Update Daily Update Script — Pass isConfigured in Comparisons

**Files:**
- Modify: `scripts/daily_update.ts`
- Modify: `scripts/create_all_city_comparisons.ts:130-157`

**Step 1: Update create_all_city_comparisons.ts**

The comparison creation at line 150-157 currently doesn't filter by `inStock`. This is already correct per design (we want all products in comparisons). No filtering change needed.

Verify the comparison creation includes `isConfigured` products by checking the filter doesn't exclude them. Current filter (lines 150-156):

```typescript
const matches = competitorProducts.filter(cp =>
  cp.cpuCores >= criteria.minCores &&
  cp.cpuCores <= criteria.maxCores &&
  cp.ram >= criteria.minRam &&
  cp.ram <= criteria.maxRam &&
  isLatitudeCity(cp.city.name, cp.city.country) &&
  isModernEpyc(cp.cpu)
)
```

This already doesn't filter on `isConfigured`, so configured variants will match. No change needed here.

**Step 2: Update daily_update.ts Teraswitch section**

The daily update creates Teraswitch products inline. Add `isConfigured` and `baseProductName` fields to its product creation, matching the same logic as Task 6.

**Step 3: Commit**

```bash
git add scripts/daily_update.ts scripts/create_all_city_comparisons.ts
git commit -m "feat(daily-update): pass isConfigured flag in Teraswitch daily update"
```

---

### Task 8: Dashboard — Add Stock Filter Dropdown

**Files:**
- Modify: `app/(authenticated)/comparisons/comparisons-tabs.tsx`

**Step 1: Add stock filter state**

Near the existing filter state declarations (around line 121-128), add:

```typescript
const [stockFilter, setStockFilter] = useState<'in-stock' | 'out-of-stock' | 'all'>('all')
```

**Step 2: Add stock filter logic to existing filter functions**

In `getFilteredComparisons` (lines 244-260) and `getFilteredComparisonsByCompetitor` (lines 263-279), add stock filtering:

```typescript
// After existing filters, add:
if (stockFilter === 'in-stock') {
  filtered = filtered.filter(c => c.competitorProduct.inStock)
} else if (stockFilter === 'out-of-stock') {
  filtered = filtered.filter(c => !c.competitorProduct.inStock)
}
```

Also apply to `sortedFlatComparisons` memo.

**Step 3: Add stock filter dropdown to the UI**

Add a Select dropdown next to the existing view mode toggle (around line 432-455):

```tsx
<Select value={stockFilter} onValueChange={(v) => setStockFilter(v as any)}>
  <SelectTrigger className="w-[160px]">
    <SelectValue placeholder="Stock status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Products</SelectItem>
    <SelectItem value="in-stock">In Stock Only</SelectItem>
    <SelectItem value="out-of-stock">Out of Stock Only</SelectItem>
  </SelectContent>
</Select>
```

**Step 4: Verify the filter works in dev**

Run: `npm run dev`
Navigate to `/comparisons` and toggle the stock filter.

**Step 5: Commit**

```bash
git add app/\(authenticated\)/comparisons/comparisons-tabs.tsx
git commit -m "feat(dashboard): add stock status filter to comparisons page"
```

---

### Task 9: Dashboard — Add "Configured" Badge

**Files:**
- Modify: `app/(authenticated)/comparisons/comparisons-tabs.tsx`
- Modify: `app/(authenticated)/comparisons/page.tsx` (to pass new fields)

**Step 1: Update the Prisma query to include new fields**

In `comparisons/page.tsx`, the server component fetches comparisons. Ensure the query includes `isConfigured` and `baseProductName` on `competitorProduct`. Prisma should already include these since it fetches all fields by default, but verify.

**Step 2: Add "Configured" badge to product name display**

In `comparisons-tabs.tsx`, find each place where `competitorProduct.name` is displayed (in all three table views). Add a badge after the product name:

```tsx
<span className="flex items-center gap-1.5">
  <ProductTooltip product={comparison.competitorProduct} />
  {comparison.competitorProduct.isConfigured && (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 whitespace-nowrap"
      title={`Configured from base SKU: ${comparison.competitorProduct.baseProductName}`}
    >
      Configured
    </span>
  )}
</span>
```

Apply this in all three table views:
1. "By Latitude SKU" view — product column (around line 600)
2. "By Competitor" view — competitor product column (around line 810)
3. Position filter flat list — competitor product column (around line 375)

**Step 3: Verify badge displays in dev**

Run: `npm run dev`
Navigate to `/comparisons`. Any products with `isConfigured: true` should show the orange "Configured" badge.

**Step 4: Commit**

```bash
git add app/\(authenticated\)/comparisons/comparisons-tabs.tsx app/\(authenticated\)/comparisons/page.tsx
git commit -m "feat(dashboard): add Configured badge to competitor products in comparisons"
```

---

### Task 10: Push Schema to Production & Run Updated Imports

**Step 1: Push schema changes to production database**

```bash
DATABASE_URL=$DATABASE_URL_PROD npx prisma db push
```

Expected: "Your database is now in sync with your schema."

**Step 2: Run import scripts in order**

```bash
npx ts-node scripts/import_vultr_api.ts
npx ts-node scripts/import_ovh_api.ts
npx ts-node scripts/import_hetzner.ts
npx ts-node scripts/import_datapacket_api.ts
npx ts-node scripts/import_teraswitch_api.ts
```

**Step 3: Regenerate comparisons**

```bash
npx ts-node scripts/create_all_city_comparisons.ts
```

Expected: rs4.metal.xlarge should now show matches from Vultr (vbm-64c-1536gb-amd), OVH high-RAM variants, Hetzner AX162-S-1152GB, etc.

**Step 4: Deploy to Vercel**

```bash
git push origin main
```

Vercel auto-deploys from main.

**Step 5: Verify on production**

Visit https://latitude-pricing-tracker.vercel.app/comparisons and confirm:
- New products appear
- Stock filter works
- Configured badges display correctly
- rs4.metal.xlarge has competitive comparisons
