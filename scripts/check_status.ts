import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Count products by competitor
  const products = await prisma.competitorProduct.findMany({
    select: { competitor: true, cpu: true, name: true }
  })

  const byCompetitor: Record<string, number> = {}
  for (const p of products) {
    byCompetitor[p.competitor] = (byCompetitor[p.competitor] || 0) + 1
  }

  console.log('Competitor products in database:')
  console.log('  VULTR:', byCompetitor['VULTR'] || 0)
  console.log('  OVHCLOUD:', byCompetitor['OVHCLOUD'] || 0)
  console.log('  HETZNER:', byCompetitor['HETZNER'] || 0)
  console.log('  TERASWITCH:', byCompetitor['TERASWITCH'] || 0)
  console.log('  CHERRYSERVERS:', byCompetitor['CHERRYSERVERS'] || 0)
  console.log('  LIMESTONENETWORKS:', byCompetitor['LIMESTONENETWORKS'] || 0)
  console.log('  SERVERSCOM:', byCompetitor['SERVERSCOM'] || 0)
  console.log('  DATAPACKET:', byCompetitor['DATAPACKET'] || 0)

  // Count comparisons
  const comparisons = await prisma.comparison.count()
  console.log('\nTotal comparisons:', comparisons)

  // Show unique CPUs remaining
  const cpus = new Set(products.map(p => p.cpu))
  console.log('\nCPUs in database:')
  Array.from(cpus).sort().forEach(cpu => console.log('  -', cpu))
}

main().finally(() => prisma.$disconnect())
