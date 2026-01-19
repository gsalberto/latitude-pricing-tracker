import { PrismaClient } from '@prisma/client'

const TERASWITCH_API_KEY = '276b9cec61704fc89524218a1deb161b'
const TERASWITCH_API_SECRET = '2BG6VuwgWMy7FySt'
const TERASWITCH_API_URL = 'https://api.tsw.io'

// Potential Teraswitch regions to check - mapping to Latitude cities where possible
const POTENTIAL_REGIONS = [
  // US regions
  { code: 'DAL1', latitudeCity: 'Dallas', country: 'USA' },
  { code: 'DAL2', latitudeCity: 'Dallas', country: 'USA' },
  { code: 'LAX1', latitudeCity: 'Los Angeles', country: 'USA' },
  { code: 'LAX2', latitudeCity: 'Los Angeles', country: 'USA' },
  { code: 'EWR1', latitudeCity: 'New York', country: 'USA' },  // Newark → New York
  { code: 'EWR2', latitudeCity: 'New York', country: 'USA' },  // Newark → New York
  { code: 'NYC1', latitudeCity: 'New York', country: 'USA' },
  { code: 'ORD1', latitudeCity: 'Chicago', country: 'USA' },
  { code: 'CHI1', latitudeCity: 'Chicago', country: 'USA' },
  { code: 'MIA1', latitudeCity: 'Miami', country: 'USA' },
  { code: 'IAD1', latitudeCity: 'Ashburn', country: 'USA' },   // Ashburn/DC area
  { code: 'DCA1', latitudeCity: 'Ashburn', country: 'USA' },
  { code: 'ASH1', latitudeCity: 'Ashburn', country: 'USA' },

  // Europe
  { code: 'LON1', latitudeCity: 'London', country: 'UK' },
  { code: 'LHR1', latitudeCity: 'London', country: 'UK' },
  { code: 'AMS1', latitudeCity: 'Amsterdam', country: 'Netherlands' },
  { code: 'FRA1', latitudeCity: 'Frankfurt', country: 'Germany' },

  // Asia Pacific
  { code: 'SIN1', latitudeCity: 'Singapore', country: 'Singapore' },
  { code: 'SGP1', latitudeCity: 'Singapore', country: 'Singapore' },
  { code: 'TYO1', latitudeCity: 'Tokyo', country: 'Japan' },
  { code: 'NRT1', latitudeCity: 'Tokyo', country: 'Japan' },
  { code: 'SYD1', latitudeCity: 'Sydney', country: 'Australia' },

  // LATAM
  { code: 'GRU1', latitudeCity: 'São Paulo', country: 'Brazil' },
  { code: 'SAO1', latitudeCity: 'São Paulo', country: 'Brazil' },
  { code: 'BOG1', latitudeCity: 'Bogota', country: 'Colombia' },
  { code: 'SCL1', latitudeCity: 'Santiago', country: 'Chile' },
  { code: 'EZE1', latitudeCity: 'Buenos Aires', country: 'Argentina' },
  { code: 'MEX1', latitudeCity: 'Mexico City', country: 'Mexico' },
]

function isGenoaOrBetter(cpu: string): boolean {
  const cpuLower = cpu.toLowerCase()
  if (cpuLower.includes('epyc')) {
    if (/epyc[- _]?9\d{3}/.test(cpuLower)) return true
    if (cpuLower.includes('genoa')) return true
    if (cpuLower.includes('turin')) return true
  }
  return false
}

async function checkRegion(region: string): Promise<{ region: string; count: number; genoaCount: number; products: string[] }> {
  try {
    const response = await fetch(`${TERASWITCH_API_URL}/v2/Metal/Availability?Region=${region}`, {
      headers: {
        'Authorization': `Bearer ${TERASWITCH_API_KEY}:${TERASWITCH_API_SECRET}`
      }
    })

    const data = await response.json()

    if (!data.success) {
      return { region, count: 0, genoaCount: 0, products: [] }
    }

    const items = data.result || []
    const genoaItems = items.filter((item: any) => isGenoaOrBetter(item.tier?.cpu || ''))

    const products = genoaItems.map((item: any) => {
      const cpu = item.tier?.cpu || 'Unknown'
      const ram = item.memoryGb || 0
      const qty = item.quantity || 0
      const price = item.tier?.monthlyPrice || 0
      return `${cpu} ${ram}GB ($${price}/mo) x${qty}`
    })

    return {
      region,
      count: items.length,
      genoaCount: genoaItems.length,
      products
    }
  } catch (error) {
    return { region, count: 0, genoaCount: 0, products: [] }
  }
}

async function main() {
  console.log('Checking all potential Teraswitch regions for Genoa inventory...\n')

  const results: { code: string; latitudeCity: string; count: number; genoaCount: number; products: string[] }[] = []

  for (const region of POTENTIAL_REGIONS) {
    process.stdout.write(`Checking ${region.code} (${region.latitudeCity})... `)
    const result = await checkRegion(region.code)
    console.log(`${result.count} total, ${result.genoaCount} Genoa`)

    if (result.genoaCount > 0) {
      results.push({
        code: region.code,
        latitudeCity: region.latitudeCity,
        count: result.count,
        genoaCount: result.genoaCount,
        products: result.products
      })
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  console.log('\n=== Regions with Genoa inventory ===\n')

  if (results.length === 0) {
    console.log('No Genoa products found in any region')
    return
  }

  for (const r of results) {
    console.log(`${r.code} → ${r.latitudeCity}: ${r.genoaCount} Genoa products`)
    for (const p of r.products) {
      console.log(`  - ${p}`)
    }
    console.log()
  }

  // Generate the region config for import script
  console.log('=== Configuration for import script ===\n')
  console.log('const TERASWITCH_REGIONS = [')
  for (const r of results) {
    console.log(`  { code: '${r.code}', name: '${r.latitudeCity}', country: '${POTENTIAL_REGIONS.find(p => p.code === r.code)?.country}' },`)
  }
  console.log(']')
}

main().catch(console.error)
