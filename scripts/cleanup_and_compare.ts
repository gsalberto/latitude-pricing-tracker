import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Cities where Latitude.sh has data centers
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

function isGenoaOrBetter(cpu: string): boolean {
  const cpuLower = cpu.toLowerCase()
  if (cpuLower.includes('epyc')) {
    if (/epyc[- _]?9\d{3}/.test(cpuLower)) return true
    if (cpuLower.includes('genoa')) return true
    if (cpuLower.includes('turin')) return true
  }
  return false
}

interface MatchCriteria {
  minCores: number
  maxCores: number
  minRam: number
  maxRam: number
}

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
  console.log('=== Cleanup and Create Comparisons ===\n')

  // Step 1: Delete bad OVH data
  console.log('Step 1: Cleaning up bad OVH data...')
  const deletedOvh = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'OVHCLOUD' }
  })
  console.log(`  Deleted ${deletedOvh.count} OVH products\n`)

  // Step 2: Delete all existing comparisons to start fresh
  console.log('Step 2: Clearing existing comparisons...')
  const deletedComparisons = await prisma.comparison.deleteMany({})
  console.log(`  Deleted ${deletedComparisons.count} comparisons\n`)

  // Step 3: Get all data
  const latitudeProducts = await prisma.latitudeProduct.findMany()
  const competitorProducts = await prisma.competitorProduct.findMany({
    include: { city: true }
  })

  console.log(`Step 3: Found ${latitudeProducts.length} Latitude products and ${competitorProducts.length} competitor products\n`)

  // Show competitor breakdown
  const byCompetitor: Record<string, number> = {}
  for (const p of competitorProducts) {
    byCompetitor[p.competitor] = (byCompetitor[p.competitor] || 0) + 1
  }
  console.log('Competitor products:')
  Object.entries(byCompetitor).forEach(([c, count]) => console.log(`  ${c}: ${count}`))
  console.log('')

  // Step 4: Create comparisons
  console.log('Step 4: Creating comparisons...\n')
  let created = 0

  for (const latProduct of latitudeProducts) {
    const criteria = latitudeMatchCriteria[latProduct.name]
    if (!criteria) {
      console.log(`  No matching criteria for ${latProduct.name}, skipping`)
      continue
    }

    const matches = competitorProducts.filter(cp =>
      cp.cpuCores >= criteria.minCores &&
      cp.cpuCores <= criteria.maxCores &&
      cp.ram >= criteria.minRam &&
      cp.ram <= criteria.maxRam &&
      cp.inStock &&
      isLatitudeCity(cp.city.name, cp.city.country) &&
      isGenoaOrBetter(cp.cpu)
    )

    console.log(`  ${latProduct.name} (${latProduct.cpuCores} cores, ${latProduct.ram}GB): ${matches.length} matches`)

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

  // Summary
  console.log('\n=== Summary ===')
  const finalComparisons = await prisma.comparison.findMany({
    include: {
      latitudeProduct: true,
      competitorProduct: true,
    }
  })

  console.log(`Total comparisons: ${finalComparisons.length}`)

  const cheaper = finalComparisons.filter(c => c.priceDifferencePercent > 10).length
  const competitive = finalComparisons.filter(c => c.priceDifferencePercent >= -10 && c.priceDifferencePercent <= 10).length
  const expensive = finalComparisons.filter(c => c.priceDifferencePercent < -10).length

  console.log(`  Latitude Cheaper (>10%): ${cheaper}`)
  console.log(`  Competitive (±10%): ${competitive}`)
  console.log(`  Latitude More Expensive (<-10%): ${expensive}`)

  // By competitor
  const compByCompetitor: Record<string, number> = {}
  for (const c of finalComparisons) {
    compByCompetitor[c.competitorProduct.competitor] = (compByCompetitor[c.competitorProduct.competitor] || 0) + 1
  }
  console.log('\nComparisons by competitor:')
  Object.entries(compByCompetitor).forEach(([c, count]) => console.log(`  ${c}: ${count}`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
