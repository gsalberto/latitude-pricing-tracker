import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ComparisonTabs } from './comparisons-tabs'
import Link from 'next/link'

async function getComparisons() {
  return prisma.comparison.findMany({
    orderBy: { priceDifferencePercent: 'desc' },
    include: {
      latitudeProduct: true,
      competitorProduct: {
        include: { city: true },
      },
    },
  })
}

async function getLatitudeProducts() {
  return prisma.latitudeProduct.findMany({
    orderBy: { name: 'asc' },
  })
}

export default async function ComparisonsPage({
  searchParams,
}: {
  searchParams: Promise<{ competitor?: string; position?: string }>
}) {
  const params = await searchParams
  const [comparisons, latitudeProducts] = await Promise.all([
    getComparisons(),
    getLatitudeProducts(),
  ])

  const cheaperCount = comparisons.filter((c) => c.priceDifferencePercent > 10).length
  const competitiveCount = comparisons.filter((c) => c.priceDifferencePercent >= -10 && c.priceDifferencePercent <= 10).length
  const expensiveCount = comparisons.filter((c) => c.priceDifferencePercent < -10).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Comparisons</h1>
        <p className="text-muted-foreground">Product matchings and price analysis</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/comparisons?position=cheaper">
          <Card className={`border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors cursor-pointer h-full ${params.position === 'cheaper' ? 'ring-2 ring-emerald-500' : ''}`}>
            <CardHeader className="pb-2">
              <CardDescription className="text-emerald-400/70">Latitude is Cheaper</CardDescription>
              <CardTitle className="text-3xl text-emerald-400">{cheaperCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{cheaperCount} comparisons where Latitude is &gt;10% cheaper</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/comparisons?position=competitive">
          <Card className={`border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer h-full ${params.position === 'competitive' ? 'ring-2 ring-amber-500' : ''}`}>
            <CardHeader className="pb-2">
              <CardDescription className="text-amber-400/70">Competitive</CardDescription>
              <CardTitle className="text-3xl text-amber-400">{competitiveCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{competitiveCount} comparisons within ±10% price difference</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/comparisons?position=expensive">
          <Card className={`border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer h-full ${params.position === 'expensive' ? 'ring-2 ring-red-500' : ''}`}>
            <CardHeader className="pb-2">
              <CardDescription className="text-red-400/70">Latitude is More Expensive</CardDescription>
              <CardTitle className="text-3xl text-red-400">{expensiveCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{expensiveCount} comparisons where Latitude is &gt;10% more expensive</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Tabbed Comparisons by Latitude SKU */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Comparisons by Latitude SKU</CardTitle>
          <CardDescription>{comparisons.length} total comparisons</CardDescription>
        </CardHeader>
        <CardContent>
          {comparisons.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No comparisons yet. Create your first comparison to start tracking price positions.
            </p>
          ) : (
            <ComparisonTabs
              comparisons={comparisons}
              latitudeProducts={latitudeProducts}
              initialCompetitor={params.competitor}
              initialPosition={params.position}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
