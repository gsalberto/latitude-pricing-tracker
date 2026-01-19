import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { LatitudeProductForm } from '@/components/forms/latitude-product-form'
import { DeleteButton } from '@/components/forms/delete-button'
import { formatPrice } from '@/lib/calculations'
import { Pencil } from 'lucide-react'

async function getLatitudeProducts() {
  return prisma.latitudeProduct.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { comparisons: true },
      },
    },
  })
}

export default async function LatitudeProductsPage() {
  const products = await getLatitudeProducts()

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Latitude Products</h1>
          <p className="text-muted-foreground">Manage Latitude.sh Gen4 bare metal server products</p>
        </div>
        <LatitudeProductForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>{products.length} products in database</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No products yet. Add your first Latitude product.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Cores</TableHead>
                  <TableHead>RAM</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Comparisons</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={product.cpu}>
                      {product.cpu}
                    </TableCell>
                    <TableCell>{product.cpuCores}</TableCell>
                    <TableCell>{product.ram} GB</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={product.storageDescription}>
                      {product.storageDescription}
                    </TableCell>
                    <TableCell>{product.networkGbps} Gbps</TableCell>
                    <TableCell>{formatPrice(product.priceUsd)}/mo</TableCell>
                    <TableCell>{product._count.comparisons}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <LatitudeProductForm
                          product={product}
                          trigger={
                            <Button variant="ghost" size="sm">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DeleteButton
                          endpoint={`/api/latitude/${product.id}`}
                          itemName={product.name}
                        />
                      </div>
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
