import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ChangelogEntry {
  version: string
  date: string
  changes: {
    type: 'feature' | 'fix' | 'improvement' | 'breaking'
    description: string
  }[]
}

const changelog: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2026-01-21',
    changes: [
      { type: 'feature', description: 'Add regional pricing support for Latitude (AU, APAC, LATAM regions)' },
      { type: 'feature', description: 'Add Latitude API integration for fetching regional prices' },
      { type: 'feature', description: 'Add Vultr API integration script' },
      { type: 'feature', description: 'Add version display and changelog page' },
      { type: 'improvement', description: 'Fix OVH regional pricing for Singapore, Sydney, Mumbai' },
      { type: 'improvement', description: 'Add CPU clock speeds to OVH product tooltips' },
      { type: 'improvement', description: 'Move Last Updated to sidebar navigation' },
      { type: 'improvement', description: 'Show flat list view when filtering by price position' },
      { type: 'fix', description: 'Fix OVH ADVANCE products linking to wrong page' },
      { type: 'fix', description: 'Correct CAD to USD conversion rate for OVH' },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-01-20',
    changes: [
      { type: 'feature', description: 'Add OVH API integration for live catalog and availability' },
      { type: 'feature', description: 'Add full Hetzner product line (AX42, AX52, AX102, AX162)' },
      { type: 'feature', description: 'Add Google authentication' },
      { type: 'improvement', description: 'Add Latitude logo and favicon' },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-01-19',
    changes: [
      { type: 'feature', description: 'Initial release with competitor tracking' },
      { type: 'feature', description: 'Dashboard with price position summary' },
      { type: 'feature', description: 'Comparisons view by SKU and by competitor' },
      { type: 'feature', description: 'Price history tracking for changes >10%' },
      { type: 'feature', description: 'Spec matching for automatic product pairing' },
    ],
  },
]

const badgeColors = {
  feature: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  fix: 'bg-red-500/20 text-red-400 border-red-500/30',
  improvement: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  breaking: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const badgeLabels = {
  feature: 'Feature',
  fix: 'Fix',
  improvement: 'Improvement',
  breaking: 'Breaking',
}

export default function ChangelogPage() {
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
  const gitCommit = process.env.NEXT_PUBLIC_GIT_COMMIT || 'unknown'
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Changelog</h1>
        <p className="text-muted-foreground">Version history and release notes</p>
      </div>

      {/* Current Build Info */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Current Build</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Version:</span>{' '}
              <span className="font-semibold">v{currentVersion}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Commit:</span>{' '}
              <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{gitCommit}</code>
            </div>
            {buildTime && (
              <div>
                <span className="text-muted-foreground">Built:</span>{' '}
                <span>{new Date(buildTime).toLocaleString()}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Environment:</span>{' '}
              <Badge variant="outline" className={process.env.NODE_ENV === 'development' ? 'border-amber-500 text-amber-400' : 'border-emerald-500 text-emerald-400'}>
                {process.env.NODE_ENV === 'development' ? 'Development' : 'Production'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      <div className="space-y-6">
        {changelog.map((entry) => (
          <Card key={entry.version} className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <span>v{entry.version}</span>
                  {entry.version === currentVersion && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Current
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{entry.date}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {entry.changes.map((change, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Badge className={`${badgeColors[change.type]} border text-[10px] px-1.5 py-0 mt-0.5`}>
                      {badgeLabels[change.type]}
                    </Badge>
                    <span className="text-sm">{change.description}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
