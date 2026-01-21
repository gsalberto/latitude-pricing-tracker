import { PrismaClient, Competitor } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

const DATAPACKET_API_KEY = process.env.DATAPACKET_API_KEY
const GRAPHQL_ENDPOINT = 'https://api.datapacket.com/v0/graphql'

interface DataPacketConfig {
  configurationId: string
  memory: number
  stockCount: number
  monthlyHwPrice: {
    amount: string
    currency: string
  }
  cpus: {
    name: string
    cores: number
    threads: number
  }[]
  location: {
    name: string
    short: string
    region: string
  }
  uplink: {
    ports: {
      capacity: number
    }[]
  }
  storage: {
    type: string
    size: number
  }[]
}

// Map DataPacket locations to countries
const LOCATION_TO_COUNTRY: Record<string, string> = {
  'Amsterdam': 'Netherlands',
  'Ashburn': 'USA',
  'Athens': 'Greece',
  'Atlanta': 'USA',
  'Auckland': 'New Zealand',
  'Berlin': 'Germany',
  'Bogotá': 'Colombia',
  'Boston': 'USA',
  'Bucharest': 'Romania',
  'Buenos Aires': 'Argentina',
  'Chicago': 'USA',
  'Dallas': 'USA',
  'Denver': 'USA',
  'Frankfurt': 'Germany',
  'Hong Kong': 'Hong Kong',
  'Johannesburg': 'South Africa',
  'Las Vegas': 'USA',
  'London': 'UK',
  'Los Angeles': 'USA',
  'Madrid': 'Spain',
  'McAllen': 'USA',
  'Melbourne': 'Australia',
  'Mexico City': 'Mexico',
  'Miami': 'USA',
  'Milan': 'Italy',
  'Mumbai': 'India',
  'New York': 'USA',
  'Osaka': 'Japan',
  'Paris': 'France',
  'Phoenix': 'USA',
  'Portland': 'USA',
  'Prague': 'Czech Republic',
  'Salt Lake City': 'USA',
  'San Jose': 'USA',
  'Santiago': 'Chile',
  'São Paulo': 'Brazil',
  'Seattle': 'USA',
  'Singapore': 'Singapore',
  'Sofia': 'Bulgaria',
  'Stockholm': 'Sweden',
  'Sydney': 'Australia',
  'Taipei': 'Taiwan',
  'Tokyo': 'Japan',
  'Toronto': 'Canada',
  'Vienna': 'Austria',
  'Warsaw': 'Poland',
  'Zurich': 'Switzerland',
}

// Check if CPU is modern EPYC (9xxx Genoa/Turin or 4xxx Raphael/Bergamo)
function isModernEpyc(cpuName: string): boolean {
  const lower = cpuName.toLowerCase()
  if (!lower.includes('epyc')) return false
  // Match EPYC 9xxx or EPYC 4xxx
  return /epyc\s*9\d{3}/.test(lower) || /epyc\s*4\d{3}/.test(lower)
}

