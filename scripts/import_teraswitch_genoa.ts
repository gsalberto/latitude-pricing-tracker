import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Only Latitude cities that Teraswitch also has
const TERASWITCH_LATITUDE_CITIES = [
  { name: 'Dallas', country: 'USA', code: 'DAL' },
  { name: 'Los Angeles', country: 'USA', code: 'LAX' },
  { name: 'London', country: 'UK', code: 'LON' },
  { name: 'Amsterdam', country: 'Netherlands', code: 'AMS' },
  { name: 'Frankfurt', country: 'Germany', code: 'FRA' },
  { name: 'Singapore', country: 'Singapore', code: 'SIN' },
  { name: 'Tokyo', country: 'Japan', code: 'TYO' },
]

// Teraswitch Genoa/Turin products
const TERASWITCH_PRODUCTS = [
  {
    name: 'TS-EPYC-9254',
    cpu: 'AMD EPYC Genoa 9254 (24-Core @ 2.9GHz)',
    cpuCores: 24,
    ram: 384,
    storageDescription: '2x480GB NVMe RAID 1 + 2x3.84TB NVMe',
    storageTotalTB: 8.16,
    networkGbps: 25,
    priceUsd: 775,
  },
  {
    name: 'TS-EPYC-9354',
    cpu: 'AMD EPYC Genoa 9354 (32-Core @ 3.25GHz)',
    cpuCores: 32,
    ram: 384,
    storageDescription: '2x480GB NVMe RAID 1 + 2x3.84TB NVMe',
    storageTotalTB: 8.16,
    networkGbps: 25,
    priceUsd: 1075,
  },
  {
    name: 'TS-EPYC-9474F',
    cpu: 'AMD EPYC Genoa 9474F (48-Core @ 3.6GHz)',
    cpuCores: 48,
    ram: 768,
    storageDescription: '2x480GB NVMe RAID 1 + 2x3.84TB NVMe',
    storageTotalTB: 8.16,
    networkGbps: 25,
    priceUsd: 1476,
  },
  {
    name: 'TS-EPYC-9554P',
    cpu: 'AMD EPYC Genoa 9554P (64-Core @ 3.1GHz)',
    cpuCores: 64,
    ram: 768,
    storageDescription: '2x480GB NVMe RAID 1 + 2x3.84TB NVMe',
    storageTotalTB: 8.16,
    networkGbps: 25,
    priceUsd: 1502,
  },
  {
    name: 'TS-EPYC-9754',
    cpu: 'AMD EPYC Genoa 9754 (128-Core @ 2.25GHz)',
    cpuCores: 128,
    ram: 768,
    storageDescription: '2x480GB NVMe RAID 1 + 2x3.84TB NVMe',
    storageTotalTB: 8.16,
    networkGbps: 25,
    priceUsd: 1776,
  },
  {
    name: 'TS-EPYC-9275F',
    cpu: 'AMD EPYC Turin 9275F (24-Core @ 4.1GHz)',
    cpuCores: 24,
    ram: 128,
    storageDescription: '2x960GB NVMe RAID 1 + 2x3.2TB Gen5 NVMe',
    storageTotalTB: 7.36,
    networkGbps: 25,
    priceUsd: 1137,
  },
  {
    name: 'TS-EPYC-9375F',
    cpu: 'AMD EPYC Turin 9375F (32-Core @ 3.8GHz)',
    cpuCores: 32,
    ram: 128,
    storageDescription: '2x960GB NVMe RAID 1 + 2x3.2TB Gen5 NVMe',
    storageTotalTB: 7.36,
    networkGbps: 25,
    priceUsd: 1307,
  },
  {
    name: 'TS-EPYC-9575F',
    cpu: 'AMD EPYC Turin 9575F (64-Core @ 3.3GHz)',
    cpuCores: 64,
    ram: 128,
    storageDescription: '2x960GB NVMe RAID 1 + 2x3.2TB Gen5 NVMe',
    storageTotalTB: 7.36,
    networkGbps: 25,
    priceUsd: 1520,
  },
]

async function main() {
  console.log('Importing Teraswitch Genoa/Turin products...\n')

  // First, delete old Teraswitch products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'TERASWITCH' }
  })
  console.log(`Deleted ${deleted.count} old Teraswitch products`)

  let created = 0

  for (const cityInfo of TERASWITCH_LATITUDE_CITIES) {
    // Get or create city
    let city = await prisma.city.findUnique({
      where: { code: `teraswitch-${cityInfo.code}` }
    })

    if (!city) {
      city = await prisma.city.create({
        data: {
          code: `teraswitch-${cityInfo.code}`,
          name: cityInfo.name,
          country: cityInfo.country,
        }
      })
      console.log(`Created city: ${city.name}, ${city.country}`)
    }

    // Create products for this city
    for (const product of TERASWITCH_PRODUCTS) {
      await prisma.competitorProduct.create({
        data: {
          competitor: 'TERASWITCH',
          name: product.name,
          cpu: product.cpu,
          cpuCores: product.cpuCores,
          ram: product.ram,
          storageDescription: product.storageDescription,
          storageTotalTB: product.storageTotalTB,
          networkGbps: product.networkGbps,
          priceUsd: product.priceUsd,
          cityId: city.id,
          sourceUrl: 'https://teraswitch.com/bare-metal/',
          inStock: true,
        }
      })
      created++
    }
    console.log(`Created ${TERASWITCH_PRODUCTS.length} products in ${cityInfo.name}`)
  }

  console.log(`\nTotal: Created ${created} Teraswitch products`)

  // Show summary
  const count = await prisma.competitorProduct.count({
    where: { competitor: 'TERASWITCH' }
  })
  console.log(`Teraswitch products in database: ${count}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
