'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LatitudeProduct } from '@prisma/client'

interface LatitudeProductFormProps {
  product?: LatitudeProduct
  trigger?: React.ReactNode
}

export function LatitudeProductForm({ product, trigger }: LatitudeProductFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: product?.name ?? '',
    cpu: product?.cpu ?? '',
    cpuCores: product?.cpuCores ?? 0,
    ram: product?.ram ?? 0,
    storageDescription: product?.storageDescription ?? '',
    storageTotalTB: product?.storageTotalTB ?? 0,
    networkGbps: product?.networkGbps ?? 0,
    priceUsd: product?.priceUsd ?? 0,
    generation: product?.generation ?? 4,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = product ? `/api/latitude/${product.id}` : '/api/latitude'
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
        {trigger || <Button>{product ? 'Edit' : 'Add Product'}</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Latitude Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., c3.small.x86"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU</Label>
            <Input
              id="cpu"
              value={formData.cpu}
              onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
              placeholder="e.g., AMD EPYC 7232P, 8 Cores @ 3.1 GHz"
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
              placeholder="e.g., 2x 480GB SSD"
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
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="generation">Generation</Label>
              <Input
                id="generation"
                type="number"
                value={formData.generation}
                onChange={(e) => setFormData({ ...formData, generation: parseInt(e.target.value) || 4 })}
                required
              />
            </div>
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
