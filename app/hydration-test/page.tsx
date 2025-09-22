"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NoSSR } from '@/components/no-ssr'
import { AdminLayout } from '@/components/admin-layout'
import { useIsMobile } from '@/hooks/use-mobile'

export default function HydrationTestPage() {
  const [mounted, setMounted] = useState(false)
  const [clientTime, setClientTime] = useState<string>('')
  const isMobile = useIsMobile()

  useEffect(() => {
    setMounted(true)
    setClientTime(new Date().toLocaleTimeString())
  }, [])

  const simulateExtensionAttributes = () => {
    // Simulate browser extension adding attributes
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('bbai-tooltip-injected', 'true')
      document.body.setAttribute('cz-shortcut-listen', 'true')
      alert('Extension attributes added! Check console for hydration warnings.')
    }
  }

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hydration Test Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Mount Status:</h3>
            <p>Component mounted: {mounted ? '✅ Yes' : '❌ No'}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Mobile Detection:</h3>
            <p>Is mobile: {isMobile ? '📱 Yes' : '🖥️ No'}</p>
          </div>

          <NoSSR fallback={<p>⏳ Loading client-only content...</p>}>
            <div>
              <h3 className="font-semibold mb-2">Client-Only Content:</h3>
              <p>Current time: {clientTime}</p>
              <p>User agent: {navigator.userAgent.substring(0, 50)}...</p>
            </div>
          </NoSSR>

          <div>
            <h3 className="font-semibold mb-2">Extension Simulation:</h3>
            <Button onClick={simulateExtensionAttributes}>
              Simulate Browser Extension
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              This will add extension attributes to test hydration handling
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Hydration Status:</h3>
            <p className="text-green-600">
              ✅ If you can see this page without hydration errors, the fix is working!
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  )
}
