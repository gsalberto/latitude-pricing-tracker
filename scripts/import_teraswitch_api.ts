import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

const TERASWITCH_API_KEY = process.env.TERASWITCH_API_KEY || ''
const TERASWITCH_API_SECRET = process.env.TERASWITCH_API_SECRET || ''
const TERASWITCH_API_URL = 'https://api.tsw.io'

if (!TERASWITCH_API_KEY || !TERASWITCH_API_SECRET) {
  throw new Error('TERASWITCH_API_KEY and TERASWITCH_API_SECRET environment variables are required')
}

// Teraswitch cities with their region codes (consolidated by city)
const TERASWITCH_CITIES = [
  // USA
  { cityCode: 'DAL', name: 'Dallas', country: 'USA', regions: ['DAL1'] },
  { cityCode: 'LAX', name: 'Los Angeles', country: 'USA', regions: ['LAX1'] },
  { cityCode: 'CHI', name: 'Chicago', country: 'USA', regions: ['CHI1'] },
  { cityCode: 'IAD', name: 'Ashburn', country: 'USA', regions: ['IAD2'] },
  { cityCode: 'MIA', name: 'Miami', country: 'USA', regions: ['MIA1'] },
  { cityCode: 'EWR', name: 'New York', country: 'USA', regions: ['EWR1', 'EWR2'] },
  // Europe
  { cityCode: 'AMS', name: 'Amsterdam', country: 'Netherlands', regions: ['AMS1', 'AMS2', 'AMS3'] },
  { cityCode: 'FRA', name: 'Frankfurt', country: 'Germany', regions: ['FRA1', 'FRA2'] },
  { cityCode: 'LON', name: 'London', country: 'UK', regions: ['LON1'] },
  // LATAM
  { cityCode: 'SAO', name: 'São Paulo', country: 'Brazil', regions: ['SAO1'] },
  // Asia Pacific
  { cityCode: 'SGP', name: 'Singapore', country: 'Singapore', regions: ['SGP1', 'SGP2'] },
  { cityCode: 'TYO', name: 'Tokyo', country: 'Japan', regions: ['TYO1', 'TYO2', 'TYO3'] },
]

interface MemoryOption {
  gb: number
  monthlyPrice: number
  default: boolean
}

interface DriveOption {
  name: string
  type: string
  capacityGb: number
  monthlyPrice: number
  default: boolean
}

interface DriveSlot {
  id: string
  default: string
  options: DriveOption[]
}

interface Tier {
  id: string
  cpu: string
  cpuDescription: string
  memoryOptions: MemoryOption[]
  driveSlots: DriveSlot[]
  monthlyPrice: number
}

interface AvailabilityItem {
  tier: Tier
  memoryGb: number
  quantity: number
  disks: Record<string, string>
}

interface ApiResponse {
  success: boolean
  result: AvailabilityItem[]
  message?: string
}

function isGenoaOrBetter(cpu: string): boolean {
  const cpuLower = cpu.toLowerCase()
  if (cpuLower.includes('epyc')) {
    if (/epyc[- _]?9\d{3}/.test(cpuLower)) return true
    if (cpuLower.includes('genoa')) return true
    if (cpuLower.includes('turin')) return true
  }
  return false
}

function parseCores(cpuDescription: string): number {
  const match = cpuDescription.match(/(\d+)c/)
  return match ? parseInt(match[1], 10) : 0
}

function calculateStorageTB(driveSlots: DriveSlot[], disks: Record<string, string>): { description: string; totalTB: number } {
  let totalGB = 0
  const parts: string[] = []

  for (const slot of driveSlots) {
    const selectedDisk = disks[slot.id] || slot.default
    const option = slot.options.find(o => o.name === selectedDisk) || slot.options.find(o => o.default)
    if (option) {
      totalGB += option.capacityGb
      parts.push(`${option.name} ${option.type}`)
    }
  }

  return {
    description: parts.join(' + ') || 'Not specified',
    totalTB: totalGB / 1000
  }
}

