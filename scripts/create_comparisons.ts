import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

// Check if CPU is AMD Genoa (EPYC 9xxx) or newer (Turin)
function isGenoaOrBetter(cpu: string): boolean {
  const cpuLower = cpu.toLowerCase()
  if (cpuLower.includes('epyc')) {
    if (/epyc[- _]?9\d{3}/.test(cpuLower)) return true
    if (cpuLower.includes('genoa')) return true
    if (cpuLower.includes('turin')) return true
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

// Latitude products with their matching criteria
const latitudeMatchCriteria: Record<string, MatchCriteria> = {
  'm4.metal.small': { minCores: 4, maxCores: 8, minRam: 32, maxRam: 96 },
  'm4.metal.medium': { minCores: 12, maxCores: 24, minRam: 96, maxRam: 192 },
  'm4.metal.large': { minCores: 20, maxCores: 32, minRam: 256, maxRam: 512 },
  'm4.metal.xlarge': { minCores: 40, maxCores: 64, minRam: 512, maxRam: 1024 },
  'f4.metal.small': { minCores: 8, maxCores: 16, minRam: 64, maxRam: 128 },
  'f4.metal.medium': { minCores: 12, maxCores: 20, minRam: 128, maxRam: 256 },
  'f4.metal.large': { minCores: 20, maxCores: 32, minRam: 512, maxRam: 1024 },
  'rs4.metal.large': { minCores: 24, maxCores: 48, minRam: 512, maxRam: 1024 },
  'rs4.metal.xlarge': { minCores: 48, maxCores: 96, minRam: 1024, maxRam: 2048 },
}

async function main() {
  console.log('Creating comparisons...\n')

  // Get all Latitude products
  const latitudeProducts = await prisma.latitudeProduct.findMany()
  console.log(`Found ${latitudeProducts.length} Latitude products`)

  // Get all competitor products
  const competitorProducts = await prisma.competitorProduct.findMany({
    include: { city: true }
  })
  console.log(`Found ${competitorProducts.length} competitor products\n`)

  let created = 0
  let skipped = 0

  for (const latProduct of latitudeProducts) {
    const criteria = latitudeMatchCriteria[latProduct.name]
    if (!criteria) {
      console.log(`No matching criteria for ${latProduct.name}, skipping`)
      continue
    }

    // Find matching competitor products (only in Latitude cities, AMD Genoa or better)
    const matches = competitorProducts.filter(cp =>
      cp.cpuCores >= criteria.minCores &&
      cp.cpuCores <= criteria.maxCores &&
      cp.ram >= criteria.minRam &&
      cp.ram <= criteria.maxRam &&
      cp.inStock && // Only compare with in-stock products
      isLatitudeCity(cp.city.name, cp.city.country) && // Only in Latitude cities
      isGenoaOrBetter(cp.cpu) // Only AMD Genoa or better
    )

    console.log(`${latProduct.name} (${latProduct.cpuCores} cores, ${latProduct.ram}GB): ${matches.length} potential matches`)

    // Create comparisons (limit to avoid too many)
    // Prioritize: one per competitor per major city
    const competitorCityPairs = new Set<string>()

    for (const compProduct of matches) {
      const pairKey = `${compProduct.competitor}-${compProduct.city.country}`

      // Limit to one comparison per competitor per country for this Latitude product
      if (competitorCityPairs.has(pairKey)) continue
      competitorCityPairs.add(pairKey)

      // Check if comparison already exists
      const existing = await prisma.comparison.findFirst({
        where: {
          latitudeProductId: latProduct.id,
          competitorProductId: compProduct.id,
        }
      })

      if (existing) {
        skipped++
        continue
      }

      // Calculate price difference
      const priceDiff = ((compProduct.priceUsd - latProduct.priceUsd) / latProduct.priceUsd) * 100

      await prisma.comparison.create({
        data: {
          latitudeProductId: latProduct.id,
          competitorProductId: compProduct.id,
          priceDifferencePercent: priceDiff,
          notes: `Auto-matched: ${compProduct.cpuCores} cores, ${compProduct.ram}GB RAM vs ${latProduct.cpuCores} cores, ${latProduct.ram}GB RAM`,
        }
      })
      created++
    }
  }

  console.log(`\nDone! Created ${created} comparisons, skipped ${skipped} existing.`)

  // Show summary
  const comparisons = await prisma.comparison.findMany({
    include: {
      latitudeProduct: true,
      competitorProduct: true,
    }
  })

  const cheaper = comparisons.filter(c => c.priceDifferencePercent > 10).length
  const competitive = comparisons.filter(c => c.priceDifferencePercent >= -10 && c.priceDifferencePercent <= 10).length
  const expensive = comparisons.filter(c => c.priceDifferencePercent < -10).length

  console.log(`\nPrice Position Summary:`)
  console.log(`  Latitude Cheaper (>10%): ${cheaper}`)
  console.log(`  Competitive (±10%): ${competitive}`)
  console.log(`  Latitude More Expensive (<-10%): ${expensive}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
