import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import 'dotenv/config'

const prisma = new PrismaClient()

// OVH API Configuration (CA region)
const OVH_APP_KEY = process.env.OVH_APP_KEY || ''
const OVH_APP_SECRET = process.env.OVH_APP_SECRET || ''
const OVH_CONSUMER_KEY = process.env.OVH_CONSUMER_KEY || ''
const OVH_API_BASE = 'https://ca.api.ovh.com/1.0'

if (!OVH_APP_KEY || !OVH_APP_SECRET || !OVH_CONSUMER_KEY) {
  throw new Error('OVH API credentials (OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY) are required')
}

// CAD to USD conversion rate (approximate - OVH USD prices are slightly higher than direct conversion)
// Using 0.756 to match OVH's USD website pricing
const CAD_TO_USD = 0.756

// OVH Datacenter to City mapping
const OVH_DATACENTERS: Record<string, { name: string; country: string }> = {
  // Europe
  'rbx': { name: 'Roubaix', country: 'France' },
  'sbg': { name: 'Strasbourg', country: 'France' },
  'gra': { name: 'Gravelines', country: 'France' },
  'par': { name: 'Paris', country: 'France' },
  'fra': { name: 'Frankfurt', country: 'Germany' },
  'lon': { name: 'London', country: 'UK' },
  'waw': { name: 'Warsaw', country: 'Poland' },
  // New EU DC codes
  'eu-west-par-a': { name: 'Paris', country: 'France' },
  'eu-west-par-b': { name: 'Paris', country: 'France' },
  'eu-west-par-c': { name: 'Paris', country: 'France' },
  'eu-west-gra-a': { name: 'Gravelines', country: 'France' },
  'eu-west-fra-a': { name: 'Frankfurt', country: 'Germany' },
  'eu-west-lon-a': { name: 'London', country: 'UK' },
  // North America
  'bhs': { name: 'Beauharnois', country: 'Canada' },
  'hil': { name: 'Hillsboro', country: 'USA' },
  'vin': { name: 'Vint Hill', country: 'USA' },
  // New NA DC codes
  'ca-east-bhs-a': { name: 'Beauharnois', country: 'Canada' },
  'ca-east-tor-a': { name: 'Toronto', country: 'Canada' },
  'us-east-vin-a': { name: 'Vint Hill', country: 'USA' },
  'us-west-hil-a': { name: 'Hillsboro', country: 'USA' },
  // Asia Pacific
  'sgp': { name: 'Singapore', country: 'Singapore' },
  'syd': { name: 'Sydney', country: 'Australia' },
  'apac-sgp-a': { name: 'Singapore', country: 'Singapore' },
  'apac-syd-a': { name: 'Sydney', country: 'Australia' },
  // India
  'ynm': { name: 'Mumbai', country: 'India' },
  'mum': { name: 'Mumbai', country: 'India' },
  'in-west-mum-a': { name: 'Mumbai', country: 'India' },
}

// Server families to import (Scale AMD, Advance, HCI)
const IMPORT_SERVER_FAMILIES = [
  '23scaleamd', '26scaleamd',  // Scale AMD (EPYC 9xxx Genoa/Turin)
  '24adv', '26adv',            // Advance (EPYC 4xxx Raphael)
  '23scaleintel', '26scaleintel', // Scale Intel
]

interface OvhPlan {
  planCode: string
  invoiceName: string
  product: string
  addonFamilies: Array<{
    name: string
    addons: string[]
    default: string | null
  }>
  pricings: Array<{
    capacities: string[]
    intervalUnit: string
    price: number
    formattedPrice: string
    commitment: number
    mode: string
  }>
}

interface OvhAvailability {
  fqn: string
  memory: string
  planCode: string
  server: string
  storage: string
  systemStorage?: string
  datacenters: Array<{
    availability: string
    datacenter: string
  }>
}

