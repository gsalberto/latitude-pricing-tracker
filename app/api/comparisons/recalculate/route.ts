import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePriceDifference } from '@/lib/calculations'

export async function POST() {
  try {
    const comparisons = await prisma.comparison.findMany({
      include: {
        latitudeProduct: true,
        competitorProduct: true,
      },
    })

    const updates = comparisons.map((comparison) => {
      const priceDifferencePercent = calculatePriceDifference(
        comparison.latitudeProduct.priceUsd,
        comparison.competitorProduct.priceUsd
      )
      return prisma.comparison.update({
        where: { id: comparison.id },
        data: { priceDifferencePercent },
      })
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    console.error('Failed to recalculate comparisons:', error)
    return NextResponse.json({ error: 'Failed to recalculate' }, { status: 500 })
  }
}
