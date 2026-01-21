import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VULTR_API_BASE = 'https://api.vultr.com/v2'

interface VultrPlan {
  id: string
  physical_cpus: number
  cpu_count: number
  cpu_cores: number
  cpu_threads: number
  cpu_manufacturer: string
  cpu_model: string
  cpu_mhz: number
  ram: number // MB
  disk: number // GB per disk
  disk_count: number
  bandwidth: number // GB
  monthly_cost: number
  type: string // SSD, NVMe
  deploy_ondemand: boolean
  locations: string[]
}

interface VultrRegion {
  id: string
  city: string
  country: string
  continent: string
  options: string[]
}

// Country code to full name mapping
const COUNTRY_NAMES: Record<string, string> = {
  'US': 'USA',
  'NL': 'Netherlands',
  'DE': 'Germany',
  'FR': 'France',
  'GB': 'UK',
  'AU': 'Australia',
  'JP': 'Japan',
  'SG': 'Singapore',
  'KR': 'South Korea',
  'IN': 'India',
  'BR': 'Brazil',
  'CA': 'Canada',
  'PL': 'Poland',
  'ES': 'Spain',
  'SE': 'Sweden',
  'ZA': 'South Africa',
  'IL': 'Israel',
  'MX': 'Mexico',
  'CL': 'Chile',
}

function isModernEpyc(cpuModel: string): boolean {
  // EPYC 9xxx (Genoa/Turin) or EPYC 7xxx 3rd gen (Milan)
  if (/EPYC\s*9\d{3}/.test(cpuModel)) return true
  // Milan series (7xx3)
  if (/EPYC\s*7\d{2}3/.test(cpuModel)) return true
  // Also accept 7443P which is Milan
  if (/EPYC\s*74[4-9]\d/.test(cpuModel)) return true
  return false
}

async function fetchPlans(): Promise<VultrPlan[]> {
  const response = await fetch(`${VULTR_API_BASE}/plans-metal`)
  const data = await response.json()
  return data.plans_metal || []
}

async function fetchRegions(): Promise<Map<string, VultrRegion>> {
  const response = await fetch(`${VULTR_API_BASE}/regions`)
  const data = await response.json()
  const regions = new Map<string, VultrRegion>()
  for (const region of data.regions || []) {
    regions.set(region.id, region)
  }
  return regions
}

async function main() {
  console.log('Importing Vultr bare metal plans from API...\n')

  // Delete existing Vultr products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'VULTR' }
  })
  console.log(`Deleted ${deleted.count} existing Vultr products\n`)

  // Fetch data from API
  console.log('Fetching plans and regions from Vultr API...')
  const [plans, regions] = await Promise.all([
    fetchPlans(),
    fetchRegions(),
  ])

  console.log(`Found ${plans.length} bare metal plans`)
  console.log(`Found ${regions.size} regions\n`)

  // Filter for AMD EPYC servers (modern generations)
  const amdPlans = plans.filter(p => p.cpu_manufacturer === 'AMD')
  console.log(`AMD plans: ${amdPlans.length}`)

  const modernPlans = amdPlans.filter(p => isModernEpyc(p.cpu_model))
  console.log(`Modern EPYC (9xxx/Milan) plans: ${modernPlans.length}\n`)

  let totalCreated = 0
  const createdProducts: Array<{
    name: string
    cpu: string
    cores: number
    ram: number
    price: number
    city: string
    country: string
  }> = []

  for (const plan of modernPlans) {
    if (plan.locations.length === 0) {
      console.log(`  Skipping ${plan.id} - no available locations`)
      continue
    }

    const ramGB = Math.round(plan.ram / 1024)
    const totalStorageGB = plan.disk * plan.disk_count
    const totalStorageTB = totalStorageGB / 1000
    const cpuDescription = `AMD ${plan.cpu_model} (${plan.cpu_cores}c/${plan.cpu_threads}t @ ${(plan.cpu_mhz / 1000).toFixed(1)}GHz)`

    console.log(`Processing ${plan.id}: ${cpuDescription}`)
    console.log(`  RAM: ${ramGB}GB, Storage: ${plan.disk_count}x ${plan.disk}GB ${plan.type}, Price: $${plan.monthly_cost}/mo`)
    console.log(`  Locations: ${plan.locations.length}`)

    for (const locationId of plan.locations) {
      const region = regions.get(locationId)
      if (!region) {
        console.log(`    Skipping unknown region: ${locationId}`)
        continue
      }

      const countryName = COUNTRY_NAMES[region.country] || region.country
      const cityCode = `vultr-${locationId}`

      // Get or create city
      let city = await prisma.city.findUnique({ where: { code: cityCode } })
      if (!city) {
        city = await prisma.city.create({
          data: {
            code: cityCode,
            name: region.city,
            country: countryName,
          }
        })
      }

      // Create product
      const productName = `Vultr-${plan.cpu_model.replace(/\s+/g, '-')}-${ramGB}GB`

      await prisma.competitorProduct.create({
        data: {
          competitor: 'VULTR',
          name: productName,
          cpu: cpuDescription,
          cpuCores: plan.cpu_cores,
          ram: ramGB,
          storageDescription: `${plan.disk_count}x ${plan.disk}GB ${plan.type}`,
          storageTotalTB: totalStorageTB,
          networkGbps: 10, // Vultr bare metal typically has 10Gbps
          priceUsd: plan.monthly_cost,
          cityId: city.id,
          sourceUrl: 'https://www.vultr.com/products/bare-metal/',
          inStock: plan.deploy_ondemand,
          lastInventoryCheck: new Date(),
          lastVerified: new Date(),
        }
      })

      createdProducts.push({
        name: productName,
        cpu: plan.cpu_model,
        cores: plan.cpu_cores,
        ram: ramGB,
        price: plan.monthly_cost,
        city: region.city,
        country: countryName,
      })
      totalCreated++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Total created: ${totalCreated} Vultr products`)
  console.log(`${'='.repeat(60)}\n`)

  // Summary by plan
  const byPlan = new Map<string, typeof createdProducts>()
  for (const p of createdProducts) {
    const key = `${p.cpu}-${p.ram}GB`
    if (!byPlan.has(key)) {
      byPlan.set(key, [])
    }
    byPlan.get(key)!.push(p)
  }

  console.log('Summary by server configuration:\n')
  for (const [config, products] of Array.from(byPlan.entries())) {
    const sample = products[0]
    console.log(`${config}:`)
    console.log(`  CPU: AMD ${sample.cpu} (${sample.cores} cores)`)
    console.log(`  RAM: ${sample.ram}GB`)
    console.log(`  Price: $${sample.price}/mo`)
    console.log(`  Locations: ${products.length}`)
    console.log(`  Cities: ${products.slice(0, 5).map(p => p.city).join(', ')}${products.length > 5 ? '...' : ''}`)
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