async function ovhRequest(method: string, path: string): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000)
  const url = `${OVH_API_BASE}${path}`

  const signature = crypto
    .createHash('sha1')
    .update(`${OVH_APP_SECRET}+${OVH_CONSUMER_KEY}+${method}+${url}++${timestamp}`)
    .digest('hex')

  const response = await fetch(url, {
    method,
    headers: {
      'X-Ovh-Application': OVH_APP_KEY,
      'X-Ovh-Timestamp': timestamp.toString(),
      'X-Ovh-Signature': `$1$${signature}`,
      'X-Ovh-Consumer': OVH_CONSUMER_KEY,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`OVH API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

function parseInvoiceName(invoiceName: string): { series: string; cpu: string; cpuCores: number } {
  // Examples:
  // "SCALE-a1 | AMD EPYC 9135" -> Scale-a1, AMD EPYC 9135 (16 cores)
  // "ADVANCE-1 | AMD EPYC 4244P" -> Advance-1, AMD EPYC 4244P (6 cores)
  // "Scale-a6" -> Scale-a6

  const parts = invoiceName.split(' | ')
  const series = parts[0].trim()
  const cpu = parts[1]?.trim() || 'Unknown CPU'

  // Parse cores from CPU model
  const cpuCores = parseCpuCores(cpu)

  return { series, cpu, cpuCores }
}

// AMD EPYC base clock speeds in GHz
const EPYC_BASE_CLOCKS: Record<string, number> = {
  // EPYC 9xxx (Genoa/Turin)
  '9135': 2.6,
  '9175F': 4.2,
  '9255': 2.5,
  '9274F': 4.05,
  '9354': 3.25,
  '9354P': 3.25,
  '9355': 3.2,
  '9374F': 3.85,
  '9454': 2.75,
  '9454P': 2.75,
  '9455': 3.0,
  '9474F': 3.6,
  '9554': 3.1,
  '9554P': 3.1,
  '9555': 3.2,
  '9634': 2.25,
  '9654': 2.4,
  '9654P': 2.4,
  '9655': 2.6,
  '9684X': 2.55,
  '9754': 2.25,
  '9754S': 2.25,
  '9755': 2.7,
  '9965': 2.25,
  // EPYC 4xxx (Raphael/Bergamo)
  '4244P': 3.8,
  '4344P': 3.8,
  '4345P': 3.8,
  '4364P': 3.8,
  '4464P': 3.7,
  '4465P': 3.6,
  '4545P': 3.8,
  '4564P': 3.6,
  '4584PX': 4.2,
  '4585PX': 4.2,  // Similar to 4584PX
  '4245P': 3.4,   // OVH-specific SKU
  // Older EPYC 7xxx
  '7313': 3.0,
  '7413': 2.65,
  '7402': 2.8,
  '7451': 2.3,
  '7532': 2.4,
  '7542': 2.9,
  '7642': 2.3,
  '7702': 2.0,
  '7742': 2.25,
  '7763': 2.45,
}

function getCpuWithClock(cpu: string): string {
  // Extract model number and add clock speed if available
  const match = cpu.match(/(\d{4}[A-Z]*)/)
  if (match) {
    const model = match[1]
    const clock = EPYC_BASE_CLOCKS[model]
    if (clock) {
      return `${cpu} @ ${clock}GHz`
    }
  }
  return cpu
}

function parseCpuCores(cpu: string): number {
  // AMD EPYC 9xxx/4xxx core counts
  const epycCores: Record<string, number> = {
    // EPYC 9xxx (Genoa/Turin)
    '9135': 16,
    '9175F': 16,
    '9255': 24,
    '9274F': 24,
    '9354': 32,
    '9354P': 32,
    '9355': 32,
    '9374F': 32,
    '9454': 48,
    '9454P': 48,
    '9455': 64, // Turin
    '9474F': 48,
    '9554': 64,
    '9554P': 64,
    '9555': 64,
    '9634': 84,
    '9654': 96,
    '9654P': 96,
    '9655': 96, // Turin
    '9684X': 96,
    '9754': 128,
    '9754S': 128,
    '9755': 128, // Turin
    '9965': 192, // Turin dual-socket
    // EPYC 4xxx (Raphael/Bergamo)
    '4244P': 6,
    '4344P': 8,
    '4345P': 8,
    '4364P': 8,
    '4464P': 12,
    '4465P': 12,
    '4545P': 16,
    '4564P': 16,
    '4584PX': 16,
    // Older EPYC 7xxx (for reference)
    '7313': 16,
    '7413': 24,
    '7402': 24,
    '7451': 24,
    '7532': 32,
    '7542': 32,
    '7642': 48,
    '7702': 64,
    '7742': 64,
    '7763': 64,
  }

  // Extract model number from CPU string
  const match = cpu.match(/(\d{4}[A-Z]*)/)
  if (match) {
    const model = match[1]
    return epycCores[model] || 16 // Default to 16 cores if unknown
  }

  return 16 // Default
}

function parseMemoryFromAddon(memoryAddon: string): number {
  // Example: "ram-128g-ecc-4800-26scaleamd01-v2" -> 128
  const match = memoryAddon.match(/ram-(\d+)g/)
  return match ? parseInt(match[1], 10) : 0
}

function parseStorageFromAddon(storageAddon: string): { description: string; totalTB: number } {
  // Examples:
  // "softraid-2x1920nvme-pcie-gen5-26scaleamd01-v2" -> 2x 1.92TB NVMe
  // "noraid-0-26scaleamd01-v2" -> No storage
  // "softraid-6x3840nvme-pcie-gen5" -> 6x 3.84TB NVMe

  if (storageAddon.includes('noraid-0')) {
    return { description: 'System drives only', totalTB: 0 }
  }

  const match = storageAddon.match(/(\d+)x(\d+)(nvme|ssd|sa)/)
  if (match) {
    const count = parseInt(match[1], 10)
    const capacityGB = parseInt(match[2], 10)
    const type = match[3] === 'nvme' ? 'NVMe SSD' : match[3] === 'ssd' ? 'SSD' : 'SAS'
    const totalTB = (count * capacityGB) / 1000

    return {
      description: `${count}x ${(capacityGB / 1000).toFixed(2)}TB ${type}`,
      totalTB,
    }
  }

  return { description: 'Not specified', totalTB: 0 }
}

function isEpycGenoaOrRaphael(cpu: string): boolean {
  const cpuLower = cpu.toLowerCase()

  // EPYC 9xxx (Genoa/Turin)
  if (/epyc[- _]?9\d{3}/.test(cpuLower)) return true

  // EPYC 4xxx (Raphael/Bergamo)
  if (/epyc[- _]?4\d{3}/.test(cpuLower)) return true

  return false
}

function availabilityToStock(availability: string): { inStock: boolean; quantity: number | null } {
  // OVH availability codes:
  // "1H-low", "1H-high" - Available within 1 hour
  // "24H" - Available within 24 hours
  // "72H" - Available within 72 hours
  // "480H" - Available within 20 days
  // "unavailable" - Not available

  if (availability === 'unavailable' || availability === 'unknown') {
    return { inStock: false, quantity: 0 }
  }

  // Available if delivery time is 480H or less
  const inStock = ['1H-low', '1H-high', '24H', '72H', '480H', '1H', '24h', '72h'].some(code =>
    availability.toLowerCase().includes(code.toLowerCase())
  )

  // Estimate quantity based on delivery time
  let quantity: number | null = null
  if (availability.includes('1H-high')) quantity = 10
  else if (availability.includes('1H-low')) quantity = 3
  else if (availability.includes('24H')) quantity = 5
  else if (availability.includes('72H')) quantity = 2
  else if (availability.includes('480H')) quantity = 1

  return { inStock, quantity }
}

async function fetchCatalog(): Promise<OvhPlan[]> {
  console.log('Fetching OVH baremetalServers catalog...')
  const catalog = await ovhRequest('GET', '/order/catalog/public/baremetalServers?ovhSubsidiary=CA')
  return catalog.plans || []
}

async function fetchAvailability(server: string): Promise<OvhAvailability[]> {
  try {
    const availability = await ovhRequest('GET', `/dedicated/server/datacenter/availabilities?server=${server}`)
    return availability || []
  } catch (error) {
    console.log(`  Warning: Could not fetch availability for ${server}`)
    return []
  }
}

async function main() {
  console.log('Importing OVHcloud products from API...\n')

  // Delete existing OVH products
  const deleted = await prisma.competitorProduct.deleteMany({
    where: { competitor: 'OVHCLOUD' }
  })
  console.log(`Deleted ${deleted.count} existing OVHcloud products\n`)

  // Fetch catalog
  const allPlans = await fetchCatalog()
  console.log(`Found ${allPlans.length} total plans in catalog\n`)

  // Filter for relevant server families
  const relevantPlans = allPlans.filter(plan =>
    IMPORT_SERVER_FAMILIES.some(family => plan.product?.startsWith(family))
  )
  console.log(`Filtered to ${relevantPlans.length} Scale/Advance plans\n`)

  // Group plans by product (server model)
  const plansByProduct = new Map<string, OvhPlan[]>()
  for (const plan of relevantPlans) {
    if (!plansByProduct.has(plan.product)) {
      plansByProduct.set(plan.product, [])
    }
    plansByProduct.get(plan.product)!.push(plan)
  }

  let totalCreated = 0
  const createdProducts: Array<{
    city: string
    name: string
    cpu: string
    cores: number
    ram: number
    price: number
    inStock: boolean
    availability: string
  }> = []

  // Process each server model
  for (const [product, plans] of Array.from(plansByProduct.entries())) {
    console.log(`\nProcessing ${product}...`)

    // Get the base plan (usually the one without region suffix)
    const basePlan = plans.find((p: OvhPlan) => !p.planCode.includes('-sgp') && !p.planCode.includes('-syd') && !p.planCode.includes('-mum')) || plans[0]
    const { series, cpu, cpuCores } = parseInvoiceName(basePlan.invoiceName)

    // Skip if not modern EPYC
    if (!isEpycGenoaOrRaphael(cpu)) {
      console.log(`  Skipping ${product} (${cpu}) - not EPYC 9xxx/4xxx`)
      continue
    }

    // Get memory options
    const memoryFamily = basePlan.addonFamilies.find((f: { name: string }) => f.name === 'memory')
    const memoryOptions = memoryFamily?.addons || []
    const defaultMemory = memoryFamily?.default || memoryOptions[0]
    const baseRam = defaultMemory ? parseMemoryFromAddon(defaultMemory) : 128

    // Get storage options
    const storageFamily = basePlan.addonFamilies.find((f: { name: string }) => f.name === 'storage')
    const defaultStorage = storageFamily?.default || storageFamily?.addons?.[0] || ''
    const storage = parseStorageFromAddon(defaultStorage)

    // Build a map of regional prices (planCode suffix -> price in USD)
    // OVH has different prices for different regions: -sgp, -syd, -mum, etc.
    const regionalPrices = new Map<string, number>()
    for (const plan of plans) {
      const monthlyPricing = plan.pricings.find((p: OvhPlan['pricings'][0]) =>
        p.intervalUnit === 'month' &&
        p.capacities.includes('renew') &&
        p.commitment === 0 &&
        p.mode === 'default'
      )
      if (monthlyPricing) {
        const priceCad = monthlyPricing.price / 100000000
        const priceUsd = Math.round(priceCad * CAD_TO_USD)

        // Extract region suffix from planCode (e.g., "24adv02-v1-sgp" -> "sgp")
        const regionMatch = plan.planCode.match(/-([a-z]{3})$/)
        const regionKey = regionMatch ? regionMatch[1] : 'default'
        regionalPrices.set(regionKey, priceUsd)
      }
    }

    const defaultPrice = regionalPrices.get('default') || 0
    if (defaultPrice === 0 && regionalPrices.size === 0) {
      console.log(`  Skipping ${product} - no monthly pricing found`)
      continue
    }

    console.log(`  ${series}: ${cpu} (${cpuCores}c/${baseRam}GB) - base $${defaultPrice}/mo, regions: ${Array.from(regionalPrices.entries()).map(([k, v]) => `${k}=$${v}`).join(', ')}`)

    // Fetch availability per datacenter
    const availability = await fetchAvailability(product)

    // Group availability by datacenter
    const dcAvailability = new Map<string, string>()
    for (const config of availability) {
      for (const dc of config.datacenters) {
        // Keep the best availability for each datacenter
        const current = dcAvailability.get(dc.datacenter)
        if (!current || getBetterAvailability(dc.availability, current) === dc.availability) {
          dcAvailability.set(dc.datacenter, dc.availability)
        }
      }
    }

    // Map datacenter codes to regional pricing keys
    const dcToRegion: Record<string, string> = {
      'sgp': 'sgp', 'apac-sgp-a': 'sgp',
      'syd': 'syd', 'apac-syd-a': 'syd',
      'mum': 'mum', 'ynm': 'mum', 'in-west-mum-a': 'mum',
    }

    // Create product for each datacenter
    for (const [dcCode, avail] of Array.from(dcAvailability.entries())) {
      const dcInfo = OVH_DATACENTERS[dcCode]
      if (!dcInfo) {
        console.log(`    Skipping unknown datacenter: ${dcCode}`)
        continue
      }

      // Get regional price or fall back to default
      const regionKey = dcToRegion[dcCode] || 'default'
      const priceUsd = regionalPrices.get(regionKey) || regionalPrices.get('default') || defaultPrice

      // Get or create city
      const cityCode = `ovh-${dcCode}`
      let city = await prisma.city.findUnique({ where: { code: cityCode } })
      if (!city) {
        city = await prisma.city.create({
          data: {
            code: cityCode,
            name: dcInfo.name,
            country: dcInfo.country,
          }
        })
        console.log(`    Created city: ${dcInfo.name}, ${dcInfo.country}`)
      }

      const { inStock, quantity } = availabilityToStock(avail)

      // Create product - include product code to make name unique
      // e.g., "ADVANCE-2 (26adv02)" or "SCALE-A1 (26scaleamd01)"
      const productName = `${series.toUpperCase()} (${product})`

      // Determine source URL based on series
      const isAdvance = product.includes('adv')
      const sourceUrl = isAdvance
        ? 'https://www.ovhcloud.com/en/bare-metal/advance/'
        : 'https://www.ovhcloud.com/en/bare-metal/scale/'

      await prisma.competitorProduct.create({
        data: {
          competitor: 'OVHCLOUD',
          name: productName,
          cpu: getCpuWithClock(cpu.includes('AMD') ? cpu : `AMD ${cpu}`),
          cpuCores,
          ram: baseRam,
          storageDescription: storage.description,
          storageTotalTB: storage.totalTB,
          networkGbps: 25, // OVH Scale/Advance have 25Gbps
          priceUsd,
          cityId: city.id,
          sourceUrl,
          inStock,
          quantity,
          lastInventoryCheck: new Date(),
          lastVerified: new Date(),
        }
      })

      createdProducts.push({
        city: dcInfo.name,
        name: productName,
        cpu,
        cores: cpuCores,
        ram: baseRam,
        price: priceUsd,
        inStock,
        availability: avail,
      })
      totalCreated++
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Total created: ${totalCreated} OVHcloud products`)
  console.log(`${'='.repeat(60)}\n`)

  // Summary by series
  const bySeries = new Map<string, typeof createdProducts>()
  for (const p of createdProducts) {
    if (!bySeries.has(p.name)) {
      bySeries.set(p.name, [])
    }
    bySeries.get(p.name)!.push(p)
  }

  console.log('Summary by server series:\n')
  for (const [seriesName, products] of Array.from(bySeries.entries())) {
    const sample = products[0]
    const inStockCount = products.filter((p: typeof createdProducts[0]) => p.inStock).length
    console.log(`${seriesName}:`)
    console.log(`  CPU: ${sample.cpu} (${sample.cores} cores)`)
    console.log(`  RAM: ${sample.ram}GB`)
    console.log(`  Price: $${sample.price}/mo`)
    console.log(`  Datacenters: ${products.length} (${inStockCount} in stock)`)
    console.log(`  Availability: ${products.map(p => `${p.city}:${p.availability}`).slice(0, 5).join(', ')}...`)
    console.log()
  }
}

function getBetterAvailability(a: string, b: string): string {
  const priority: Record<string, number> = {
    '1H-high': 1,
    '1H-low': 2,
    '1H': 2,
    '24H': 3,
    '72H': 4,
    '480H': 5,
    'unavailable': 6,
  }

  const priorityA = priority[a] || 6
  const priorityB = priority[b] || 6

  return priorityA <= priorityB ? a : b
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
