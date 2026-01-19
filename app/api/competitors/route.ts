import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Competitor } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const competitor = searchParams.get('competitor') as Competitor | null
    const cityId = searchParams.get('cityId')
    const inStock = searchParams.get('inStock')

    const where: {
      competitor?: Competitor
      cityId?: string
      inStock?: boolean
    } = {}

    if (competitor) where.competitor = competitor
    if (cityId) where.cityId = cityId
    if (inStock !== null) where.inStock = inStock === 'true'

    const products = await prisma.competitorProduct.findMany({
      where,
      orderBy: [{ competitor: 'asc' }, { name: 'asc' }],
      include: {
        city: true,
        comparisons: {
          include: {
            latitudeProduct: true,
          },
        },
      },
    })
    return NextResponse.json(products)
  } catch (error) {
    console.error('Failed to fetch competitor products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const product = await prisma.competitorProduct.create({
      data: {
        competitor: body.competitor,
        name: body.name,
        cpu: body.cpu,
        cpuCores: body.cpuCores,
        ram: body.ram,
        storageDescription: body.storageDescription,
        storageTotalTB: body.storageTotalTB,
        networkGbps: body.networkGbps,
        cityId: body.cityId,
        priceUsd: body.priceUsd,
        sourceUrl: body.sourceUrl,
        inventoryUrl: body.inventoryUrl || null,
        inStock: body.inStock ?? true,
        lastVerified: body.lastVerified ? new Date(body.lastVerified) : new Date(),
      },
      include: {
        city: true,
      },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Failed to create competitor product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
