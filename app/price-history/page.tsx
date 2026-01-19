import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown } from 'lucide-react'

async function getPriceHistory() {
  return prisma.priceHistory.findMany({
    orderBy: { recordedAt: 'desc' },
    take: 100,
  })
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export default async function PriceHistoryPage() {
  const priceHistory = await getPriceHistory()

  const increases = priceHistory.filter(h => h.changePercent > 0).length
  const decreases = priceHistory.filter(h => h.changePercent < 0).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Price History</h1>
        <p className="text-muted-foreground">Track competitor price changes over time</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Changes</CardDescription>
            <CardTitle className="text-3xl">{priceHistory.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Price changes &gt;10% recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Price Increases</CardDescription>
            <CardTitle className="text-3xl text-red-400 flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              {increases}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Competitors raised prices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Price Decreases</CardDescription>
            <CardTitle className="text-3xl text-emerald-400 flex items-center gap-2">
              <TrendingDown className="h-6 w-6" />
              {decreases}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Competitors lowered prices</p>
          </CardContent>
        </Card>
      </div>

      {/* Price History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Price Changes</CardTitle>
          <CardDescription>
            {priceHistory.length === 0
              ? 'No price changes recorded yet. Changes greater than 10% will appear here.'
              : `Showing ${priceHistory.length} most recent changes`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priceHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No price changes detected yet.</p>
              <p className="text-sm mt-2">
                When competitor prices change by more than 10%, they will be recorded here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Competitor</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Old Price</TableHead>
                  <TableHead className="text-right">New Price</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(record.recordedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={competitorColors[record.competitor]}>
                        {record.competitor}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{record.productName}</TableCell>
                    <TableCell>{record.cityName}</TableCell>
                    <TableCell className="text-right">{formatPrice(record.oldPrice)}</TableCell>
                    <TableCell className="text-right">{formatPrice(record.newPrice)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          record.changePercent > 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {record.changePercent > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {record.changePercent > 0 ? '+' : ''}
                        {record.changePercent.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
