import { PrismaClient, Competitor } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clear existing data
  await prisma.comparison.deleteMany()
  await prisma.competitorProduct.deleteMany()
  await prisma.latitudeProduct.deleteMany()
  await prisma.city.deleteMany()

  // Create cities (common data center locations)
  const cities = await Promise.all([
    // North America
    prisma.city.create({ data: { code: 'NYC', name: 'New York', country: 'USA' } }),
    prisma.city.create({ data: { code: 'LAX', name: 'Los Angeles', country: 'USA' } }),
    prisma.city.create({ data: { code: 'CHI', name: 'Chicago', country: 'USA' } }),
    prisma.city.create({ data: { code: 'DAL', name: 'Dallas', country: 'USA' } }),
    prisma.city.create({ data: { code: 'MIA', name: 'Miami', country: 'USA' } }),
    prisma.city.create({ data: { code: 'SEA', name: 'Seattle', country: 'USA' } }),
    prisma.city.create({ data: { code: 'SJC', name: 'San Jose', country: 'USA' } }),
    // Europe
    prisma.city.create({ data: { code: 'FRA', name: 'Frankfurt', country: 'Germany' } }),
    prisma.city.create({ data: { code: 'AMS', name: 'Amsterdam', country: 'Netherlands' } }),
    prisma.city.create({ data: { code: 'LON', name: 'London', country: 'UK' } }),
    prisma.city.create({ data: { code: 'PAR', name: 'Paris', country: 'France' } }),
    // Asia Pacific
    prisma.city.create({ data: { code: 'SIN', name: 'Singapore', country: 'Singapore' } }),
    prisma.city.create({ data: { code: 'TYO', name: 'Tokyo', country: 'Japan' } }),
    prisma.city.create({ data: { code: 'SYD', name: 'Sydney', country: 'Australia' } }),
    // South America
    prisma.city.create({ data: { code: 'SAO', name: 'São Paulo', country: 'Brazil' } }),
  ])

  console.log(`Created ${cities.length} cities`)

  // Latitude Gen4 products
  const latitudeProducts = [
    // M4 Series - Memory optimized
    {
      name: 'm4.metal.small',
      cpu: 'AMD 4244P @ 3.8 GHz',
      cpuCores: 6,
      ram: 64,
      storageDescription: '2 x 960GB NVMe',
      storageTotalTB: 1.92,
      networkGbps: 20,
      priceUsd: 189,
      generation: 4,
    },
    {
      name: 'm4.metal.medium',
      cpu: 'AMD 9124 @ 3.0 GHz',
      cpuCores: 16,
      ram: 128,
      storageDescription: '2 x 480GB NVMe + 2 x 1.9TB NVMe',
      storageTotalTB: 4.76,
      networkGbps: 20,
      priceUsd: 455,
      generation: 4,
    },
    {
      name: 'm4.metal.large',
      cpu: 'AMD 9254 @ 2.9 GHz',
      cpuCores: 24,
      ram: 384,
      storageDescription: '2 x 480GB NVMe + 2 x 3.8TB NVMe',
      storageTotalTB: 8.56,
      networkGbps: 20,
      priceUsd: 715,
      generation: 4,
    },
    {
      name: 'm4.metal.xlarge',
      cpu: 'AMD 9455P @ 3.15 GHz',
      cpuCores: 48,
      ram: 768,
      storageDescription: '2 x 480GB NVMe + 2 x 3.8TB NVMe',
      storageTotalTB: 8.56,
      networkGbps: 20,
      priceUsd: 991,
      generation: 4,
    },
    // F4 Series - Frequency optimized
    {
      name: 'f4.metal.small',
      cpu: 'AMD 4484PX @ 4.4 GHz',
      cpuCores: 12,
      ram: 96,
      storageDescription: '2 x 960GB NVMe',
      storageTotalTB: 1.92,
      networkGbps: 20,
      priceUsd: 291,
      generation: 4,
    },
    {
      name: 'f4.metal.medium',
      cpu: 'AMD 4564P @ 4.5 GHz',
      cpuCores: 16,
      ram: 192,
      storageDescription: '2 x 480GB NVMe + 2 x 1.9TB NVMe',
      storageTotalTB: 4.76,
      networkGbps: 20,
      priceUsd: 557,
      generation: 4,
    },
    {
      name: 'f4.metal.large',
      cpu: 'AMD 9275F @ 4.1 GHz',
      cpuCores: 24,
      ram: 768,
      storageDescription: '2 x 480GB NVMe + 2 x 3.8TB NVMe',
      storageTotalTB: 8.56,
      networkGbps: 200,
      priceUsd: 1109,
      generation: 4,
    },
    // RS4 Series - Storage optimized
    {
      name: 'rs4.metal.large',
      cpu: 'AMD 9354P @ 3.25 GHz',
      cpuCores: 32,
      ram: 768,
      storageDescription: '2 x 480GB NVMe + 2 x 8TB NVMe',
      storageTotalTB: 16.96,
      networkGbps: 200,
      priceUsd: 1058,
      generation: 4,
    },
    {
      name: 'rs4.metal.xlarge',
      cpu: 'AMD 9554P @ 3.1 GHz',
      cpuCores: 64,
      ram: 1536,
      storageDescription: '2 x 480GB NVMe + 4 x 8TB NVMe',
      storageTotalTB: 32.96,
      networkGbps: 200,
      priceUsd: 1799,
      generation: 4,
    },
  ]

  for (const product of latitudeProducts) {
    await prisma.latitudeProduct.create({ data: product })
  }

  console.log(`Created ${latitudeProducts.length} Latitude Gen4 products`)

  console.log('Seeding completed!')
  console.log('')
  console.log('Note: No competitor products have been seeded.')
  console.log('Add competitor products manually or via the web interface.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
