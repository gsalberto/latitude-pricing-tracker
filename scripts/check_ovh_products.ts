import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get Latitude products
  const latitudeProducts = await prisma.latitudeProduct.findMany({
    orderBy: { name: 'asc' }
  })

  console.log('Latitude Products:')
  for (const p of latitudeProducts) {
    console.log(`  ${p.name}: ${p.cpuCores} cores, ${p.ram}GB RAM, $${p.priceUsd}/mo`)
  }

  // Get OVH products with Genoa
  const ovhProducts = await prisma.competitorProduct.findMany({
    where: { competitor: 'OVHCLOUD' },
    include: { city: true },
    orderBy: { cpuCores: 'asc' }
  })

  console.log('\n\nOVHCloud Products with Genoa (by cores/RAM):')
  for (const p of ovhProducts) {
    console.log(`  ${p.name}: ${p.cpuCores} cores, ${p.ram}GB RAM, $${p.priceUsd}/mo - ${p.city.name}`)
  }

  // Show matching criteria
  console.log('\n\nCurrent matching criteria:')
  const criteria: Record<string, { minCores: number; maxCores: number; minRam: number; maxRam: number }> = {
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

  for (const [name, c] of Object.entries(criteria)) {
    console.log(`  ${name}: ${c.minCores}-${c.maxCores} cores, ${c.minRam}-${c.maxRam}GB RAM`)
  }
}

main().finally(() => prisma.$disconnect())
