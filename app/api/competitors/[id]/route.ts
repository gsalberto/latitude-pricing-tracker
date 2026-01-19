import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.competitorProduct.findUnique({
      where: { id },
      include: {
        city: true,
        comparisons: {
          include: {
            latitudeProduct: true,
          },
        },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (error) {
    console.error('Failed to fetch competitor product:', error)
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
    const product = await prisma.competitorProduct.update({
      where: { id },
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
        inventoryUrl: body.inventoryUrl,
        inStock: body.inStock,
        lastVerified: body.lastVerified ? new Date(body.lastVerified) : undefined,
        lastInventoryCheck: body.lastInventoryCheck ? new Date(body.lastInventoryCheck) : undefined,
      },
      include: {
        city: true,
      },
    })
    return NextResponse.json(product)
  } catch (error) {
    console.error('Failed to update competitor product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.competitorProduct.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete competitor product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
