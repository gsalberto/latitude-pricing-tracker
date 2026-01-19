import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPercentage, getPricePositionColor } from '@/lib/calculations'
import { Competitor } from '@prisma/client'

async function getStats() {
  const comparisons = await prisma.comparison.findMany({
    include: {
      competitorProduct: true,
    },
  })

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

  Object.values(competitorStats).forEach((stats) => {
    if (stats.count > 0) {
      stats.avgDiff = stats.avgDiff / stats.count
    }
  })

  return { competitorStats }
}

export default async function Dashboard() {
  const stats = await getStats()

  // Dark mode compatible competitor badge colors
  const competitorColors: Record<string, string> = {
    VULTR: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    OVHCLOUD: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    HETZNER: 'bg-red-500/20 text-red-400 border border-red-500/30',
    TERASWITCH: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    CHERRYSERVERS: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
    LIMESTONENETWORKS: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    SERVERSCOM: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    DATAPACKET: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    PHOENIXNAP: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
    LEASEWEB: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    SCALEWAY: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
    LIQUIDWEB: 'bg-lime-500/20 text-lime-400 border border-lime-500/30',
    IBM: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
    OCI: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  }

  // Filter to only show competitors with comparisons
  const activeCompetitors = (Object.entries(stats.competitorStats) as [Competitor, typeof stats.competitorStats[Competitor]][])
    .filter(([, data]) => data.count > 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of Latitude.sh Gen4 competitive pricing position</p>
      </div>

      {/* Competitor Summary */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Position by Competitor</CardTitle>
          <CardDescription>Average price position against each competitor</CardDescription>
        </CardHeader>
        <CardContent>
          {activeCompetitors.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No comparisons yet. Add competitor data to see pricing analysis.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {activeCompetitors.map(([competitor, data]) => (
                <Card key={competitor} className="border-border/30 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      <Badge className={competitorColors[competitor]}>{competitor}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Comparisons:</span>
                        <span className="font-medium">{data.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg. Diff:</span>
                        <Badge className={getPricePositionColor(data.avgDiff)}>
                          {formatPercentage(data.avgDiff)}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs pt-2 border-t border-border/30">
                        <span className="text-emerald-400">{data.cheaper} cheaper</span>
                        <span className="text-amber-400">{data.competitive} tie</span>
                        <span className="text-red-400">{data.expensive} more</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
