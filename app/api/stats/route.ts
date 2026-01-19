import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Competitor } from '@prisma/client'

export async function GET() {
  try {
    // Get counts
    const [
      latitudeProductCount,
      competitorProductCount,
      comparisonCount,
    ] = await Promise.all([
      prisma.latitudeProduct.count(),
      prisma.competitorProduct.count(),
      prisma.comparison.count(),
    ])

    // Get comparisons for analysis
    const comparisons = await prisma.comparison.findMany({
      include: {
        competitorProduct: true,
      },
    })

    // Calculate average position by competitor
    const competitorStats: Record<Competitor, { count: number; avgDiff: number; cheaper: number; competitive: number; expensive: number }> = {
      VULTR: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
      OVHCLOUD: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
      HETZNER: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
      TERASWITCH: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
      CHERRYSERVERS: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
      LIMESTONENETWORKS: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
      SERVERSCOM: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
      DATAPACKET: { count: 0, avgDiff: 0, cheaper: 0, competitive: 0, expensive: 0 },
    }

    comparisons.forEach((comparison) => {
      const competitor = comparison.competitorProduct.competitor
      const stats = competitorStats[competitor]
      stats.count++
      stats.avgDiff += comparison.priceDifferencePercent

      if (comparison.priceDifferencePercent > 10) {
        stats.cheaper++
      } else if (comparison.priceDifferencePercent < -10) {
        stats.expensive++
      } else {
        stats.competitive++
      }
    })

    // Calculate averages
    Object.values(competitorStats).forEach((stats) => {
      if (stats.count > 0) {
        stats.avgDiff = stats.avgDiff / stats.count
      }
    })

    // Overall stats
    const totalComparisons = comparisons.length
    const cheaperCount = comparisons.filter((c) => c.priceDifferencePercent > 10).length
    const competitiveCount = comparisons.filter((c) => c.priceDifferencePercent >= -10 && c.priceDifferencePercent <= 10).length
    const expensiveCount = comparisons.filter((c) => c.priceDifferencePercent < -10).length
    const avgPriceDiff = totalComparisons > 0
      ? comparisons.reduce((sum, c) => sum + c.priceDifferencePercent, 0) / totalComparisons
      : 0

    return NextResponse.json({
      counts: {
        latitudeProducts: latitudeProductCount,
        competitorProducts: competitorProductCount,
        comparisons: comparisonCount,
      },
      overall: {
        cheaper: cheaperCount,
        competitive: competitiveCount,
        expensive: expensiveCount,
        avgPriceDifference: avgPriceDiff,
      },
      byCompetitor: competitorStats,
    })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
