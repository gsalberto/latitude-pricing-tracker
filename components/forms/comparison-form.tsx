'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { calculateSpecSimilarity } from '@/lib/calculations'
import { LatitudeProduct, CompetitorProduct, City, Comparison } from '@prisma/client'

type CompetitorProductWithCity = CompetitorProduct & { city: City }
type ComparisonWithProducts = Comparison & {
  latitudeProduct: LatitudeProduct
  competitorProduct: CompetitorProductWithCity
}

interface ComparisonFormProps {
  comparison?: ComparisonWithProducts
  trigger?: React.ReactNode
}

export function ComparisonForm({ comparison, trigger }: ComparisonFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [latitudeProducts, setLatitudeProducts] = useState<LatitudeProduct[]>([])
  const [competitorProducts, setCompetitorProducts] = useState<CompetitorProductWithCity[]>([])
  const [selectedLatitude, setSelectedLatitude] = useState<LatitudeProduct | null>(null)
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorProductWithCity | null>(null)
  const [formData, setFormData] = useState({
    latitudeProductId: comparison?.latitudeProductId ?? '',
    competitorProductId: comparison?.competitorProductId ?? '',
    notes: comparison?.notes ?? '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/latitude').then((res) => res.json()),
      fetch('/api/competitors').then((res) => res.json()),
    ])
      .then(([latitude, competitors]) => {
        // Ensure we have arrays, not error objects
        const latitudeArray = Array.isArray(latitude) ? latitude : []
        const competitorsArray = Array.isArray(competitors) ? competitors : []

        setLatitudeProducts(latitudeArray)
        setCompetitorProducts(competitorsArray)

        if (comparison) {
          setSelectedLatitude(latitudeArray.find((p: LatitudeProduct) => p.id === comparison.latitudeProductId) || null)
          setSelectedCompetitor(competitorsArray.find((p: CompetitorProductWithCity) => p.id === comparison.competitorProductId) || null)
        }
      })
      .catch(console.error)
  }, [comparison])

  const handleLatitudeChange = (id: string) => {
    const product = latitudeProducts.find((p) => p.id === id)
    setSelectedLatitude(product || null)
    setFormData({ ...formData, latitudeProductId: id })
  }

  const handleCompetitorChange = (id: string) => {
    const product = competitorProducts.find((p) => p.id === id)
    setSelectedCompetitor(product || null)
    setFormData({ ...formData, competitorProductId: id })
  }

  const similarity = selectedLatitude && selectedCompetitor
    ? calculateSpecSimilarity(selectedLatitude, selectedCompetitor)
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = comparison ? `/api/comparisons/${comparison.id}` : '/api/comparisons'
      const method = comparison ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setOpen(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to save comparison:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>{comparison ? 'Edit' : 'Create Comparison'}</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{comparison ? 'Edit Comparison' : 'Create Comparison'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Latitude Product</Label>
              <Select
                value={formData.latitudeProductId}
                onValueChange={handleLatitudeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Latitude product" />
                </SelectTrigger>
                <SelectContent>
                  {latitudeProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ${product.priceUsd}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Competitor Product</Label>
              <Select
                value={formData.competitorProductId}
                onValueChange={handleCompetitorChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select competitor product" />
                </SelectTrigger>
                <SelectContent>
                  {competitorProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.competitor} - {product.name} - ${product.priceUsd}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Spec Comparison */}
          {selectedLatitude && selectedCompetitor && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium">Spec Similarity</span>
                  <Badge
                    className={
                      similarity! >= 80
                        ? 'bg-green-100 text-green-800'
                        : similarity! >= 50
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }
                  >
                    {similarity}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground mb-2">{selectedLatitude.name}</p>
                    <ul className="space-y-1">
                      <li>Cores: {selectedLatitude.cpuCores}</li>
                      <li>RAM: {selectedLatitude.ram} GB</li>
                      <li>Storage: {selectedLatitude.storageTotalTB} TB</li>
                      <li>Network: {selectedLatitude.networkGbps} Gbps</li>
                      <li className="font-medium">Price: ${selectedLatitude.priceUsd}/mo</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground mb-2">
                      {selectedCompetitor.competitor} - {selectedCompetitor.name}
                    </p>
                    <ul className="space-y-1">
                      <li className={selectedCompetitor.cpuCores !== selectedLatitude.cpuCores ? 'text-orange-600' : ''}>
                        Cores: {selectedCompetitor.cpuCores}
                        {selectedCompetitor.cpuCores !== selectedLatitude.cpuCores && (
                          <span className="text-xs ml-1">
                            ({selectedCompetitor.cpuCores > selectedLatitude.cpuCores ? '+' : ''}
                            {selectedCompetitor.cpuCores - selectedLatitude.cpuCores})
                          </span>
                        )}
                      </li>
                      <li className={selectedCompetitor.ram !== selectedLatitude.ram ? 'text-orange-600' : ''}>
                        RAM: {selectedCompetitor.ram} GB
                        {selectedCompetitor.ram !== selectedLatitude.ram && (
                          <span className="text-xs ml-1">
                            ({selectedCompetitor.ram > selectedLatitude.ram ? '+' : ''}
                            {selectedCompetitor.ram - selectedLatitude.ram})
                          </span>
                        )}
                      </li>
                      <li className={selectedCompetitor.storageTotalTB !== selectedLatitude.storageTotalTB ? 'text-orange-600' : ''}>
                        Storage: {selectedCompetitor.storageTotalTB} TB
                      </li>
                      <li className={selectedCompetitor.networkGbps !== selectedLatitude.networkGbps ? 'text-orange-600' : ''}>
                        Network: {selectedCompetitor.networkGbps} Gbps
                      </li>
                      <li className="font-medium">Price: ${selectedCompetitor.priceUsd}/mo</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Why are these products comparable? Any caveats?"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.latitudeProductId || !formData.competitorProductId}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
