import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// OVH locations that overlap with Latitude cities
const OVH_CITIES = [
  { name: 'Ashburn', country: 'USA', code: 'US-EAST-VA' },
  { name: 'Chicago', country: 'USA', code: 'US-CENTRAL-IL' },
  { name: 'Dallas', country: 'USA', code: 'US-CENTRAL-TX' },
  { name: 'Los Angeles', country: 'USA', code: 'US-WEST-CA' },
  { name: 'Frankfurt', country: 'Germany', code: 'EU-WEST-GER' },
  { name: 'London', country: 'UK', code: 'EU-WEST-UK' },
  { name: 'Singapore', country: 'Singapore', code: 'APAC-SGP' },
  { name: 'Sydney', country: 'Australia', code: 'APAC-SYD' },
]

// OVH Advance series with AMD EPYC 4xxx CPUs (Raphael/Bergamo)
// and Scale series with AMD EPYC 9xxx CPUs (Genoa)
// Base prices from https://www.ovhcloud.com/en/bare-metal/
// Note: All OVH servers currently show "Soon available" (out of stock)
// Prices are base configuration - actual prices may vary with RAM upgrades
const OVH_PRODUCTS = [
  // Advance Series - EPYC 4xxx (Raphael/Bergamo)
  {
    name: 'ADVANCE-1',
    cpu: 'AMD EPYC 4244P (6c/12t @ 3.8-5.1GHz)',
    cpuCores: 6,
    ram: 32, // Base config, upgradeable
    storageDescription: '2x 960GB NVMe SSD',
    storageTotalTB: 1.92,
    networkGbps: 25,
    priceUsd: 90, // Base price, configurable options add cost
    sourceUrl: 'https://www.ovhcloud.com/en/bare-metal/advance/adv-1/',
  },
  {
    name: 'ADVANCE-2',
    cpu: 'AMD EPYC 4344P (8c/16t @ 3.8-5.3GHz)',
    cpuCores: 8,
    ram: 64, // Base config, upgradeable
    storageDescription: '2x 960GB NVMe SSD',
    storageTotalTB: 1.92,
    networkGbps: 25,
    priceUsd: 123, // Base price, configurable options add cost
    sourceUrl: 'https://www.ovhcloud.com/en/bare-metal/advance/adv-2/',
  },
  // Scale Series - EPYC 9xxx (Genoa)
  {
    name: 'SCALE-A1',
    cpu: 'AMD EPYC 9124 (16c/32t @ 3.0-3.6GHz)',
    cpuCores: 16,
    ram: 128, // Base config, upgradeable to 256GB, 512GB
    storageDescription: '2x 1.92TB NVMe SSD',
    storageTotalTB: 3.84,
    networkGbps: 25,
    priceUsd: 413, // Base price, configurable options add cost
    sourceUrl: 'https://www.ovhcloud.com/en/bare-metal/scale/scale-a1/',
  },
]

async function main() {
  console.log('Importing OVHcloud Genoa products...\n')

  // Delete existing OVH products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'OVHCLOUD' }
  })
  console.log(`Deleted ${deleted.count} existing OVHcloud products`)

  let created = 0

  for (const cityInfo of OVH_CITIES) {
    // Get or create city
    let city = await prisma.city.findUnique({
      where: { code: `ovh-${cityInfo.code}` }
    })

    if (!city) {
      city = await prisma.city.create({
        data: {
          code: `ovh-${cityInfo.code}`,
          name: cityInfo.name,
          country: cityInfo.country,
        }
      })
      console.log(`Created city: ${city.name}, ${city.country}`)
    }

    for (const product of OVH_PRODUCTS) {
      await prisma.competitorProduct.create({
        data: {
          competitor: 'OVHCLOUD',
          name: product.name,
          cpu: product.cpu,
          cpuCores: product.cpuCores,
          ram: product.ram,
          storageDescription: product.storageDescription,
          storageTotalTB: product.storageTotalTB,
          networkGbps: product.networkGbps,
          priceUsd: product.priceUsd,
          cityId: city.id,
          sourceUrl: product.sourceUrl,
          inStock: true, // Track for comparisons even if temporarily unavailable
        }
      })
      created++
    }
    console.log(`Created ${OVH_PRODUCTS.length} products in ${cityInfo.name}`)
  }

  console.log(`\nTotal: Created ${created} OVHcloud products`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
