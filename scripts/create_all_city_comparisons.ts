import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map competitor city countries to Latitude region codes
const COUNTRY_TO_REGION: Record<string, string> = {
  'USA': 'US',
  'United States': 'US',
  'Brazil': 'BR',
  'Australia': 'AU',
  'Chile': 'CL',
  'Japan': 'JP',
  'Mexico': 'MX',
  'UK': 'UK',
  'United Kingdom': 'UK',
  'Argentina': 'AR',
  'Colombia': 'CO',
  'Germany': 'DE',
  'Singapore': 'SG',
  'Netherlands': 'NL',
  'France': 'DE', // Use Germany/EU pricing
  'Poland': 'DE', // Use Germany/EU pricing
  'Canada': 'US', // Use US pricing for Canada
  'India': 'SG', // Use Singapore pricing for India
  'South Korea': 'JP', // Use Japan pricing for Korea
}

// Cities where Latitude.sh has data centers
const LATITUDE_CITIES = [
  // USA
  { name: 'Ashburn', country: 'USA' },
  { name: 'Chicago', country: 'USA' },
  { name: 'Dallas', country: 'USA' },
  { name: 'Los Angeles', country: 'USA' },
  { name: 'Miami', country: 'USA' },
  { name: 'New York', country: 'USA' },
  // LATAM
  { name: 'Mexico City', country: 'Mexico' },
  { name: 'Bogota', country: 'Colombia' },
  { name: 'São Paulo', country: 'Brazil' },
  { name: 'Buenos Aires', country: 'Argentina' },
  { name: 'Santiago', country: 'Chile' },
  // Europe
  { name: 'Amsterdam', country: 'Netherlands' },
  { name: 'Frankfurt', country: 'Germany' },
  { name: 'London', country: 'UK' },
  // APAC
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

// Check if CPU is modern AMD EPYC (4xxx Raphael/Bergamo or 9xxx Genoa/Turin)
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

// Define comparison rules - find products within a range of specs
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

// Get regional price for a Latitude product based on competitor's country
async function getLatitudeRegionalPrice(
  latProductId: string,
  defaultPrice: number,
  competitorCountry: string
): Promise<number> {
  const regionCode = COUNTRY_TO_REGION[competitorCountry]
  if (!regionCode) {
    return defaultPrice
  }

  const regionalPrice = await prisma.latitudeRegionalPrice.findUnique({
    where: {
      latitudeProductId_region: {
        latitudeProductId: latProductId,
        region: regionCode,
      }
    }
  })

  return regionalPrice?.priceUsd || defaultPrice
}

async function main() {
  console.log('Creating comparisons for ALL cities (with regional pricing)...\n')

  // Get all Latitude products
  const latitudeProducts = await prisma.latitudeProduct.findMany()
  console.log(`Found ${latitudeProducts.length} Latitude products`)

  // Get all competitor products
  const competitorProducts = await prisma.competitorProduct.findMany({
    include: { city: true }
  })
  console.log(`Found ${competitorProducts.length} competitor products\n`)

  // Delete existing comparisons to recalculate with regional pricing
  const deleted = await prisma.comparison.deleteMany({})
  console.log(`Deleted ${deleted.count} existing comparisons to recalculate with regional pricing\n`)

  let created = 0

  for (const latProduct of latitudeProducts) {
    const criteria = latitudeMatchCriteria[latProduct.name]
    if (!criteria) {
      console.log(`No matching criteria for ${latProduct.name}, skipping`)
      continue
    }

    // Find matching competitor products (only in Latitude cities, AMD Genoa or better)
    // Include out-of-stock products for tracking purposes
    const matches = competitorProducts.filter(cp =>
      cp.cpuCores >= criteria.minCores &&
      cp.cpuCores <= criteria.maxCores &&
      cp.ram >= criteria.minRam &&
      cp.ram <= criteria.maxRam &&
      isLatitudeCity(cp.city.name, cp.city.country) && // Only in Latitude cities
      isModernEpyc(cp.cpu) // Only modern AMD EPYC (4xxx or 9xxx)
    )

    console.log(`${latProduct.name} (${latProduct.cpuCores} cores, ${latProduct.ram}GB): ${matches.length} potential matches`)

    // Create comparisons for ALL matching products in ALL cities
    for (const compProduct of matches) {
      // Get regional price for this competitor's location
      const latitudePrice = await getLatitudeRegionalPrice(
        latProduct.id,
        latProduct.priceUsd,
        compProduct.city.country
      )

      // Calculate price difference using regional price
      const priceDiff = ((compProduct.priceUsd - latitudePrice) / latitudePrice) * 100

      await prisma.comparison.create({
        data: {
          latitudeProductId: latProduct.id,
          competitorProductId: compProduct.id,
          priceDifferencePercent: priceDiff,
          latitudeRegionalPriceUsd: latitudePrice,
          notes: `Auto-matched: ${compProduct.cpuCores} cores, ${compProduct.ram}GB RAM vs ${latProduct.cpuCores} cores, ${latProduct.ram}GB RAM`,
        }
      })
      created++
      console.log(`  + ${compProduct.competitor} ${compProduct.name} in ${compProduct.city.name}, ${compProduct.city.country} (Lat: $${latitudePrice} vs Comp: $${compProduct.priceUsd})`)
    }
  }

  console.log(`\nDone! Created ${created} comparisons with regional pricing.`)

  // Show summary
  const comparisons = await prisma.comparison.findMany({
    include: {
      latitudeProduct: true,
      competitorProduct: { include: { city: true } },
    }
  })

  console.log(`\nTotal comparisons: ${comparisons.length}`)

  const cheaper = comparisons.filter(c => c.priceDifferencePercent > 10).length
  const competitive = comparisons.filter(c => c.priceDifferencePercent >= -10 && c.priceDifferencePercent <= 10).length
  const expensive = comparisons.filter(c => c.priceDifferencePercent < -10).length

  console.log(`\nPrice Position Summary:`)
  console.log(`  Latitude Cheaper (>10%): ${cheaper}`)
  console.log(`  Competitive (±10%): ${competitive}`)
  console.log(`  Latitude More Expensive (<-10%): ${expensive}`)

  // Show by city summary
  const byCity: Record<string, number> = {}
  for (const c of comparisons) {
    const cityKey = `${c.competitorProduct.city.name}, ${c.competitorProduct.city.country}`
    byCity[cityKey] = (byCity[cityKey] || 0) + 1
  }

  console.log(`\nComparisons by city:`)
  Object.entries(byCity)
    .sort(([,a], [,b]) => b - a)
    .forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`)
    })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
