import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePriceDifference } from '@/lib/calculations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const comparison = await prisma.comparison.findUnique({
      where: { id },
      include: {
        latitudeProduct: true,
        competitorProduct: {
          include: {
            city: true,
          },
        },
      },
    })
    if (!comparison) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 })
    }
    return NextResponse.json(comparison)
  } catch (error) {
    console.error('Failed to fetch comparison:', error)
    return NextResponse.json({ error: 'Failed to fetch comparison' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Fetch both products to recalculate price difference if products changed
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

    const comparison = await prisma.comparison.update({
      where: { id },
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
    return NextResponse.json(comparison)
  } catch (error) {
    console.error('Failed to update comparison:', error)
    return NextResponse.json({ error: 'Failed to update comparison' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.comparison.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete comparison:', error)
    return NextResponse.json({ error: 'Failed to delete comparison' }, { status: 500 })
  }
}
