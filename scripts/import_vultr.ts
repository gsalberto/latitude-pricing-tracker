import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Vultr region code to city mapping
const vultrCityMap: Record<string, { name: string; country: string }> = {
  ams: { name: 'Amsterdam', country: 'Netherlands' },
  atl: { name: 'Atlanta', country: 'USA' },
  blr: { name: 'Bangalore', country: 'India' },
  bom: { name: 'Mumbai', country: 'India' },
  cdg: { name: 'Paris', country: 'France' },
  del: { name: 'Delhi', country: 'India' },
  dfw: { name: 'Dallas', country: 'USA' },
  ewr: { name: 'New Jersey', country: 'USA' },
  fra: { name: 'Frankfurt', country: 'Germany' },
  hnl: { name: 'Honolulu', country: 'USA' },
  icn: { name: 'Seoul', country: 'South Korea' },
  itm: { name: 'Osaka', country: 'Japan' },
  jnb: { name: 'Johannesburg', country: 'South Africa' },
  lax: { name: 'Los Angeles', country: 'USA' },
  lhr: { name: 'London', country: 'UK' },
  mad: { name: 'Madrid', country: 'Spain' },
  man: { name: 'Manchester', country: 'UK' },
  mel: { name: 'Melbourne', country: 'Australia' },
  mex: { name: 'Mexico City', country: 'Mexico' },
  mia: { name: 'Miami', country: 'USA' },
  nrt: { name: 'Tokyo', country: 'Japan' },
  ord: { name: 'Chicago', country: 'USA' },
  sao: { name: 'São Paulo', country: 'Brazil' },
  scl: { name: 'Santiago', country: 'Chile' },
  sea: { name: 'Seattle', country: 'USA' },
  sgp: { name: 'Singapore', country: 'Singapore' },
  sjc: { name: 'Silicon Valley', country: 'USA' },
  sto: { name: 'Stockholm', country: 'Sweden' },
  syd: { name: 'Sydney', country: 'Australia' },
  tlv: { name: 'Tel Aviv', country: 'Israel' },
  waw: { name: 'Warsaw', country: 'Poland' },
  yto: { name: 'Toronto', country: 'Canada' },
}

async function main() {
  // Read Vultr plans
  const plansData = require('/tmp/vultr_plans.json')
  const plans = plansData.plans_metal

  console.log(`Processing ${plans.length} Vultr bare metal plans...`)

  // Ensure all cities exist
  const cityIdMap: Record<string, string> = {}
  for (const [code, info] of Object.entries(vultrCityMap)) {
    let city = await prisma.city.findUnique({ where: { code: code.toUpperCase() } })
    if (!city) {
      city = await prisma.city.create({
        data: { code: code.toUpperCase(), name: info.name, country: info.country }
      })
      console.log(`Created city: ${info.name}, ${info.country}`)
    }
    cityIdMap[code] = city.id
  }

  let created = 0
  let skipped = 0

  for (const plan of plans) {
    const storageDesc = `${plan.disk_count}x ${plan.disk}GB ${plan.type}`
    const storageTotalTB = (plan.disk * plan.disk_count) / 1000

    for (const location of plan.locations) {
      const cityId = cityIdMap[location]
      if (!cityId) {
        console.log(`Skipping unknown location: ${location}`)
        continue
      }

      // Check if product already exists
      const existing = await prisma.competitorProduct.findFirst({
        where: {
          competitor: 'VULTR',
          name: plan.id,
          cityId: cityId,
        }
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.competitorProduct.create({
        data: {
          competitor: 'VULTR',
          name: plan.id,
          cpu: `${plan.cpu_manufacturer} ${plan.cpu_model} @ ${plan.cpu_mhz}MHz`,
          cpuCores: plan.cpu_cores,
          ram: Math.round(plan.ram / 1024), // Convert MB to GB
          storageDescription: storageDesc,
          storageTotalTB: storageTotalTB,
          networkGbps: Math.round(plan.bandwidth / 1024), // Convert to Gbps approx
          cityId: cityId,
          priceUsd: plan.monthly_cost,
          sourceUrl: 'https://www.vultr.com/products/bare-metal/',
          inventoryUrl: 'https://www.vultr.com/products/bare-metal/',
          inStock: plan.deploy_ondemand,
          lastVerified: new Date(),
        }
      })
      created++
    }
  }

  console.log(`\nDone! Created ${created} products, skipped ${skipped} existing.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
