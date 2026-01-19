import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Hetzner locations - they have datacenters in Germany, Finland, and USA
// Only Ashburn overlaps with Latitude cities
const HETZNER_CITIES = [
  { name: 'Ashburn', country: 'USA', code: 'US-ASH' },
  { name: 'Frankfurt', country: 'Germany', code: 'DE-FRA' }, // Closest to their German DCs
]

// Hetzner AX series with AMD EPYC CPUs (Genoa 9xxx series)
// Prices from https://www.hetzner.com/dedicated-rootserver/
// EUR prices converted to USD (1 EUR ≈ $1.08)
const HETZNER_PRODUCTS = [
  // AX42 series - 8 cores (matches m4.metal.small: 5-8c, 48-80GB)
  {
    name: 'AX42',
    cpu: 'AMD EPYC 9124 (8c/16t @ 3.0-3.7GHz)',
    cpuCores: 8,
    ram: 64,
    storageDescription: '2x 512GB NVMe SSD Gen4',
    storageTotalTB: 1.0,
    networkGbps: 1,
    priceUsd: 65, // €60 converted
  },
  // AX52 series - 16 cores (matches m4.metal.medium: 12-20c, 96-160GB)
  {
    name: 'AX52',
    cpu: 'AMD EPYC 9224 (16c/32t @ 2.5-3.7GHz)',
    cpuCores: 16,
    ram: 128,
    storageDescription: '2x 1TB NVMe SSD Gen4',
    storageTotalTB: 2.0,
    networkGbps: 1,
    priceUsd: 108, // €100 converted
  },
  // AX102 series - 24 cores (matches m4.metal.large: 20-30c, 288-480GB)
  {
    name: 'AX102',
    cpu: 'AMD EPYC 9354 (24c/48t @ 2.25-3.8GHz)',
    cpuCores: 24,
    ram: 384,
    storageDescription: '2x 1.92TB NVMe SSD Gen4',
    storageTotalTB: 3.84,
    networkGbps: 1,
    priceUsd: 162, // €150 converted
  },
  // AX162 series - 48 cores (matches m4.metal.xlarge: 40-60c, 576-960GB with RAM upgrade)
  {
    name: 'AX162-S',
    cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
    cpuCores: 48,
    ram: 128,
    storageDescription: '2x 3.84TB NVMe SSD Gen4 RAID1',
    storageTotalTB: 3.84,
    networkGbps: 1,
    priceUsd: 215, // €199 converted
  },
  {
    name: 'AX162-S-256GB',
    cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
    cpuCores: 48,
    ram: 256,
    storageDescription: '2x 3.84TB NVMe SSD Gen4 RAID1',
    storageTotalTB: 3.84,
    networkGbps: 1,
    priceUsd: 275, // Estimated with RAM upgrade
  },
  {
    name: 'AX162-S-512GB',
    cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
    cpuCores: 48,
    ram: 512,
    storageDescription: '2x 3.84TB NVMe SSD Gen4 RAID1',
    storageTotalTB: 3.84,
    networkGbps: 1,
    priceUsd: 395, // Estimated with RAM upgrade
  },
  {
    name: 'AX162-S-768GB',
    cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
    cpuCores: 48,
    ram: 768,
    storageDescription: '2x 3.84TB NVMe SSD Gen4 RAID1',
    storageTotalTB: 3.84,
    networkGbps: 1,
    priceUsd: 515, // Estimated with RAM upgrade
  },
  {
    name: 'AX162-R',
    cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
    cpuCores: 48,
    ram: 256,
    storageDescription: '2x 1.92TB NVMe SSD Gen4 RAID1',
    storageTotalTB: 1.92,
    networkGbps: 1,
    priceUsd: 215, // €199 converted
  },
  {
    name: 'AX162-R-512GB',
    cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
    cpuCores: 48,
    ram: 512,
    storageDescription: '2x 1.92TB NVMe SSD Gen4 RAID1',
    storageTotalTB: 1.92,
    networkGbps: 1,
    priceUsd: 335, // Estimated with RAM upgrade
  },
  {
    name: 'AX162-R-768GB',
    cpu: 'AMD EPYC 9454P (48c/96t @ 2.75-3.8GHz)',
    cpuCores: 48,
    ram: 768,
    storageDescription: '2x 1.92TB NVMe SSD Gen4 RAID1',
    storageTotalTB: 1.92,
    networkGbps: 1,
    priceUsd: 455, // Estimated with RAM upgrade
  },
]

async function main() {
  console.log('Importing Hetzner EPYC products...\n')

  // Delete existing Hetzner products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'HETZNER' }
  })
  console.log(`Deleted ${deleted.count} existing Hetzner products`)

  let created = 0

  for (const cityInfo of HETZNER_CITIES) {
    // Get or create city
    let city = await prisma.city.findUnique({
      where: { code: `hetzner-${cityInfo.code}` }
    })

    if (!city) {
      city = await prisma.city.create({
        data: {
          code: `hetzner-${cityInfo.code}`,
          name: cityInfo.name,
          country: cityInfo.country,
        }
      })
      console.log(`Created city: ${city.name}, ${city.country}`)
    }

    for (const product of HETZNER_PRODUCTS) {
      await prisma.competitorProduct.create({
        data: {
          competitor: 'HETZNER',
          name: product.name,
          cpu: product.cpu,
          cpuCores: product.cpuCores,
          ram: product.ram,
          storageDescription: product.storageDescription,
          storageTotalTB: product.storageTotalTB,
          networkGbps: product.networkGbps,
          priceUsd: product.priceUsd,
          cityId: city.id,
          sourceUrl: 'https://www.hetzner.com/dedicated-rootserver/ax162-s/',
          inStock: true,
        }
      })
      created++
    }
    console.log(`Created ${HETZNER_PRODUCTS.length} products in ${cityInfo.name}`)
  }

  console.log(`\nTotal: Created ${created} Hetzner products`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
