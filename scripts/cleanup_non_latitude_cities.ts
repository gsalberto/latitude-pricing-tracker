import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Cities where Latitude.sh has data centers
const LATITUDE_CITIES = [
  // USA
  { name: 'Ashburn', country: 'USA' },
  { name: 'Chicago', country: 'USA' },
  { name: 'Dallas', country: 'USA' },
  { name: 'Los Angeles', country: 'USA' },
  { name: 'Miami', country: 'USA' },
  { name: 'New York', country: 'USA' },
  // LATAM
  { name: 'Mexico City', country: 'Mexico' },
  { name: 'Bogota', country: 'Colombia' },
  { name: 'São Paulo', country: 'Brazil' },
  { name: 'Buenos Aires', country: 'Argentina' },
  { name: 'Santiago', country: 'Chile' },
  // Europe
  { name: 'Amsterdam', country: 'Netherlands' },
  { name: 'Frankfurt', country: 'Germany' },
  { name: 'London', country: 'UK' },
  // APAC
  { name: 'Singapore', country: 'Singapore' },
  { name: 'Sydney', country: 'Australia' },
  { name: 'Tokyo', country: 'Japan' },
]

// Create a set for fast lookup (normalize names)
const latitudeCitySet = new Set(
  LATITUDE_CITIES.map(c => `${c.name.toLowerCase()}-${c.country.toLowerCase()}`)
)

function isLatitudeCity(cityName: string, country: string): boolean {
  const key = `${cityName.toLowerCase()}-${country.toLowerCase()}`
  return latitudeCitySet.has(key)
}

async function main() {
  console.log('Cleaning up comparisons in cities where Latitude has no presence...\n')
  console.log('Latitude cities:', LATITUDE_CITIES.map(c => `${c.name}, ${c.country}`).join(', '))
  console.log('')

  // Get all comparisons with city info
  const comparisons = await prisma.comparison.findMany({
    include: {
      competitorProduct: {
        include: { city: true }
      },
      latitudeProduct: true,
    }
  })

  console.log(`Total comparisons: ${comparisons.length}`)

  // Find comparisons to delete
  const toDelete: string[] = []
  const kept: string[] = []

  for (const comp of comparisons) {
    const city = comp.competitorProduct.city
    if (isLatitudeCity(city.name, city.country)) {
      kept.push(`${city.name}, ${city.country}`)
    } else {
      toDelete.push(comp.id)
      console.log(`  Will delete: ${comp.latitudeProduct.name} vs ${comp.competitorProduct.name} in ${city.name}, ${city.country}`)
    }
  }

  console.log(`\nComparisons to keep: ${kept.length}`)
  console.log(`Comparisons to delete: ${toDelete.length}`)

  if (toDelete.length > 0) {
    // Delete comparisons
    const result = await prisma.comparison.deleteMany({
      where: {
        id: { in: toDelete }
      }
    })
    console.log(`\nDeleted ${result.count} comparisons`)
  }

  // Also delete competitor products in non-Latitude cities
  const competitorProducts = await prisma.competitorProduct.findMany({
    include: { city: true }
  })

  const productsToDelete: string[] = []
  for (const product of competitorProducts) {
    if (!isLatitudeCity(product.city.name, product.city.country)) {
      productsToDelete.push(product.id)
    }
  }

  console.log(`\nCompetitor products in non-Latitude cities: ${productsToDelete.length}`)

  if (productsToDelete.length > 0) {
    const result = await prisma.competitorProduct.deleteMany({
      where: {
        id: { in: productsToDelete }
      }
    })
    console.log(`Deleted ${result.count} competitor products`)
  }

  // Clean up cities with no products
  const citiesWithProducts = await prisma.city.findMany({
    include: { _count: { select: { competitorProducts: true } } }
  })

  const emptyCtiyIds = citiesWithProducts
    .filter(c => c._count.competitorProducts === 0)
    .map(c => c.id)

  if (emptyCtiyIds.length > 0) {
    const result = await prisma.city.deleteMany({
      where: { id: { in: emptyCtiyIds } }
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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
