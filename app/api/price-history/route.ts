import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Competitor } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const competitor = searchParams.get('competitor') as Competitor | null
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: { competitor?: Competitor } = {}
    if (competitor) {
      where.competitor = competitor
    }

    const priceHistory = await prisma.priceHistory.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(priceHistory)
  } catch (error) {
    console.error('Failed to fetch price history:', error)
    return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 })
  }
}
