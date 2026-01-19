'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ProductTooltip } from '@/components/product-tooltip'
import { formatPrice, formatPercentage } from '@/lib/calculations'
import { CheckCircle, XCircle, MapPin, Building2, Server, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

type ViewMode = 'by-sku' | 'by-competitor'
type SortDirection = 'asc' | 'desc' | null

interface LatitudeProduct {
  id: string
  name: string
  cpu: string
  cpuCores: number
  ram: number
  storageDescription: string
  storageTotalTB: number
  networkGbps: number
  priceUsd: number
  generation: number
}

interface City {
  id: string
  code: string
  name: string
  country: string
}

interface CompetitorProduct {
  id: string
  competitor: string
  name: string
  cpu: string
  cpuCores: number
  ram: number
  storageDescription: string
  storageTotalTB: number
  networkGbps: number
  priceUsd: number
  inStock: boolean
  quantity: number | null
  city: City
  sourceUrl: string
}

interface Comparison {
  id: string
  priceDifferencePercent: number
  notes: string | null
  latitudeProduct: LatitudeProduct
  competitorProduct: CompetitorProduct
}

interface ComparisonTabsProps {
  comparisons: Comparison[]
  latitudeProducts: LatitudeProduct[]
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
  IBM: 'bg-sky-500/20 text-sky-400 border border-sky-400/30',
  OCI: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
}

// Helper to determine if a country is US (for city-level vs country-level comparisons)
const isUSCountry = (country: string) => country === 'USA' || country === 'United States'

// Helper to get location display string
const getLocationDisplay = (city: City) => {
  if (isUSCountry(city.country)) {
    return { primary: city.name, secondary: 'USA' }
  }
  return { primary: city.country, secondary: null }
}

// Helper to get location filter key (city ID for US, country for others)
const getLocationFilterKey = (city: City) => {
  if (isUSCountry(city.country)) {
    return `city:${city.id}`
  }
  return `country:${city.country}`
}

export function ComparisonTabs({ comparisons, latitudeProducts }: ComparisonTabsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('by-sku')
  const [selectedLocations, setSelectedLocations] = useState<Record<string, string>>({})
  const [selectedCompetitors, setSelectedCompetitors] = useState<Record<string, string>>({})
  const [selectedSkus, setSelectedSkus] = useState<Record<string, string>>({})
  const [sortDirection, setSortDirection] = useState<Record<string, SortDirection>>({})

  // Toggle sort direction
  const toggleSort = (key: string) => {
    setSortDirection(prev => {
      const current = prev[key]
      if (current === null || current === undefined) return { ...prev, [key]: 'desc' }
      if (current === 'desc') return { ...prev, [key]: 'asc' }
      return { ...prev, [key]: null }
    })
  }

  // Sort comparisons by price difference
  const sortComparisons = (comps: Comparison[], key: string) => {
    const direction = sortDirection[key]
    if (!direction) return comps

    return [...comps].sort((a, b) => {
      if (direction === 'desc') {
        return b.priceDifferencePercent - a.priceDifferencePercent
      }
      return a.priceDifferencePercent - b.priceDifferencePercent
    })
  }

  // Get unique competitors from all comparisons
  const allCompetitors = useMemo(() => {
    const competitors = new Set(comparisons.map(c => c.competitorProduct.competitor))
    return Array.from(competitors).sort()
  }, [comparisons])

  // Get unique locations from comparisons for each product
  // US: city-level, Others: country-level
  const locationsByProduct = useMemo(() => {
    const result: Record<string, {
      locations: Array<{ key: string; label: string; type: 'city' | 'country' }>
    }> = {}

    for (const product of latitudeProducts) {
      const productComparisons = comparisons.filter(c => c.latitudeProduct.id === product.id)
      const locationsMap = new Map<string, { key: string; label: string; type: 'city' | 'country' }>()

      for (const comp of productComparisons) {
        const city = comp.competitorProduct.city
        const filterKey = getLocationFilterKey(city)

        if (!locationsMap.has(filterKey)) {
          if (isUSCountry(city.country)) {
            locationsMap.set(filterKey, { key: filterKey, label: `${city.name}, USA`, type: 'city' })
          } else {
            locationsMap.set(filterKey, { key: filterKey, label: city.country, type: 'country' })
          }
        }
      }

      result[product.id] = {
        locations: Array.from(locationsMap.values()).sort((a, b) => a.label.localeCompare(b.label))
      }
    }
    return result
  }, [comparisons, latitudeProducts])

  // Get unique competitors for each product
  const competitorsByProduct = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const product of latitudeProducts) {
      const productComparisons = comparisons.filter(c => c.latitudeProduct.id === product.id)
      const competitors = new Set(productComparisons.map(c => c.competitorProduct.competitor))
      result[product.id] = Array.from(competitors).sort()
    }
    return result
  }, [comparisons, latitudeProducts])

  // Get unique locations and SKUs for each competitor (for "By Competitor" view)
  // US: city-level, Others: country-level
  const locationsByCompetitor = useMemo(() => {
    const result: Record<string, {
      locations: Array<{ key: string; label: string; type: 'city' | 'country' }>
      skus: string[]
    }> = {}

    for (const competitor of allCompetitors) {
      const competitorComparisons = comparisons.filter(c => c.competitorProduct.competitor === competitor)
      const locationsMap = new Map<string, { key: string; label: string; type: 'city' | 'country' }>()
      const skuSet = new Set<string>()

      for (const comp of competitorComparisons) {
        const city = comp.competitorProduct.city
        const filterKey = getLocationFilterKey(city)
        skuSet.add(comp.latitudeProduct.id)

        if (!locationsMap.has(filterKey)) {
          if (isUSCountry(city.country)) {
            locationsMap.set(filterKey, { key: filterKey, label: `${city.name}, USA`, type: 'city' })
          } else {
            locationsMap.set(filterKey, { key: filterKey, label: city.country, type: 'country' })
          }
        }
      }

      result[competitor] = {
        locations: Array.from(locationsMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
        skus: Array.from(skuSet)
      }
    }
    return result
  }, [comparisons, allCompetitors])

  // Helper to check if a comparison matches a location filter
  const matchesLocationFilter = (city: City, locationKey: string) => {
    if (locationKey === 'all') return true
    const comparisonKey = getLocationFilterKey(city)
    return comparisonKey === locationKey
  }

  // Group and filter comparisons by product
  const getFilteredComparisons = (productId: string) => {
    const productComparisons = comparisons.filter(c => c.latitudeProduct.id === productId)
    const selectedLocation = selectedLocations[productId]
    const selectedCompetitor = selectedCompetitors[productId]

    let filtered = productComparisons

    if (selectedCompetitor && selectedCompetitor !== 'all') {
      filtered = filtered.filter(c => c.competitorProduct.competitor === selectedCompetitor)
    }

    if (selectedLocation && selectedLocation !== 'all') {
      filtered = filtered.filter(c => matchesLocationFilter(c.competitorProduct.city, selectedLocation))
    }

    return sortComparisons(filtered, productId)
  }

  // Filter comparisons by competitor (for "By Competitor" view)
  const getFilteredComparisonsByCompetitor = (competitor: string) => {
    const competitorComparisons = comparisons.filter(c => c.competitorProduct.competitor === competitor)
    const selectedLocation = selectedLocations[competitor]
    const selectedSku = selectedSkus[competitor]

    let filtered = competitorComparisons

    if (selectedSku && selectedSku !== 'all') {
      filtered = filtered.filter(c => c.latitudeProduct.id === selectedSku)
    }

    if (selectedLocation && selectedLocation !== 'all') {
      filtered = filtered.filter(c => matchesLocationFilter(c.competitorProduct.city, selectedLocation))
    }

    return sortComparisons(filtered, competitor)
  }

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">View by:</span>
        <div className="flex rounded-lg border p-1">
          <Button
            variant={viewMode === 'by-sku' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setViewMode('by-sku')}
          >
            <Server className="h-3 w-3 mr-1" />
            By Latitude SKU
          </Button>
          <Button
            variant={viewMode === 'by-competitor' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setViewMode('by-competitor')}
          >
            <Building2 className="h-3 w-3 mr-1" />
            By Competitor
          </Button>
        </div>
      </div>

      {viewMode === 'by-sku' ? (
        <Tabs defaultValue={latitudeProducts[0]?.id} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            {latitudeProducts.map((product) => {
              const productComparisons = comparisons.filter(c => c.latitudeProduct.id === product.id)
              return (
                <TabsTrigger
                  key={product.id}
                  value={product.id}
                  className="text-xs px-3 py-1.5"
                >
                  {product.name}
                  {productComparisons.length > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      ({productComparisons.length})
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

      {latitudeProducts.map((product) => {
        const filteredComparisons = getFilteredComparisons(product.id)
        const productLocations = locationsByProduct[product.id] || { locations: [] }
        const competitors = competitorsByProduct[product.id] || []
        const selectedLocation = selectedLocations[product.id]
        const selectedCompetitor = selectedCompetitors[product.id]

        const wins = filteredComparisons.filter(c => c.priceDifferencePercent > 10).length
        const ties = filteredComparisons.filter(c => c.priceDifferencePercent >= -10 && c.priceDifferencePercent <= 10).length
        const losses = filteredComparisons.filter(c => c.priceDifferencePercent < -10).length

        return (
          <TabsContent key={product.id} value={product.id}>
            {/* Product Info Card */}
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">{product.cpu}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.cpuCores} cores • {product.ram} GB RAM • {product.storageDescription} • {product.networkGbps} Gbps
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatPrice(product.priceUsd)}/mo</p>
                  <div className="flex gap-2 mt-1 text-sm">
                    <span className="text-emerald-400">{wins} wins</span>
                    <span className="text-amber-400">{ties} ties</span>
                    <span className="text-red-400">{losses} losses</span>
                  </div>
                </div>
              </div>
            </div>

            {filteredComparisons.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No comparisons for {product.name} {selectedLocation && selectedLocation !== 'all' ? 'in this location' : 'yet'}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Select
                        value={selectedCompetitor || 'all'}
                        onValueChange={(value) => setSelectedCompetitors(prev => ({ ...prev, [product.id]: value }))}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs border-0 bg-transparent hover:bg-muted -ml-2">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <SelectValue placeholder="All competitors" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All competitors</SelectItem>
                          {competitors.map((comp) => (
                            <SelectItem key={comp} value={comp}>
                              {comp}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>
                      <Select
                        value={selectedLocation || 'all'}
                        onValueChange={(value) => setSelectedLocations(prev => ({ ...prev, [product.id]: value }))}
                      >
                        <SelectTrigger className="h-7 w-[160px] text-xs border-0 bg-transparent hover:bg-muted -ml-2">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <SelectValue placeholder="All locations" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All locations</SelectItem>
                          {productLocations.locations.map((loc) => (
                            <SelectItem key={loc.key} value={loc.key}>
                              {loc.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => toggleSort(product.id)}
                      >
                        Difference
                        {sortDirection[product.id] === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : sortDirection[product.id] === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComparisons.map((comparison) => (
                    <TableRow
                      key={comparison.id}
                      className={!comparison.competitorProduct.inStock ? 'opacity-60' : ''}
                    >
                      <TableCell>
                        <Badge className={competitorColors[comparison.competitorProduct.competitor]}>
                          {comparison.competitorProduct.competitor}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ProductTooltip
                          name={comparison.competitorProduct.name}
                          cpu={comparison.competitorProduct.cpu}
                          cpuCores={comparison.competitorProduct.cpuCores}
                          ram={comparison.competitorProduct.ram}
                          storageDescription={comparison.competitorProduct.storageDescription}
                          networkGbps={comparison.competitorProduct.networkGbps}
                          sourceUrl={comparison.competitorProduct.sourceUrl}
                        />
                      </TableCell>
                      <TableCell>{formatPrice(comparison.competitorProduct.priceUsd)}/mo</TableCell>
                      <TableCell>
                        {(() => {
                          const loc = getLocationDisplay(comparison.competitorProduct.city)
                          return (
                            <span className="text-sm">
                              {loc.primary}
                              {loc.secondary && (
                                <span className="text-muted-foreground ml-1">{loc.secondary}</span>
                              )}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {comparison.competitorProduct.quantity !== null ? (
                          <span className={comparison.competitorProduct.quantity > 0 ? 'text-emerald-400 font-medium' : 'text-red-400'}>
                            {comparison.competitorProduct.quantity}
                          </span>
                        ) : comparison.competitorProduct.inStock ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            comparison.priceDifferencePercent > 0
                              ? 'text-emerald-400 font-medium'
                              : comparison.priceDifferencePercent < 0
                              ? 'text-red-400 font-medium'
                              : ''
                          }
                        >
                          {formatPercentage(comparison.priceDifferencePercent)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        )
      })}
        </Tabs>
      ) : (
        /* By Competitor View */
        <Tabs defaultValue={allCompetitors[0]} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            {allCompetitors.map((competitor) => {
              const competitorComparisons = comparisons.filter(c => c.competitorProduct.competitor === competitor)
              return (
                <TabsTrigger
                  key={competitor}
                  value={competitor}
                  className="text-xs px-3 py-1.5"
                >
                  <Badge className={`${competitorColors[competitor]} mr-1`}>{competitor}</Badge>
                  <span className="text-muted-foreground">
                    ({competitorComparisons.length})
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {allCompetitors.map((competitor) => {
            const allCompetitorComparisons = comparisons.filter(c => c.competitorProduct.competitor === competitor)
            const filteredComparisons = getFilteredComparisonsByCompetitor(competitor)
            const competitorLocations = locationsByCompetitor[competitor] || { locations: [], skus: [] }
            const selectedLocation = selectedLocations[competitor]
            const selectedSku = selectedSkus[competitor]

            const wins = filteredComparisons.filter(c => c.priceDifferencePercent > 10).length
            const ties = filteredComparisons.filter(c => c.priceDifferencePercent >= -10 && c.priceDifferencePercent <= 10).length
            const losses = filteredComparisons.filter(c => c.priceDifferencePercent < -10).length

            return (
              <TabsContent key={competitor} value={competitor}>
                {/* Competitor Info Card */}
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Badge className={competitorColors[competitor]}>{competitor}</Badge>
                        Comparisons
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {allCompetitorComparisons.length} products compared against Latitude.sh Gen4
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex gap-2 mt-1 text-sm">
                        <span className="text-emerald-400">{wins} wins</span>
                        <span className="text-amber-400">{ties} ties</span>
                        <span className="text-red-400">{losses} losses</span>
                      </div>
                    </div>
                  </div>
                </div>

                {filteredComparisons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No comparisons for {competitor} {selectedLocation && selectedLocation !== 'all' ? 'in this location' : 'yet'}.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Select
                            value={selectedSku || 'all'}
                            onValueChange={(value) => setSelectedSkus(prev => ({ ...prev, [competitor]: value }))}
                          >
                            <SelectTrigger className="h-7 w-[150px] text-xs border-0 bg-transparent hover:bg-muted -ml-2">
                              <div className="flex items-center gap-1">
                                <Server className="h-3 w-3" />
                                <SelectValue placeholder="All SKUs" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Latitude SKUs</SelectItem>
                              {competitorLocations.skus.map((skuId) => {
                                const product = latitudeProducts.find(p => p.id === skuId)
                                if (!product) return null
                                return (
                                  <SelectItem key={skuId} value={skuId}>
                                    {product.name}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </TableHead>
                        <TableHead>Competitor Product</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>
                          <Select
                            value={selectedLocation || 'all'}
                            onValueChange={(value) => setSelectedLocations(prev => ({ ...prev, [competitor]: value }))}
                          >
                            <SelectTrigger className="h-7 w-[160px] text-xs border-0 bg-transparent hover:bg-muted -ml-2">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <SelectValue placeholder="All locations" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All locations</SelectItem>
                              {competitorLocations.locations.map((loc) => (
                                <SelectItem key={loc.key} value={loc.key}>
                                  {loc.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>
                          <button
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                            onClick={() => toggleSort(competitor)}
                          >
                            Difference
                            {sortDirection[competitor] === 'desc' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : sortDirection[competitor] === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-50" />
                            )}
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComparisons.map((comparison) => (
                        <TableRow
                          key={comparison.id}
                          className={!comparison.competitorProduct.inStock ? 'opacity-60' : ''}
                        >
                          <TableCell>
                            <ProductTooltip
                              name={comparison.latitudeProduct.name}
                              cpu={comparison.latitudeProduct.cpu}
                              cpuCores={comparison.latitudeProduct.cpuCores}
                              ram={comparison.latitudeProduct.ram}
                              storageDescription={comparison.latitudeProduct.storageDescription}
                              networkGbps={comparison.latitudeProduct.networkGbps}
                            />
                            <span className="text-xs text-muted-foreground ml-1">
                              ({formatPrice(comparison.latitudeProduct.priceUsd)}/mo)
                            </span>
                          </TableCell>
                          <TableCell>
                            <ProductTooltip
                              name={comparison.competitorProduct.name}
                              cpu={comparison.competitorProduct.cpu}
                              cpuCores={comparison.competitorProduct.cpuCores}
                              ram={comparison.competitorProduct.ram}
                              storageDescription={comparison.competitorProduct.storageDescription}
                              networkGbps={comparison.competitorProduct.networkGbps}
                              sourceUrl={comparison.competitorProduct.sourceUrl}
                            />
                          </TableCell>
                          <TableCell>{formatPrice(comparison.competitorProduct.priceUsd)}/mo</TableCell>
                          <TableCell>
                            {(() => {
                              const loc = getLocationDisplay(comparison.competitorProduct.city)
                              return (
                                <span className="text-sm">
                                  {loc.primary}
                                  {loc.secondary && (
                                    <span className="text-muted-foreground ml-1">{loc.secondary}</span>
                                  )}
                                </span>
                              )
                            })()}
                          </TableCell>
                          <TableCell>
                            {comparison.competitorProduct.quantity !== null ? (
                              <span className={comparison.competitorProduct.quantity > 0 ? 'text-emerald-400 font-medium' : 'text-red-400'}>
                                {comparison.competitorProduct.quantity}
                              </span>
                            ) : comparison.competitorProduct.inStock ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                comparison.priceDifferencePercent > 0
                                  ? 'text-emerald-400 font-medium'
                                  : comparison.priceDifferencePercent < 0
                                  ? 'text-red-400 font-medium'
                                  : ''
                              }
                            >
                              {formatPercentage(comparison.priceDifferencePercent)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
