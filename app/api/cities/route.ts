import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const cities = await prisma.city.findMany({
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(cities)
  } catch (error) {
    console.error('Failed to fetch cities:', error)
    return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const city = await prisma.city.create({
      data: {
        code: body.code,
        name: body.name,
        country: body.country,
      },
    })
    return NextResponse.json(city, { status: 201 })
  } catch (error) {
    console.error('Failed to create city:', error)
    return NextResponse.json({ error: 'Failed to create city' }, { status: 500 })
  }
}
