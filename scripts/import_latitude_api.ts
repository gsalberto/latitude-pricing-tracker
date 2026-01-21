import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

import 'dotenv/config'

const LATITUDE_API_KEY = process.env.LATITUDE_API_KEY || ''
const LATITUDE_API_URL = 'https://api.latitude.sh'

if (!LATITUDE_API_KEY) {
  throw new Error('LATITUDE_API_KEY environment variable is required')
}

// Map Latitude region names to our region codes
const REGION_MAP: Record<string, string> = {
  'United States': 'US',
  'Brazil': 'BR',
  'Australia': 'AU',
  'Chile': 'CL',
  'Japan': 'JP',
  'Mexico': 'MX',
  'United Kingdom': 'UK',
  'Argentina': 'AR',
  'Colombia': 'CO',
  'Germany': 'DE',
  'Singapore': 'SG',
  'Netherlands': 'NL',
}

// Map competitor city countries to Latitude regions
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
  'France': 'EU',
  'Poland': 'EU',
  'Canada': 'US', // Use US pricing for Canada
  'India': 'SG', // Use Singapore pricing for India
  'South Korea': 'JP', // Use Japan pricing for Korea
}

interface LatitudePlan {
  id: string
  type: string
  attributes: {
    slug: string
    name: string
    specs: {
      cpu: {
        type: string
        clock: number
        cores: number
        count: number
      }
      memory: {
        total: number
      }
      drives: Array<{
        count: number
        size: string
        type: string
      }>
      nics: Array<{
        count: number
        type: string
      }>
    }
    regions: Array<{
      name: string
      stock_level: string
      locations: {
        available: string[]
        in_stock: string[]
      }
      pricing: {
        USD: {
          hour: number
          month: number
          year: number
        }
      }
    }>
  }
}

async function fetchPlans(): Promise<LatitudePlan[]> {
  const response = await fetch(`${LATITUDE_API_URL}/plans`, {
    headers: {
      'Authorization': `Bearer ${LATITUDE_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Latitude API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.data || []
}

function parseStorage(drives: LatitudePlan['attributes']['specs']['drives']): { description: string; totalTB: number } {
  if (!drives || drives.length === 0) {
    return { description: 'Not specified', totalTB: 0 }
  }

  const parts: string[] = []
  let totalGB = 0

  for (const drive of drives) {
    parts.push(`${drive.count}x ${drive.size} ${drive.type}`)
    // Parse size (e.g., "500 GB", "1 TB", "960GB")
    const sizeMatch = drive.size.match(/([\d.]+)\s*(GB|TB)/i)
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1])
      const unit = sizeMatch[2].toUpperCase()
      const sizeGB = unit === 'TB' ? size * 1000 : size
      totalGB += drive.count * sizeGB
    }
  }

  return {
    description: parts.join(' + '),
    totalTB: totalGB / 1000,
  }
}

function parseNetwork(nics: LatitudePlan['attributes']['specs']['nics']): number {
  if (!nics || nics.length === 0) return 1

  const nic = nics[0]
  const match = nic.type.match(/([\d.]+)\s*(Gbps|Mbps)/i)
  if (match) {
    const speed = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    return unit === 'gbps' ? speed : speed / 1000
  }
  return 1
}

async function main() {
  console.log('Importing Latitude products from API...\n')

  const plans = await fetchPlans()
  console.log(`Found ${plans.length} plans from Latitude API\n`)

  // Filter for Gen4 plans (m4, f4, rs4 series)
  const gen4Plans = plans.filter(plan => {
    const name = plan.attributes.name
    return name.startsWith('m4.') || name.startsWith('f4.') || name.startsWith('rs4.')
  })

  console.log(`Found ${gen4Plans.length} Gen4 plans\n`)

  // Clear existing regional prices
  const deletedPrices = await prisma.latitudeRegionalPrice.deleteMany({})
  console.log(`Deleted ${deletedPrices.count} existing regional prices\n`)

  let productsUpdated = 0
  let regionalPricesCreated = 0

  for (const plan of gen4Plans) {
    const attrs = plan.attributes
    const name = attrs.name

    // Find existing product or create it
    let product = await prisma.latitudeProduct.findUnique({
      where: { name }
    })

    // Get US price as default
    const usRegion = attrs.regions.find(r => r.name === 'United States')
    const defaultPrice = usRegion?.pricing?.USD?.month || 0

    if (!product && defaultPrice > 0) {
      // Create new product
      const storage = parseStorage(attrs.specs.drives)
      const networkGbps = parseNetwork(attrs.specs.nics)

      product = await prisma.latitudeProduct.create({
        data: {
          name,
          cpu: `${attrs.specs.cpu.type} @ ${attrs.specs.cpu.clock} GHz`,
          cpuCores: attrs.specs.cpu.cores * attrs.specs.cpu.count,
          ram: attrs.specs.memory.total,
          storageDescription: storage.description,
          storageTotalTB: storage.totalTB,
          networkGbps,
          priceUsd: defaultPrice,
          generation: 4,
        }
      })
      console.log(`Created product: ${name}`)
    } else if (product) {
      // Update existing product with US price
      await prisma.latitudeProduct.update({
        where: { id: product.id },
        data: { priceUsd: defaultPrice }
      })
      productsUpdated++
    }

    if (!product) continue

    // Create regional prices
    for (const region of attrs.regions) {
      const regionCode = REGION_MAP[region.name]
      if (!regionCode) {
        console.log(`  Skipping unknown region: ${region.name}`)
        continue
      }

      const priceUsd = region.pricing?.USD?.month
      if (!priceUsd) continue

      await prisma.latitudeRegionalPrice.upsert({
        where: {
          latitudeProductId_region: {
            latitudeProductId: product.id,
            region: regionCode,
          }
        },
        create: {
          latitudeProductId: product.id,
          region: regionCode,
          priceUsd,
        },
        update: {
          priceUsd,
        }
      })
      regionalPricesCreated++
    }

    console.log(`${name}: US $${defaultPrice}/mo, ${attrs.regions.length} regions`)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Products updated: ${productsUpdated}`)
  console.log(`Regional prices created: ${regionalPricesCreated}`)
  console.log(`${'='.repeat(60)}\n`)

  // Show summary
  const products = await prisma.latitudeProduct.findMany({
    include: { regionalPrices: true },
    orderBy: { name: 'asc' }
  })

  console.log('Latitude Products with Regional Pricing:\n')
  for (const p of products) {
    console.log(`${p.name}: (default $${p.priceUsd}/mo)`)
    for (const rp of p.regionalPrices.sort((a, b) => a.region.localeCompare(b.region))) {
      const diff = rp.priceUsd !== p.priceUsd ? ` (${rp.priceUsd > p.priceUsd ? '+' : ''}${Math.round((rp.priceUsd - p.priceUsd) / p.priceUsd * 100)}%)` : ''
      console.log(`  ${rp.region}: $${rp.priceUsd}/mo${diff}`)
    }
  }
}

// Export the country to region mapping for use in comparison script
export { COUNTRY_TO_REGION }

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
