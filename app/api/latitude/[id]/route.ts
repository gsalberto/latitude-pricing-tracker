import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.latitudeProduct.findUnique({
      where: { id },
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
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (error) {
    console.error('Failed to fetch Latitude product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const product = await prisma.latitudeProduct.update({
      where: { id },
      data: {
        name: body.name,
        cpu: body.cpu,
        cpuCores: body.cpuCores,
        ram: body.ram,
        storageDescription: body.storageDescription,
        storageTotalTB: body.storageTotalTB,
        networkGbps: body.networkGbps,
        priceUsd: body.priceUsd,
        generation: body.generation,
      },
    })
    return NextResponse.json(product)
  } catch (error) {
    console.error('Failed to update Latitude product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.latitudeProduct.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete Latitude product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
