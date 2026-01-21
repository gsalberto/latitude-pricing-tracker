import { Navigation } from "@/components/layout/navigation"
import { prisma } from "@/lib/prisma"

async function getLastUpdated() {
  const lastUpdatedProduct = await prisma.competitorProduct.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  })
  return lastUpdatedProduct?.updatedAt || null
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const lastUpdated = await getLastUpdated()

  return (
    <div className="flex min-h-screen">
      <Navigation lastUpdated={lastUpdated} />
      <main className="flex-1 p-8 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
