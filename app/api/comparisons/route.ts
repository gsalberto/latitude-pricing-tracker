import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePriceDifference } from '@/lib/calculations'
import { Competitor } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const competitor = searchParams.get('competitor') as Competitor | null
    const cityId = searchParams.get('cityId')
    const position = searchParams.get('position') // 'cheaper', 'competitive', 'expensive'

    const where: {
      competitorProduct?: {
        competitor?: Competitor
        cityId?: string
      }
      priceDifferencePercent?: {
        gt?: number
        lt?: number
        gte?: number
        lte?: number
      }
    } = {}

    if (competitor || cityId) {
      where.competitorProduct = {}
      if (competitor) where.competitorProduct.competitor = competitor
      if (cityId) where.competitorProduct.cityId = cityId
    }

    if (position === 'cheaper') {
      where.priceDifferencePercent = { gt: 10 }
    } else if (position === 'expensive') {
      where.priceDifferencePercent = { lt: -10 }
    } else if (position === 'competitive') {
      where.priceDifferencePercent = { gte: -10, lte: 10 }
    }

    const comparisons = await prisma.comparison.findMany({
      where,
      orderBy: { priceDifferencePercent: 'desc' },
      include: {
        latitudeProduct: true,
        competitorProduct: {
          include: {
            city: true,
          },
        },
      },
    })
    return NextResponse.json(comparisons)
  } catch (error) {
    console.error('Failed to fetch comparisons:', error)
    return NextResponse.json({ error: 'Failed to fetch comparisons' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Fetch both products to calculate price difference
    const [latitudeProduct, competitorProduct] = await Promise.all([
      prisma.latitudeProduct.findUnique({ where: { id: body.latitudeProductId } }),
      prisma.competitorProduct.findUnique({ where: { id: body.competitorProductId } }),
    ])

    if (!latitudeProduct || !competitorProduct) {
      return NextResponse.json({ error: 'Products not found' }, { status: 404 })
    }

    const priceDifferencePercent = calculatePriceDifference(
      latitudeProduct.priceUsd,
      competitorProduct.priceUsd
    )

    const comparison = await prisma.comparison.create({
      data: {
        latitudeProductId: body.latitudeProductId,
        competitorProductId: body.competitorProductId,
        notes: body.notes || null,
        priceDifferencePercent,
      },
      include: {
        latitudeProduct: true,
        competitorProduct: {
          include: {
            city: true,
          },
        },
      },
    })
    return NextResponse.json(comparison, { status: 201 })
  } catch (error) {
    console.error('Failed to create comparison:', error)
    return NextResponse.json({ error: 'Failed to create comparison' }, { status: 500 })
  }
}
