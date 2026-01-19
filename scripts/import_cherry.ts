import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// Cherryservers region mapping
const cherryCityMap: Record<string, { name: string; country: string }> = {
  'LT-Siauliai': { name: 'Siauliai', country: 'Lithuania' },
  'NL-Amsterdam': { name: 'Amsterdam', country: 'Netherlands' },
  'DE-Frankfurt': { name: 'Frankfurt', country: 'Germany' },
  'SE-Stockholm': { name: 'Stockholm', country: 'Sweden' },
  'US-Chicago': { name: 'Chicago', country: 'USA' },
  'SG-Singapore': { name: 'Singapore', country: 'Singapore' },
}

async function main() {
  const plansData = JSON.parse(fs.readFileSync('/tmp/cherry_plans.json', 'utf-8'))

  const baremetalPlans = plansData.filter((p: any) => p.type === 'baremetal')
  console.log(`Processing ${baremetalPlans.length} Cherryservers bare metal plans...`)

  // Ensure all cities exist
  const cityIdMap: Record<string, string> = {}
  for (const [code, info] of Object.entries(cherryCityMap)) {
    const cityCode = code.toUpperCase().replace(/-/g, '_')
    let city = await prisma.city.findUnique({ where: { code: cityCode } })
    if (!city) {
      city = await prisma.city.create({
        data: { code: cityCode, name: info.name, country: info.country }
      })
      console.log(`Created city: ${info.name}, ${info.country} (${cityCode})`)
    }
    cityIdMap[code] = city.id
    cityIdMap[code.toUpperCase()] = city.id
    cityIdMap[code.toLowerCase()] = city.id
  }

  let created = 0
  let skipped = 0

  for (const plan of baremetalPlans) {
    // Get plan specs
    const specs = plan.specs || {}

    // CPU info
    let cpuName = 'Unknown CPU'
    let cpuCores = 1
    if (specs.cpus && specs.cpus.length > 0) {
      const cpu = specs.cpus[0]
      cpuName = `${cpu.name || ''} @ ${cpu.frequency || ''}`
      cpuCores = (cpu.cores || 1) * (specs.cpus.length || 1)
    }

    // RAM
    let ram = 0
    if (specs.memory && specs.memory.total) {
      ram = Math.round(specs.memory.total / 1024) // Convert MB to GB
    }

    // Storage
    let storageDesc = ''
    let storageTB = 0
    if (specs.drives && specs.drives.length > 0) {
      const driveDescs: string[] = []
      for (const drive of specs.drives) {
        const count = drive.count || 1
        const size = drive.size || 0
        const unit = drive.unit || 'GB'
        const type = drive.type || 'SSD'
        driveDescs.push(`${count}x ${size}${unit} ${type}`)

        // Calculate total TB
        let sizeGB = size
        if (unit === 'TB') sizeGB = size * 1024
        storageTB += (count * sizeGB) / 1024
      }
      storageDesc = driveDescs.join(' + ')
    }

    // Network
    let network = 1
    if (specs.nic && specs.nic.speed) {
      network = specs.nic.speed / 1000 // Convert Mbps to Gbps
    }

    // Get available regions
    const regions = plan.available_regions || []

    // Get pricing (monthly in EUR)
    let monthlyPrice = 0
    if (plan.pricing && plan.pricing.length > 0) {
      for (const price of plan.pricing) {
        if (price.unit === 'Monthly') {
          monthlyPrice = price.price || 0
          break
        }
      }
    }

    if (monthlyPrice === 0) continue

    // Create for each region
    for (const region of regions) {
      const regionSlug = region.slug || region.id || region
      const cityId = cityIdMap[regionSlug] || cityIdMap[regionSlug.toLowerCase()] || cityIdMap[regionSlug.toUpperCase()]

      if (!cityId) {
        // Try to find by name
        const cityInfo = cherryCityMap[regionSlug] || cherryCityMap[regionSlug.toLowerCase()]
        if (!cityInfo) {
          console.log(`Unknown region: ${regionSlug}`)
          continue
        }
      }

      const finalCityId = cityId || Object.values(cityIdMap)[0] // Fallback

      // Check if exists
      const existing = await prisma.competitorProduct.findFirst({
        where: {
          competitor: 'CHERRYSERVERS',
          name: plan.name || plan.slug,
          cityId: finalCityId,
        }
      })

      if (existing) {
        skipped++
        continue
      }

      try {
        await prisma.competitorProduct.create({
          data: {
            competitor: 'CHERRYSERVERS',
            name: plan.name || plan.slug,
            cpu: cpuName.substring(0, 200),
            cpuCores: cpuCores,
            ram: ram || 8,
            storageDescription: storageDesc.substring(0, 200) || 'See Cherryservers for details',
            storageTotalTB: storageTB || 0.5,
            networkGbps: network,
            cityId: finalCityId,
            priceUsd: Math.round(monthlyPrice * 1.1), // EUR to USD approx
            sourceUrl: `https://www.cherryservers.com/pricing/dedicated-servers`,
            inventoryUrl: `https://www.cherryservers.com/pricing/dedicated-servers`,
            inStock: true,
            lastVerified: new Date(),
          }
        })
        created++
      } catch (e) {
        console.error(`Error creating ${plan.name}:`, e)
      }
    }
  }

  console.log(`\nDone! Created ${created} Cherryservers products, skipped ${skipped} existing.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
