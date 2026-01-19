import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.competitorProduct.findMany({
    where: { competitor: 'VULTR' },
    include: { city: true }
  })

  console.log('Vultr products:')
  products.forEach(p =>
    console.log(`  ${p.name}: ${p.cpuCores} cores, ${p.ram}GB, $${p.priceUsd} - ${p.city.name}`)
  )
}

main().finally(() => prisma.$disconnect())
