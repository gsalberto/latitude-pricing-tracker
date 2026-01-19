import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Teraswitch servers - based on available public info
// Note: Teraswitch doesn't have a public API, these are from their website
const teraswitchServers = [
  {
    name: 'TS-E3-1240v5',
    cpu: 'Intel Xeon E3-1240v5 (4-Core @ 3.5GHz)',
    cpuCores: 4,
    ram: 32,
    storageDescription: '2x 480GB SSD',
    storageTotalTB: 0.96,
    networkGbps: 1,
    priceUsd: 70,
  },
  {
    name: 'TS-E5-2620v4',
    cpu: 'Intel Xeon E5-2620v4 (8-Core @ 2.1GHz)',
    cpuCores: 8,
    ram: 64,
    storageDescription: '2x 480GB SSD',
    storageTotalTB: 0.96,
    networkGbps: 1,
    priceUsd: 95,
  },
  {
    name: 'TS-2xE5-2620v4',
    cpu: 'Dual Intel Xeon E5-2620v4 (16-Core total @ 2.1GHz)',
    cpuCores: 16,
    ram: 128,
    storageDescription: '2x 960GB SSD',
    storageTotalTB: 1.92,
    networkGbps: 1,
    priceUsd: 150,
  },
  {
    name: 'TS-2xE5-2680v4',
    cpu: 'Dual Intel Xeon E5-2680v4 (28-Core total @ 2.4GHz)',
    cpuCores: 28,
    ram: 256,
    storageDescription: '2x 960GB SSD',
    storageTotalTB: 1.92,
    networkGbps: 10,
    priceUsd: 250,
  },
  {
    name: 'TS-EPYC-7302P',
    cpu: 'AMD EPYC 7302P (16-Core @ 3.0GHz)',
    cpuCores: 16,
    ram: 128,
    storageDescription: '2x 960GB NVMe',
    storageTotalTB: 1.92,
    networkGbps: 10,
    priceUsd: 200,
  },
  {
    name: 'TS-EPYC-7402P',
    cpu: 'AMD EPYC 7402P (24-Core @ 2.8GHz)',
    cpuCores: 24,
    ram: 256,
    storageDescription: '2x 1.92TB NVMe',
    storageTotalTB: 3.84,
    networkGbps: 10,
    priceUsd: 300,
  },
]

// Teraswitch datacenters
const teraswitchCities = [
  { code: 'PIT', name: 'Pittsburgh', country: 'USA' },
  { code: 'ASH', name: 'Ashburn', country: 'USA' },
  { code: 'PHX', name: 'Phoenix', country: 'USA' },
  { code: 'LAX_TS', name: 'Los Angeles', country: 'USA' },
]

async function main() {
  console.log(`Processing ${teraswitchServers.length} Teraswitch servers...`)

  // Ensure cities exist
  const cityIdMap: Record<string, string> = {}
  for (const cityInfo of teraswitchCities) {
    let city = await prisma.city.findUnique({ where: { code: cityInfo.code } })
    if (!city) {
      city = await prisma.city.create({
        data: { code: cityInfo.code, name: cityInfo.name, country: cityInfo.country }
      })
      console.log(`Created city: ${cityInfo.name}, ${cityInfo.country}`)
    }
    cityIdMap[cityInfo.code] = city.id
  }

  let created = 0
  let skipped = 0

  for (const server of teraswitchServers) {
    for (const cityCode of Object.keys(cityIdMap)) {
      const cityId = cityIdMap[cityCode]

      // Check if exists
      const existing = await prisma.competitorProduct.findFirst({
        where: {
          competitor: 'TERASWITCH',
          name: server.name,
          cityId: cityId,
        }
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.competitorProduct.create({
        data: {
          competitor: 'TERASWITCH',
          name: server.name,
          cpu: server.cpu,
          cpuCores: server.cpuCores,
          ram: server.ram,
          storageDescription: server.storageDescription,
          storageTotalTB: server.storageTotalTB,
          networkGbps: server.networkGbps,
          cityId: cityId,
          priceUsd: server.priceUsd,
          sourceUrl: 'https://teraswitch.com/bare-metal/',
          inventoryUrl: 'https://portal.teraswitch.com/index.php?/cart/dedicated-servers/',
          inStock: true,
          lastVerified: new Date(),
        }
      })
      created++
    }
  }

  console.log(`\nDone! Created ${created} Teraswitch products, skipped ${skipped} existing.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
