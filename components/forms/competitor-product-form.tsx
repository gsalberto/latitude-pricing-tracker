'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CompetitorProduct, City, Competitor } from '@prisma/client'

interface CompetitorProductFormProps {
  product?: CompetitorProduct & { city: City }
  trigger?: React.ReactNode
}

export function CompetitorProductForm({ product, trigger }: CompetitorProductFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cities, setCities] = useState<City[]>([])
  const [formData, setFormData] = useState({
    competitor: product?.competitor ?? 'VULTR' as Competitor,
    name: product?.name ?? '',
    cpu: product?.cpu ?? '',
    cpuCores: product?.cpuCores ?? 0,
    ram: product?.ram ?? 0,
    storageDescription: product?.storageDescription ?? '',
    storageTotalTB: product?.storageTotalTB ?? 0,
    networkGbps: product?.networkGbps ?? 0,
    cityId: product?.cityId ?? '',
    priceUsd: product?.priceUsd ?? 0,
    sourceUrl: product?.sourceUrl ?? '',
    inventoryUrl: product?.inventoryUrl ?? '',
    inStock: product?.inStock ?? true,
  })

  useEffect(() => {
    fetch('/api/cities')
      .then((res) => res.json())
      .then(setCities)
      .catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = product ? `/api/competitors/${product.id}` : '/api/competitors'
      const method = product ? 'PUT' : 'POST'

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
      console.error('Failed to save product:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>{product ? 'Edit' : 'Add Competitor Product'}</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Competitor Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="competitor">Competitor</Label>
              <Select
                value={formData.competitor}
                onValueChange={(value) => setFormData({ ...formData, competitor: value as Competitor })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VULTR">Vultr</SelectItem>
                  <SelectItem value="OVHCLOUD">OVHcloud</SelectItem>
                  <SelectItem value="HETZNER">Hetzner</SelectItem>
                  <SelectItem value="TERASWITCH">Teraswitch</SelectItem>
                  <SelectItem value="CHERRYSERVERS">Cherry Servers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Select
                value={formData.cityId}
                onValueChange={(value) => setFormData({ ...formData, cityId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}, {city.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., AX101"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU</Label>
            <Input
              id="cpu"
              value={formData.cpu}
              onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
              placeholder="e.g., AMD EPYC 7443P, 24 Cores @ 2.85 GHz"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpuCores">CPU Cores</Label>
              <Input
                id="cpuCores"
                type="number"
                value={formData.cpuCores}
                onChange={(e) => setFormData({ ...formData, cpuCores: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ram">RAM (GB)</Label>
              <Input
                id="ram"
                type="number"
                value={formData.ram}
                onChange={(e) => setFormData({ ...formData, ram: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="storageDescription">Storage Description</Label>
            <Input
              id="storageDescription"
              value={formData.storageDescription}
              onChange={(e) => setFormData({ ...formData, storageDescription: e.target.value })}
              placeholder="e.g., 2x 1.92TB NVMe"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storageTotalTB">Total Storage (TB)</Label>
              <Input
                id="storageTotalTB"
                type="number"
                step="0.01"
                value={formData.storageTotalTB}
                onChange={(e) => setFormData({ ...formData, storageTotalTB: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="networkGbps">Network (Gbps)</Label>
              <Input
                id="networkGbps"
                type="number"
                value={formData.networkGbps}
                onChange={(e) => setFormData({ ...formData, networkGbps: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceUsd">Price (USD/mo)</Label>
            <Input
              id="priceUsd"
              type="number"
              step="0.01"
              value={formData.priceUsd}
              onChange={(e) => setFormData({ ...formData, priceUsd: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourceUrl">Pricing Page URL</Label>
            <Input
              id="sourceUrl"
              type="url"
              value={formData.sourceUrl}
              onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
              placeholder="https://..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventoryUrl">Inventory/Availability URL (optional)</Label>
            <Input
              id="inventoryUrl"
              type="url"
              value={formData.inventoryUrl}
              onChange={(e) => setFormData({ ...formData, inventoryUrl: e.target.value })}
              placeholder="https://... (page to check stock)"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="inStock"
              checked={formData.inStock}
              onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="inStock">Currently in stock</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