async function fetchAvailability(region: string): Promise<AvailabilityItem[]> {
  const response = await fetch(`${TERASWITCH_API_URL}/v2/Metal/Availability?Region=${region}`, {
    headers: {
      'Authorization': `Bearer ${TERASWITCH_API_KEY}:${TERASWITCH_API_SECRET}`
    }
  })

  const data: ApiResponse = await response.json()

  if (!data.success) {
    console.log(`  Warning: ${data.message || 'Unknown error'} for region ${region}`)
    return []
  }

  return data.result || []
}

async function main() {
  console.log('Importing Teraswitch inventory from API...\n')

  // Clear existing Teraswitch products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'TERASWITCH' }
  })
  console.log(`Deleted ${deleted.count} existing Teraswitch products\n`)

  let totalCreated = 0

  for (const cityConfig of TERASWITCH_CITIES) {
    console.log(`Fetching availability for ${cityConfig.name}...`)

    // Collect products from all regions in this city
    const allProducts: Map<string, { item: AvailabilityItem; cores: number; storage: { description: string; totalTB: number }; totalPrice: number }> = new Map()

    for (const regionCode of cityConfig.regions) {
      const availability = await fetchAvailability(regionCode)
      const genoaProducts = availability.filter(item => isGenoaOrBetter(item.tier.cpu))

      for (const item of genoaProducts) {
        const cores = parseCores(item.tier.cpuDescription)
        const storage = calculateStorageTB(item.tier.driveSlots, item.disks)
        const ramOption = item.tier.memoryOptions.find(m => m.gb === item.memoryGb)
        const ramAddon = ramOption?.monthlyPrice || 0
        const totalPrice = Math.round(item.tier.monthlyPrice + ramAddon)
        const productName = `TS-${item.tier.cpu.replace(/AMD EPYC /, '').replace(/ /g, '-')}-${item.memoryGb}GB`

        // Only keep one instance per product name (consolidate across regions)
        if (!allProducts.has(productName)) {
          allProducts.set(productName, { item, cores, storage, totalPrice })
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (allProducts.size === 0) {
      console.log(`  No Genoa/Turin products available`)
      continue
    }

    // Get or create consolidated city
    let city = await prisma.city.findUnique({
      where: { code: `teraswitch-${cityConfig.cityCode}` }
    })

    if (!city) {
      city = await prisma.city.create({
        data: {
          code: `teraswitch-${cityConfig.cityCode}`,
          name: cityConfig.name,
          country: cityConfig.country,
        }
      })
    }

    // Create products for this city
    for (const [productName, data] of Array.from(allProducts.entries())) {
      await prisma.competitorProduct.create({
        data: {
          competitor: 'TERASWITCH',
          name: productName,
          cpu: `${data.item.tier.cpu} (${data.item.tier.cpuDescription})`,
          cpuCores: data.cores,
          ram: data.item.memoryGb,
          storageDescription: data.storage.description,
          storageTotalTB: data.storage.totalTB,
          networkGbps: 25,
          priceUsd: data.totalPrice,
          cityId: city.id,
          sourceUrl: 'https://teraswitch.com/bare-metal/',
          inStock: data.item.quantity > 0,
          quantity: data.item.quantity,
          lastVerified: new Date(),
        }
      })
      console.log(`  Created: ${productName} - ${data.cores}c/${data.item.memoryGb}GB - $${data.totalPrice}/mo (qty: ${data.item.quantity})`)
      totalCreated++
    }
  }

  console.log(`\nTotal created: ${totalCreated} products`)

  // Summary
  const products = await prisma.competitorProduct.findMany({
    where: { competitor: 'TERASWITCH' },
    include: { city: true }
  })

  console.log(`\nTeraswitch inventory:`)
  for (const p of products) {
    console.log(`  ${p.city.name}: ${p.name} - ${p.cpuCores}c/${p.ram}GB - $${p.priceUsd}/mo - ${p.inStock ? 'In Stock' : 'Out of Stock'}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
