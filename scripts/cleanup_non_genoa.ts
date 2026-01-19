import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Check if CPU is AMD Genoa (EPYC 9xxx) or newer (Turin)
function isGenoaOrBetter(cpu: string): boolean {
  const cpuLower = cpu.toLowerCase()

  // Match AMD EPYC 9xxx series (Genoa, Turin)
  // Patterns: "epyc 9xxx", "epyc genoa", "epyc turin"
  if (cpuLower.includes('epyc')) {
    // Check for 9xxx series
    if (/epyc[- _]?9\d{3}/.test(cpuLower)) return true
    // Check for explicit Genoa/Turin naming
    if (cpuLower.includes('genoa')) return true
    if (cpuLower.includes('turin')) return true
  }

  return false
}

async function main() {
  console.log('Cleaning up comparisons to only include AMD Genoa or better CPUs...\n')

  // Get all comparisons with competitor product CPU info
  const comparisons = await prisma.comparison.findMany({
    include: {
      competitorProduct: true,
      latitudeProduct: true,
    }
  })

  console.log(`Total comparisons: ${comparisons.length}`)

  const toDelete: string[] = []
  const kept: { cpu: string; name: string }[] = []

  for (const comp of comparisons) {
    const cpu = comp.competitorProduct.cpu
    if (isGenoaOrBetter(cpu)) {
      kept.push({ cpu, name: comp.competitorProduct.name })
    } else {
      toDelete.push(comp.id)
      console.log(`  Will delete: ${comp.latitudeProduct.name} vs ${comp.competitorProduct.name} (${cpu})`)
    }
  }

  console.log(`\nComparisons to keep: ${kept.length}`)
  console.log(`Comparisons to delete: ${toDelete.length}`)

  if (toDelete.length > 0) {
    const result = await prisma.comparison.deleteMany({
      where: { id: { in: toDelete } }
    })
    console.log(`\nDeleted ${result.count} comparisons`)
  }

  // Also delete competitor products without Genoa or better
  const competitorProducts = await prisma.competitorProduct.findMany()
  const productsToDelete = competitorProducts.filter(p => !isGenoaOrBetter(p.cpu)).map(p => p.id)

  console.log(`\nCompetitor products without Genoa or better: ${productsToDelete.length}`)

  if (productsToDelete.length > 0) {
    const result = await prisma.competitorProduct.deleteMany({
      where: { id: { in: productsToDelete } }
    })
    console.log(`Deleted ${result.count} competitor products`)
  }

  // Clean up empty cities
  const citiesWithProducts = await prisma.city.findMany({
    include: { _count: { select: { competitorProducts: true } } }
  })
  const emptyCityIds = citiesWithProducts
    .filter(c => c._count.competitorProducts === 0)
    .map(c => c.id)

  if (emptyCityIds.length > 0) {
    const result = await prisma.city.deleteMany({
      where: { id: { in: emptyCityIds } }
    })
    console.log(`Deleted ${result.count} empty cities`)
  }

  // Summary
  const finalComparisons = await prisma.comparison.count()
  const finalProducts = await prisma.competitorProduct.count()
  const finalCities = await prisma.city.count()

  console.log(`\n--- Final Summary ---`)
  console.log(`Comparisons: ${finalComparisons}`)
  console.log(`Competitor products: ${finalProducts}`)
  console.log(`Cities: ${finalCities}`)

  // Show remaining CPUs
  const remainingProducts = await prisma.competitorProduct.findMany({ select: { cpu: true } })
  const remainingCpus = new Set(remainingProducts.map(p => p.cpu))
  console.log(`\nRemaining CPU types:`)
  Array.from(remainingCpus).sort().forEach(cpu => console.log(`  - ${cpu}`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
