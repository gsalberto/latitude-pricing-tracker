/**
 * Calculate price difference percentage
 * Positive = Latitude is cheaper
 * Negative = Latitude is more expensive
 */
export function calculatePriceDifference(latitudePrice: number, competitorPrice: number): number {
  if (latitudePrice === 0) return 0
  return ((competitorPrice - latitudePrice) / latitudePrice) * 100
}

/**
 * Calculate similarity score between two products (0-100)
 * Based on CPU cores, RAM, and storage
 */
export function calculateSpecSimilarity(
  product1: { cpuCores: number; ram: number; storageTotalTB: number },
  product2: { cpuCores: number; ram: number; storageTotalTB: number }
): number {
  const coresSimilarity = 100 - Math.abs(product1.cpuCores - product2.cpuCores) / Math.max(product1.cpuCores, product2.cpuCores) * 100
  const ramSimilarity = 100 - Math.abs(product1.ram - product2.ram) / Math.max(product1.ram, product2.ram) * 100
  const storageSimilarity = 100 - Math.abs(product1.storageTotalTB - product2.storageTotalTB) / Math.max(product1.storageTotalTB, product2.storageTotalTB) * 100

  // Weight: CPU cores 40%, RAM 35%, Storage 25%
  return Math.round(coresSimilarity * 0.4 + ramSimilarity * 0.35 + storageSimilarity * 0.25)
}

/**
 * Get price position color class (dark mode compatible)
 */
export function getPricePositionColor(priceDifferencePercent: number): string {
  if (priceDifferencePercent > 10) return 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/30'
  if (priceDifferencePercent < -10) return 'text-red-400 bg-red-500/20 border border-red-500/30'
  return 'text-amber-400 bg-amber-500/20 border border-amber-500/30'
}

/**
 * Get price position label
 */
export function getPricePositionLabel(priceDifferencePercent: number): string {
  if (priceDifferencePercent > 10) return 'Cheaper'
  if (priceDifferencePercent < -10) return 'More Expensive'
  return 'Competitive'
}

/**
 * Format price as USD
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(price)
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}
