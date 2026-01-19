import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// DataPacket Latitude-overlapping cities (LATAM focus)
const DATAPACKET_CITIES = [
  { name: 'São Paulo', country: 'Brazil', code: 'GRU' },
  { name: 'Bogota', country: 'Colombia', code: 'BOG' },
  { name: 'Santiago', country: 'Chile', code: 'SCL' },
  { name: 'Buenos Aires', country: 'Argentina', code: 'EZE' },
]

// DataPacket Genoa products
const DATAPACKET_PRODUCTS = [
  {
    name: 'DP-EPYC-9754',
    cpu: 'AMD EPYC Genoa 9754 (128-Core @ 2.25GHz)',
    cpuCores: 128,
    ram: 256,
    storageDescription: '2x960GB NVMe',
    storageTotalTB: 1.92,
    networkGbps: 10,
    priceUsd: 1977,
  },
  {
    name: 'DP-2xEPYC-9754',
    cpu: '2x AMD EPYC Genoa 9754 (256-Core total @ 2.25GHz)',
    cpuCores: 256,
    ram: 384,
    storageDescription: '2x1920GB NVMe',
    storageTotalTB: 3.84,
    networkGbps: 10,
    priceUsd: 3914,
  },
]

async function main() {
  console.log('Importing DataPacket Genoa products...\n')

  // Delete existing DataPacket products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'DATAPACKET' }
  })
  console.log(`Deleted ${deleted.count} existing DataPacket products`)

  let created = 0

  for (const cityInfo of DATAPACKET_CITIES) {
    // Get or create city
    let city = await prisma.city.findUnique({
      where: { code: `datapacket-${cityInfo.code}` }
    })

    if (!city) {
      city = await prisma.city.create({
        data: {
          code: `datapacket-${cityInfo.code}`,
          name: cityInfo.name,
          country: cityInfo.country,
        }
      })
      console.log(`Created city: ${city.name}, ${city.country}`)
    }

    for (const product of DATAPACKET_PRODUCTS) {
      await prisma.competitorProduct.create({
        data: {
          competitor: 'DATAPACKET',
          name: product.name,
          cpu: product.cpu,
          cpuCores: product.cpuCores,
          ram: product.ram,
          storageDescription: product.storageDescription,
          storageTotalTB: product.storageTotalTB,
          networkGbps: product.networkGbps,
          priceUsd: product.priceUsd,
          cityId: city.id,
          sourceUrl: 'https://datapacket.com/server-configuration',
          inStock: true,
        }
      })
      created++
    }
    console.log(`Created ${DATAPACKET_PRODUCTS.length} products in ${cityInfo.name}`)
  }

  console.log(`\nTotal: Created ${created} DataPacket products`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
