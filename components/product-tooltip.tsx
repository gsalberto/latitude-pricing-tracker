'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Cpu, MemoryStick, HardDrive, Network, ExternalLink } from 'lucide-react'

interface ProductTooltipProps {
  name: string
  cpu: string
  cpuCores: number
  ram: number
  storageDescription: string
  networkGbps: number
  sourceUrl?: string
  children?: React.ReactNode
}

export function ProductTooltip({
  name,
  cpu,
  cpuCores,
  ram,
  storageDescription,
  networkGbps,
  sourceUrl,
  children,
}: ProductTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 hover:decoration-muted-foreground">
            {children || name}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="p-0 w-72 bg-popover text-popover-foreground">
          <div className="rounded-md border shadow-lg">
            <div className="px-3 py-2 border-b bg-muted/50">
              <p className="font-semibold text-sm text-foreground">{name}</p>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  View on website
                </a>
              )}
            </div>
            <div className="p-3 space-y-2 text-xs text-foreground">
              <div className="flex items-start gap-2">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground">CPU: </span>
                  <span className="font-medium">{cpu}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground shrink-0">
                    <span className="text-[10px] font-bold">#</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cores: </span>
                    <span className="font-medium">{cpuCores}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-muted-foreground">RAM: </span>
                    <span className="font-medium">{ram} GB</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground">Storage: </span>
                  <span className="font-medium">{storageDescription}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Network className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-muted-foreground">Network: </span>
                  <span className="font-medium">{networkGbps} Gbps</span>
                </div>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
