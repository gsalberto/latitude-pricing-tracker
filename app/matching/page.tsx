import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

// Latitude products with their matching criteria (±25% of actual specs)
const latitudeMatchCriteria: Record<string, { minCores: number; maxCores: number; minRam: number; maxRam: number }> = {
  'm4.metal.small': { minCores: 5, maxCores: 8, minRam: 48, maxRam: 80 },
  'm4.metal.medium': { minCores: 12, maxCores: 20, minRam: 96, maxRam: 160 },
  'm4.metal.large': { minCores: 20, maxCores: 30, minRam: 288, maxRam: 480 },
  'm4.metal.xlarge': { minCores: 40, maxCores: 60, minRam: 576, maxRam: 960 },
  'f4.metal.small': { minCores: 10, maxCores: 16, minRam: 72, maxRam: 120 },
  'f4.metal.medium': { minCores: 12, maxCores: 20, minRam: 144, maxRam: 240 },
  'f4.metal.large': { minCores: 20, maxCores: 30, minRam: 576, maxRam: 960 },
  'rs4.metal.large': { minCores: 26, maxCores: 40, minRam: 576, maxRam: 960 },
  'rs4.metal.xlarge': { minCores: 52, maxCores: 80, minRam: 1152, maxRam: 1920 },
}

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

async function getMatchingData() {
  const latitudeProducts = await prisma.latitudeProduct.findMany({
    orderBy: { name: 'asc' },
  })

  const comparisons = await prisma.comparison.findMany({
    include: {
      latitudeProduct: true,
      competitorProduct: {
        include: { city: true }
      }
    }
  })

  // Group by competitor
  const byCompetitor: Record<string, {
    products: Array<{
      name: string
      cpu: string
      cpuCores: number
      ram: number
      priceUsd: number
      matchedTo: string[]
    }>
  }> = {}

  // Get unique competitor products with their matches
  const competitorProductMatches: Record<string, Set<string>> = {}

  for (const comparison of comparisons) {
    const compId = comparison.competitorProduct.id
    const latName = comparison.latitudeProduct.name

    if (!competitorProductMatches[compId]) {
      competitorProductMatches[compId] = new Set()
    }
    competitorProductMatches[compId].add(latName)
  }

  // Get all competitor products
  const competitorProducts = await prisma.competitorProduct.findMany({
    include: { city: true },
    orderBy: [{ competitor: 'asc' }, { cpuCores: 'asc' }]
  })

  // Group by competitor
  for (const product of competitorProducts) {
    if (!byCompetitor[product.competitor]) {
      byCompetitor[product.competitor] = { products: [] }
    }

    // Check if this product is already listed (by name)
    const existing = byCompetitor[product.competitor].products.find(p => p.name === product.name)
    if (!existing) {
      byCompetitor[product.competitor].products.push({
        name: product.name,
        cpu: product.cpu,
        cpuCores: product.cpuCores,
        ram: product.ram,
        priceUsd: product.priceUsd,
        matchedTo: Array.from(competitorProductMatches[product.id] || [])
      })
    }
  }

  return { latitudeProducts, byCompetitor }
}

export default async function MatchingPage() {
  const { latitudeProducts, byCompetitor } = await getMatchingData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Spec Matching Criteria</h1>
        <p className="text-muted-foreground">How Latitude products are matched to competitor products</p>
      </div>

      {/* Latitude Matching Criteria */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Latitude Product Matching Ranges</CardTitle>
          <CardDescription>Competitor products are matched if their specs fall within these ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Latitude SKU</TableHead>
                <TableHead>Actual Specs</TableHead>
                <TableHead>Cores Range</TableHead>
                <TableHead>RAM Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latitudeProducts.map((product) => {
                const criteria = latitudeMatchCriteria[product.name]
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.cpuCores}c / {product.ram}GB
                    </TableCell>
                    <TableCell>
                      {criteria ? `${criteria.minCores} - ${criteria.maxCores} cores` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {criteria ? `${criteria.minRam} - ${criteria.maxRam} GB` : 'N/A'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Competitor Products and Matches */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Competitor Products & Matches</h2>

        {Object.entries(byCompetitor).map(([competitor, data]) => (
          <Card key={competitor} className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={competitorColors[competitor]}>{competitor}</Badge>
                <span className="text-muted-foreground font-normal text-sm">
                  {data.products.length} unique products
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>Cores</TableHead>
                    <TableHead>RAM</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Matched To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.products.map((product, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {product.cpu}
                      </TableCell>
                      <TableCell>{product.cpuCores}</TableCell>
                      <TableCell>{product.ram} GB</TableCell>
                      <TableCell>${product.priceUsd}/mo</TableCell>
                      <TableCell>
                        {product.matchedTo.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {product.matchedTo.map((lat) => (
                              <Badge key={lat} variant="outline" className="text-xs">
                                {lat}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No matches</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