async function fetchConfigurations(): Promise<DataPacketConfig[]> {
  const query = `{
    provisioningConfigurations {
      configurationId
      memory
      stockCount
      monthlyHwPrice { amount currency }
      cpus { name cores threads }
      location { name short region }
      uplink { ports { capacity } }
      storage { type size }
    }
  }`

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DATAPACKET_API_KEY}`,
    },
    body: JSON.stringify({ query }),
  })

  const json = await response.json()
  if (json.errors) {
    console.error('GraphQL errors:', json.errors)
    throw new Error('Failed to fetch configurations')
  }

  return json.data.provisioningConfigurations
}

function formatStorageDescription(storage: { type: string; size: number }[]): { description: string; totalTB: number } {
  const grouped: Record<string, { count: number; size: number }> = {}

  for (const disk of storage) {
    const key = `${disk.type}-${disk.size}`
    if (!grouped[key]) {
      grouped[key] = { count: 0, size: disk.size }
    }
    grouped[key].count++
  }

  const parts: string[] = []
  let totalGB = 0

  for (const [key, info] of Object.entries(grouped)) {
    const type = key.split('-')[0].replace('_', ' ')
    const sizeStr = info.size >= 1000 ? `${(info.size / 1000).toFixed(1)}TB` : `${info.size}GB`
    parts.push(`${info.count}x ${sizeStr} ${type}`)
    totalGB += info.count * info.size
  }

  return {
    description: parts.join(' + ') || 'No storage',
    totalTB: totalGB / 1000,
  }
}

function getNetworkGbps(ports: { capacity: number }[]): number {
  // Sum up all port capacities (in Gbps)
  return ports.reduce((sum, port) => sum + port.capacity, 0)
}

async function main() {
  if (!DATAPACKET_API_KEY) {
    console.error('DATAPACKET_API_KEY not set in environment')
    process.exit(1)
  }

  console.log('Fetching DataPacket configurations...')
  const configs = await fetchConfigurations()
  console.log(`Found ${configs.length} total configurations`)

  // Filter for modern EPYC
  const modernEpycConfigs = configs.filter(c => isModernEpyc(c.cpus[0]?.name || ''))
  console.log(`Found ${modernEpycConfigs.length} modern EPYC configurations`)

  let created = 0
  let updated = 0
  const productsByCity: Record<string, number> = {}

  for (const config of modernEpycConfigs) {
    const cpu = config.cpus[0]
    if (!cpu) continue

    const locationName = config.location.name
    const country = LOCATION_TO_COUNTRY[locationName]

    if (!country) {
      console.log(`  Skipping unknown location: ${locationName}`)
      continue
    }

    // Get or create city
    const cityCode = `datapacket-${config.location.short.toLowerCase()}`
    let city = await prisma.city.findUnique({ where: { code: cityCode } })

    if (!city) {
      city = await prisma.city.create({
        data: {
          code: cityCode,
          name: locationName,
          country: country,
        },
      })
    }

    const storage = formatStorageDescription(config.storage)
    const networkGbps = getNetworkGbps(config.uplink.ports)
    const priceUsd = parseFloat(config.monthlyHwPrice.amount)

    // Create product name
    const productName = `${cpu.name}-${config.memory}GB-${config.configurationId}`

    const productData = {
      competitor: Competitor.DATAPACKET,
      name: productName,
      cpu: `AMD ${cpu.name} (${cpu.cores}c/${cpu.threads}t)`,
      cpuCores: cpu.cores,
      ram: config.memory,
      storageDescription: storage.description,
      storageTotalTB: storage.totalTB,
      networkGbps: networkGbps,
      priceUsd: priceUsd,
      sourceUrl: 'https://www.datapacket.com/pricing',
      inStock: config.stockCount > 0,
      quantity: config.stockCount,
      cityId: city.id,
    }

    try {
      const existing = await prisma.competitorProduct.findUnique({
        where: {
          competitor_name_cityId: {
            competitor: Competitor.DATAPACKET,
            name: productName,
            cityId: city.id,
          },
        },
      })

      if (existing) {
        await prisma.competitorProduct.update({
          where: { id: existing.id },
          data: productData,
        })
        updated++
      } else {
        await prisma.competitorProduct.create({ data: productData })
        created++
      }

      productsByCity[`${locationName}, ${country}`] = (productsByCity[`${locationName}, ${country}`] || 0) + 1

      const stockStatus = config.stockCount > 0 ? `${config.stockCount} in stock` : 'out of stock'
      console.log(`  + ${cpu.name} ${config.memory}GB in ${locationName}: $${priceUsd}/mo (${stockStatus})`)
    } catch (error) {
      console.error(`  Failed to save ${productName}:`, error)
    }
  }

  console.log(`\nTotal: Created ${created}, Updated ${updated} DataPacket products`)
  console.log('\nProducts by city:')
  Object.entries(productsByCity)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, count]) => console.log(`  ${city}: ${count} products`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
