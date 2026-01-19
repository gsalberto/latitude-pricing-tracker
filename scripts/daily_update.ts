import { PrismaClient, Competitor } from '@prisma/client'
import { Resend } from 'resend'

const prisma = new PrismaClient()

// Email configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY
const ALERT_RECIPIENTS = [
  'guilherme@latitude.sh',
  'ricardo.bortolansa@latitude.sh',
  'rafael.ribeiro@latitude.sh',
]

interface PriceChange {
  competitor: string
  productName: string
  cityName: string
  oldPrice: number
  newPrice: number
  changePercent: number
}

// Store previous prices before update
interface PreviousPrice {
  competitor: Competitor
  name: string
  cityName: string
  priceUsd: number
}

const TERASWITCH_API_KEY = '276b9cec61704fc89524218a1deb161b'
const TERASWITCH_API_SECRET = '2BG6VuwgWMy7FySt'
const TERASWITCH_API_URL = 'https://api.tsw.io'

// Teraswitch cities with their region codes (consolidated by city)
const TERASWITCH_CITIES = [
  // USA
  { cityCode: 'DAL', name: 'Dallas', country: 'USA', regions: ['DAL1'] },
  { cityCode: 'LAX', name: 'Los Angeles', country: 'USA', regions: ['LAX1'] },
  { cityCode: 'CHI', name: 'Chicago', country: 'USA', regions: ['CHI1'] },
  { cityCode: 'IAD', name: 'Ashburn', country: 'USA', regions: ['IAD2'] },
  { cityCode: 'MIA', name: 'Miami', country: 'USA', regions: ['MIA1'] },
  { cityCode: 'EWR', name: 'New York', country: 'USA', regions: ['EWR1', 'EWR2'] },
  // Europe
  { cityCode: 'AMS', name: 'Amsterdam', country: 'Netherlands', regions: ['AMS1', 'AMS2', 'AMS3'] },
  { cityCode: 'FRA', name: 'Frankfurt', country: 'Germany', regions: ['FRA1', 'FRA2'] },
  { cityCode: 'LON', name: 'London', country: 'UK', regions: ['LON1'] },
  // LATAM
  { cityCode: 'SAO', name: 'São Paulo', country: 'Brazil', regions: ['SAO1'] },
  // Asia Pacific
  { cityCode: 'SGP', name: 'Singapore', country: 'Singapore', regions: ['SGP1', 'SGP2'] },
  { cityCode: 'TYO', name: 'Tokyo', country: 'Japan', regions: ['TYO1', 'TYO2', 'TYO3'] },
]

// Latitude cities
const LATITUDE_CITIES = [
  { name: 'Ashburn', country: 'USA' },
  { name: 'Chicago', country: 'USA' },
  { name: 'Dallas', country: 'USA' },
  { name: 'Los Angeles', country: 'USA' },
  { name: 'Miami', country: 'USA' },
  { name: 'New York', country: 'USA' },
  { name: 'Mexico City', country: 'Mexico' },
  { name: 'Bogota', country: 'Colombia' },
  { name: 'São Paulo', country: 'Brazil' },
  { name: 'Buenos Aires', country: 'Argentina' },
  { name: 'Santiago', country: 'Chile' },
  { name: 'Amsterdam', country: 'Netherlands' },
  { name: 'Frankfurt', country: 'Germany' },
  { name: 'London', country: 'UK' },
  { name: 'Singapore', country: 'Singapore' },
  { name: 'Sydney', country: 'Australia' },
  { name: 'Tokyo', country: 'Japan' },
]

const latitudeCitySet = new Set(
  LATITUDE_CITIES.map(c => `${c.name.toLowerCase()}-${c.country.toLowerCase()}`)
)

function isLatitudeCity(cityName: string, country: string): boolean {
  return latitudeCitySet.has(`${cityName.toLowerCase()}-${country.toLowerCase()}`)
}

function isModernEpyc(cpu: string): boolean {
  const cpuLower = cpu.toLowerCase()
  if (cpuLower.includes('epyc')) {
    // EPYC 9xxx series (Genoa, Turin)
    if (/epyc[- _]?9\d{3}/.test(cpuLower)) return true
    // EPYC 4xxx series (Raphael/Bergamo - SP6 socket)
    if (/epyc[- _]?4\d{3}/.test(cpuLower)) return true
    // Explicit naming
    if (cpuLower.includes('genoa')) return true
    if (cpuLower.includes('turin')) return true
    if (cpuLower.includes('raphael')) return true
    if (cpuLower.includes('bergamo')) return true
  }
  return false
}

