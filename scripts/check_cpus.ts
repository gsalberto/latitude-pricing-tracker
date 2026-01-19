import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.competitorProduct.findMany({
    select: { cpu: true, competitor: true, name: true }
  })

  const cpusByCompetitor: Record<string, Set<string>> = {}

  for (const p of products) {
    if (!cpusByCompetitor[p.competitor]) {
      cpusByCompetitor[p.competitor] = new Set()
    }
    cpusByCompetitor[p.competitor].add(p.cpu)
  }

  console.log('CPUs by competitor:\n')
  for (const [competitor, cpus] of Object.entries(cpusByCompetitor)) {
    console.log(`${competitor}:`)
    Array.from(cpus).sort().forEach(cpu => console.log(`  - ${cpu}`))
    console.log('')
  }
}

main().finally(() => prisma.$disconnect())
