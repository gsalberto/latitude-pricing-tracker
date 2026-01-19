import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.latitudeProduct.findMany({
      orderBy: { name: 'asc' },
      include: {
        comparisons: {
          include: {
            competitorProduct: {
              include: {
                city: true,
              },
            },
          },
        },
      },
    })
    return NextResponse.json(products)
  } catch (error) {
    console.error('Failed to fetch Latitude products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const product = await prisma.latitudeProduct.create({
      data: {
        name: body.name,
        cpu: body.cpu,
        cpuCores: body.cpuCores,
        ram: body.ram,
        storageDescription: body.storageDescription,
        storageTotalTB: body.storageTotalTB,
        networkGbps: body.networkGbps,
        priceUsd: body.priceUsd,
        generation: body.generation || 4,
      },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Failed to create Latitude product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