function parseCores(cpuDescription: string): number {
  const match = cpuDescription.match(/(\d+)c/)
  return match ? parseInt(match[1], 10) : 0
}

interface MatchCriteria {
  minCores: number
  maxCores: number
  minRam: number
  maxRam: number
}

// Latitude products with their matching criteria (±25% of actual specs)
const latitudeMatchCriteria: Record<string, MatchCriteria> = {
  'm4.metal.small': { minCores: 5, maxCores: 8, minRam: 48, maxRam: 80 },
  'm4.metal.medium': { minCores: 12, maxCores: 20, minRam: 96, maxRam: 160 },
  'm4.metal.large': { minCores: 20, maxCores: 30, minRam: 288, maxRam: 480 },
  'm4.metal.xlarge': { minCores: 40, maxCores: 60, minRam: 576, maxRam: 960 },
  'f4.metal.small': { minCores: 10, maxCores: 16, minRam: 72, maxRam: 120 },
  'f4.metal.medium': { minCores: 12, maxCores: 20, minRam: 144, maxRam: 240 },
  'f4.metal.large': { minCores: 20, maxCores: 30, minRam: 576, maxRam: 960 },
  'rs4.metal.large': { minCores: 26, maxCores: 40, minRam: 576, maxRam: 960 },
  'rs4.metal.xlarge': { minCores: 52, maxCores: 80, minRam: 1152, maxRam: 1920 },
}

interface MemoryOption {
  gb: number
  monthlyPrice: number
  default: boolean
}

interface DriveOption {
  name: string
  type: string
  capacityGb: number
  monthlyPrice: number
  default: boolean
}

interface DriveSlot {
  id: string
  default: string
  options: DriveOption[]
}

interface Tier {
  id: string
  cpu: string
  cpuDescription: string
  memoryOptions: MemoryOption[]
  driveSlots: DriveSlot[]
  monthlyPrice: number
}

interface AvailabilityItem {
  tier: Tier
  memoryGb: number
  quantity: number
  disks: Record<string, string>
}

interface ApiResponse {
  success: boolean
  result: AvailabilityItem[]
  message?: string
}

function calculateStorageTB(driveSlots: DriveSlot[], disks: Record<string, string>): { description: string; totalTB: number } {
  let totalGB = 0
  const parts: string[] = []

  for (const slot of driveSlots) {
    const selectedDisk = disks[slot.id] || slot.default
    const option = slot.options.find(o => o.name === selectedDisk) || slot.options.find(o => o.default)
    if (option) {
      totalGB += option.capacityGb
      parts.push(`${option.name} ${option.type}`)
    }
  }

  return {
    description: parts.join(' + ') || 'Not specified',
    totalTB: totalGB / 1000
  }
}

async function fetchAvailability(region: string): Promise<AvailabilityItem[]> {
  const response = await fetch(`${TERASWITCH_API_URL}/v2/Metal/Availability?Region=${region}`, {
    headers: {
      'Authorization': `Bearer ${TERASWITCH_API_KEY}:${TERASWITCH_API_SECRET}`
    }
  })

  const data: ApiResponse = await response.json()

  if (!data.success) {
    return []
  }

  return data.result || []
}

