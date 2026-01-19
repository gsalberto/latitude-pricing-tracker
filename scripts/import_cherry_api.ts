import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// EUR to USD conversion rate (approximate)
const EUR_TO_USD = 1.08

// Cherry Servers regions that overlap with Latitude cities
const LATITUDE_REGIONS: Record<string, { name: string; country: string }> = {
  'US-Chicago': { name: 'Chicago', country: 'USA' },
  'NL-Amsterdam': { name: 'Amsterdam', country: 'Netherlands' },
  'DE-Frankfurt': { name: 'Frankfurt', country: 'Germany' },
  'SG-Singapore': { name: 'Singapore', country: 'Singapore' },
}

interface CherryPlan {
  name: string
  slug: string
  specs: {
    cpus: { name: string; cores: number; frequency: number; unit: string }
    memory: { total: number; unit: string; name: string }
    storage: Array<{ count: number; name: string; size: number; unit: string; type: string }>
    nics: { name: string }
    bandwidth: { name: string }
  }
  available_regions: Array<{
    name: string
    slug: string
    stock_qty: number
  }>
  pricing: Array<{
    unit: string
    price: number
    currency: string
  }>
}

async function main() {
  console.log('Importing Cherry Servers products from API...\n')

  // Fetch plans from Cherry Servers API
  const response = await fetch('https://api.cherryservers.com/v1/plans')
  const plans: CherryPlan[] = await response.json()

  // Filter for AMD EPYC 9xxx series only
  const epyc9Plans = plans.filter(plan =>
    plan.name.toLowerCase().includes('epyc') &&
    /epyc[- ]?9\d{3}/i.test(plan.name)
  )

  console.log(`Found ${epyc9Plans.length} EPYC 9xxx plans\n`)

  // Delete existing Cherry Servers products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'CHERRYSERVERS' }
  })
  console.log(`Deleted ${deleted.count} existing Cherry Servers products`)

  let created = 0

  for (const plan of epyc9Plans) {
    // Get monthly price in EUR and convert to USD
    const monthlyPricing = plan.pricing.find(p => p.unit === 'Monthly')
    if (!monthlyPricing) continue

    const priceUsd = Math.round(monthlyPricing.price * EUR_TO_USD * 100) / 100

    // Calculate storage
    const storage = plan.specs.storage || []
    const storageDescription = storage.map(s => `${s.count}x ${s.size}${s.unit} ${s.type}`).join(' + ')
    const storageTotalTB = storage.reduce((acc, s) => acc + (s.count * s.size * (s.unit === 'GB' ? 0.001 : 1)), 0)

    // Parse network speed
    const networkStr = plan.specs.nics?.name || '1Gbps'
    const networkGbps = parseInt(networkStr) || 1

    // Get CPU description
    const cpu = plan.specs.cpus
    const cpuDescription = `${cpu.name} (${cpu.cores}c @ ${cpu.frequency}${cpu.unit})`

    // Create product for each Latitude-matching region
    for (const region of plan.available_regions) {
      const latitudeCity = LATITUDE_REGIONS[region.slug]
      if (!latitudeCity) continue // Skip non-Latitude regions

      // Find or create city
      let city = await prisma.city.findFirst({
        where: {
          name: latitudeCity.name,
          country: latitudeCity.country
        }
      })

      if (!city) {
        city = await prisma.city.create({
          data: {
            code: `cherry-${region.slug}`,
            name: latitudeCity.name,
            country: latitudeCity.country,
          }
        })
        console.log(`Created city: ${city.name}, ${city.country}`)
      }

      await prisma.competitorProduct.create({
        data: {
          competitor: 'CHERRYSERVERS',
          name: plan.name.replace('AMD ', ''),
          cpu: cpuDescription,
          cpuCores: cpu.cores,
          ram: plan.specs.memory.total,
          storageDescription: storageDescription || '2x 1TB NVMe',
          storageTotalTB: storageTotalTB || 2,
          networkGbps,
          priceUsd,
          cityId: city.id,
          sourceUrl: `https://www.cherryservers.com/pricing/dedicated-servers/${plan.slug}`,
          inStock: region.stock_qty > 0,
          quantity: region.stock_qty,
          lastInventoryCheck: new Date(),
          lastVerified: new Date(),
        }
      })
      created++

      const stockStatus = region.stock_qty > 0 ? `${region.stock_qty} in stock` : 'out of stock'
      console.log(`  + ${plan.name} in ${latitudeCity.name}: $${priceUsd}/mo (${stockStatus})`)
    }
  }

  console.log(`\nTotal: Created ${created} Cherry Servers products`)

  // Summary by region
  const summary = await prisma.competitorProduct.groupBy({
    by: ['cityId'],
    where: { competitor: 'CHERRYSERVERS' },
    _count: { id: true }
  })

  console.log('\nProducts by city:')
  for (const s of summary) {
    const city = await prisma.city.findUnique({ where: { id: s.cityId } })
    console.log(`  ${city?.name}, ${city?.country}: ${s._count.id} products`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
