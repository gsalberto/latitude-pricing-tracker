import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Vultr regional pricing multipliers (approximate based on user feedback)
// Base price is US pricing, these are multipliers for other regions
const vultrRegionalMultipliers: Record<string, number> = {
  'São Paulo': 1.5,      // 50% premium (confirmed by user)
  'Singapore': 1.3,      // Estimated
  'Sydney': 1.3,         // Estimated
  'Tokyo': 1.2,          // Estimated
  'Seoul': 1.2,          // Estimated
  // US and Europe typically at base price
}

async function main() {
  const args = process.argv.slice(2)

  if (args[0] === '--update-regional') {
    // Update all Vultr products with regional multipliers
    console.log('Updating Vultr regional pricing...\n')

    const vultrProducts = await prisma.competitorProduct.findMany({
      where: { competitor: 'VULTR' },
      include: { city: true }
    })

    let updated = 0
    for (const product of vultrProducts) {
      const multiplier = vultrRegionalMultipliers[product.city.name]
      if (multiplier && multiplier !== 1) {
        // The current price is base price, apply multiplier
        const newPrice = Math.round(product.priceUsd * multiplier * 100) / 100

        await prisma.competitorProduct.update({
          where: { id: product.id },
          data: { priceUsd: newPrice }
        })

        console.log(`${product.name} @ ${product.city.name}: $${product.priceUsd} -> $${newPrice} (${multiplier}x)`)
        updated++
      }
    }

    console.log(`\nUpdated ${updated} products with regional pricing`)

  } else if (args[0] === '--single') {
    // Update single product: --single <id> <price>
    const id = args[1]
    const price = parseFloat(args[2])

    const updated = await prisma.competitorProduct.update({
      where: { id },
      data: { priceUsd: price },
      include: { city: true }
    })

    console.log(`Updated: ${updated.name} in ${updated.city.name}`)
    console.log(`New price: $${updated.priceUsd}`)
  }

  // Recalculate all comparisons
  console.log('\nRecalculating all comparisons...')

  const comparisons = await prisma.comparison.findMany({
    include: {
      latitudeProduct: true,
      competitorProduct: true
    }
  })

  for (const comp of comparisons) {
    const newDiff = ((comp.competitorProduct.priceUsd - comp.latitudeProduct.priceUsd) / comp.latitudeProduct.priceUsd) * 100
    await prisma.comparison.update({
      where: { id: comp.id },
      data: { priceDifferencePercent: newDiff }
    })
  }

  console.log(`Recalculated ${comparisons.length} comparisons`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