async function updateTeraswitch(): Promise<number> {
  console.log('\n=== Updating Teraswitch inventory ===\n')

  // Clear existing Teraswitch products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'TERASWITCH' }
  })
  console.log(`Deleted ${deleted.count} existing Teraswitch products`)

  let totalCreated = 0

  for (const cityConfig of TERASWITCH_CITIES) {
    // Collect products from all regions in this city
    const allProducts: Map<string, { item: AvailabilityItem; cores: number; storage: { description: string; totalTB: number }; totalPrice: number }> = new Map()

    for (const regionCode of cityConfig.regions) {
      const availability = await fetchAvailability(regionCode)
      const genoaProducts = availability.filter(item => isModernEpyc(item.tier.cpu))

      for (const item of genoaProducts) {
        const cores = parseCores(item.tier.cpuDescription)
        const storage = calculateStorageTB(item.tier.driveSlots, item.disks)
        const ramOption = item.tier.memoryOptions.find(m => m.gb === item.memoryGb)
        const ramAddon = ramOption?.monthlyPrice || 0
        const totalPrice = Math.round(item.tier.monthlyPrice + ramAddon)
        const productName = `TS-${item.tier.cpu.replace(/AMD EPYC /, '').replace(/ /g, '-')}-${item.memoryGb}GB`

        // Only keep one instance per product name (consolidate across regions)
        if (!allProducts.has(productName)) {
          allProducts.set(productName, { item, cores, storage, totalPrice })
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (allProducts.size === 0) {
      continue
    }

    // Get or create consolidated city
    let city = await prisma.city.findUnique({
      where: { code: `teraswitch-${cityConfig.cityCode}` }
    })

    if (!city) {
      city = await prisma.city.create({
        data: {
          code: `teraswitch-${cityConfig.cityCode}`,
          name: cityConfig.name,
          country: cityConfig.country,
        }
      })
    }

    // Create products for this city
    for (const [productName, data] of Array.from(allProducts.entries())) {
      await prisma.competitorProduct.create({
        data: {
          competitor: 'TERASWITCH',
          name: productName,
          cpu: `${data.item.tier.cpu} (${data.item.tier.cpuDescription})`,
          cpuCores: data.cores,
          ram: data.item.memoryGb,
          storageDescription: data.storage.description,
          storageTotalTB: data.storage.totalTB,
          networkGbps: 25,
          priceUsd: data.totalPrice,
          cityId: city.id,
          sourceUrl: 'https://teraswitch.com/bare-metal/',
          inStock: data.item.quantity > 0,
          quantity: data.item.quantity,
          lastVerified: new Date(),
        }
      })
      totalCreated++
    }

    console.log(`  ${cityConfig.name}: ${allProducts.size} unique Genoa products`)
  }

  console.log(`Created ${totalCreated} new Teraswitch products`)
  return totalCreated
}

async function updateComparisons(): Promise<number> {
  console.log('\n=== Updating comparisons ===\n')

  // Delete existing comparisons
  await prisma.comparison.deleteMany({})

  const latitudeProducts = await prisma.latitudeProduct.findMany()
  const competitorProducts = await prisma.competitorProduct.findMany({
    include: { city: true }
  })

  let created = 0

  for (const latProduct of latitudeProducts) {
    const criteria = latitudeMatchCriteria[latProduct.name]
    if (!criteria) continue

    // Include out-of-stock products for tracking purposes
    const matches = competitorProducts.filter(cp =>
      cp.cpuCores >= criteria.minCores &&
      cp.cpuCores <= criteria.maxCores &&
      cp.ram >= criteria.minRam &&
      cp.ram <= criteria.maxRam &&
      isLatitudeCity(cp.city.name, cp.city.country) &&
      isModernEpyc(cp.cpu)
    )

    for (const compProduct of matches) {
      const priceDiff = ((compProduct.priceUsd - latProduct.priceUsd) / latProduct.priceUsd) * 100

      await prisma.comparison.create({
        data: {
          latitudeProductId: latProduct.id,
          competitorProductId: compProduct.id,
          priceDifferencePercent: priceDiff,
          notes: `Auto-matched: ${compProduct.cpuCores} cores, ${compProduct.ram}GB RAM`,
        }
      })
      created++
    }
  }

  console.log(`Created ${created} comparisons`)
  return created
}

async function getPreviousPrices(): Promise<Map<string, PreviousPrice>> {
  const products = await prisma.competitorProduct.findMany({
    include: { city: true }
  })

  const priceMap = new Map<string, PreviousPrice>()
  for (const p of products) {
    const key = `${p.competitor}-${p.name}-${p.city.name}`
    priceMap.set(key, {
      competitor: p.competitor,
      name: p.name,
      cityName: p.city.name,
      priceUsd: p.priceUsd
    })
  }

  return priceMap
}

async function detectPriceChanges(previousPrices: Map<string, PreviousPrice>): Promise<PriceChange[]> {
  const currentProducts = await prisma.competitorProduct.findMany({
    include: { city: true }
  })

  const changes: PriceChange[] = []

  for (const product of currentProducts) {
    const key = `${product.competitor}-${product.name}-${product.city.name}`
    const previous = previousPrices.get(key)

    if (previous) {
      const changePercent = ((product.priceUsd - previous.priceUsd) / previous.priceUsd) * 100

      // Only report changes > 10%
      if (Math.abs(changePercent) > 10) {
        changes.push({
          competitor: product.competitor,
          productName: product.name,
          cityName: product.city.name,
          oldPrice: previous.priceUsd,
          newPrice: product.priceUsd,
          changePercent
        })

        // Record in price history
        await prisma.priceHistory.create({
          data: {
            competitorProductId: product.id,
            competitor: product.competitor,
            productName: product.name,
            cityName: product.city.name,
            oldPrice: previous.priceUsd,
            newPrice: product.priceUsd,
            changePercent
          }
        })
      }
    }
  }

  return changes
}

async function sendPriceAlertEmail(priceChanges: PriceChange[]) {
  if (priceChanges.length === 0) return

  console.log(`\n=== Price Changes Detected ===`)
  priceChanges.forEach(change => {
    const direction = change.changePercent > 0 ? 'increased' : 'decreased'
    console.log(`  ${change.competitor} ${change.productName} (${change.cityName}): $${change.oldPrice} → $${change.newPrice} (${direction} ${Math.abs(change.changePercent).toFixed(1)}%)`)
  })

  if (!RESEND_API_KEY) {
    console.log('\nRESEND_API_KEY not set, skipping email notification')
    return
  }

  const resend = new Resend(RESEND_API_KEY)

  const increases = priceChanges.filter(c => c.changePercent > 0)
  const decreases = priceChanges.filter(c => c.changePercent < 0)

  const formatChange = (change: PriceChange) => {
    const direction = change.changePercent > 0 ? '📈' : '📉'
    const color = change.changePercent > 0 ? '#dc2626' : '#16a34a'
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${change.competitor}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${change.productName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${change.cityName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${change.oldPrice}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${change.newPrice}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${color}; font-weight: bold;">
          ${direction} ${change.changePercent > 0 ? '+' : ''}${change.changePercent.toFixed(1)}%
        </td>
      </tr>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th { background: #f3f4f6; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb; }
        h2 { color: #374151; margin-top: 24px; }
        .summary { background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>Competitor Price Alert</h1>

      <div class="summary">
        <p><strong>${priceChanges.length}</strong> competitor SKU(s) changed price by more than 10%:</p>
        <ul>
          ${increases.length > 0 ? `<li>📈 <strong>${increases.length}</strong> price increase(s)</li>` : ''}
          ${decreases.length > 0 ? `<li>📉 <strong>${decreases.length}</strong> price decrease(s)</li>` : ''}
        </ul>
      </div>

      ${increases.length > 0 ? `
        <h2>📈 Price Increases</h2>
        <table>
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Product</th>
              <th>City</th>
              <th>Old Price</th>
              <th>New Price</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            ${increases.map(formatChange).join('')}
          </tbody>
        </table>
      ` : ''}

      ${decreases.length > 0 ? `
        <h2>📉 Price Decreases</h2>
        <table>
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Product</th>
              <th>City</th>
              <th>Old Price</th>
              <th>New Price</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            ${decreases.map(formatChange).join('')}
          </tbody>
        </table>
      ` : ''}

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        This alert was generated by the Latitude Pricing Tracker.
      </p>
    </body>
    </html>
  `

  try {
    const { error } = await resend.emails.send({
      from: 'Latitude Pricing Tracker <onboarding@resend.dev>',
      to: ALERT_RECIPIENTS,
      subject: `Price Alert: ${priceChanges.length} competitor SKU(s) changed by >10%`,
      html,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return
    }

    console.log(`\nEmail sent to: ${ALERT_RECIPIENTS.join(', ')}`)
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}

async function main() {
  const startTime = new Date()
  console.log(`\n========================================`)
  console.log(`Daily Update - ${startTime.toISOString()}`)
  console.log(`========================================`)

  try {
    // Get current prices before update (for comparison)
    const previousPrices = await getPreviousPrices()
    console.log(`Captured ${previousPrices.size} previous prices for comparison`)

    // Update Teraswitch from API
    const teraswitchProducts = await updateTeraswitch()

    // Detect price changes > 10%
    const priceChanges = await detectPriceChanges(previousPrices)

    // Send email alert if any significant changes
    await sendPriceAlertEmail(priceChanges)

    // Update comparisons
    const comparisons = await updateComparisons()

    // Summary
    const endTime = new Date()
    const duration = (endTime.getTime() - startTime.getTime()) / 1000

    console.log(`\n=== Summary ===`)
    console.log(`Teraswitch products updated: ${teraswitchProducts}`)
    console.log(`Comparisons created: ${comparisons}`)
    console.log(`Price changes detected: ${priceChanges.length}`)
    console.log(`Duration: ${duration.toFixed(1)}s`)
    console.log(`Completed at: ${endTime.toISOString()}`)

    // Count by competitor
    const byCompetitor = await prisma.competitorProduct.groupBy({
      by: ['competitor'],
      _count: { id: true },
      where: { inStock: true }
    })

    console.log(`\nProducts in stock by competitor:`)
    for (const c of byCompetitor) {
      console.log(`  ${c.competitor}: ${c._count.id}`)
    }

  } catch (error) {
    console.error('Daily update failed:', error)
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
