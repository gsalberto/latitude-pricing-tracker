import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Update inventory status for a competitor product
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
        inStock: body.inStock,
        lastInventoryCheck: new Date(),
      },
      include: {
        city: true,
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Failed to update inventory:', error)
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 })
  }
}
