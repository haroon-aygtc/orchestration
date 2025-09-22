"use client"

import { useState, useEffect } from "react"
import { Globe, Webhook, Key, Plug, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToolsService, IntegrationMetrics } from "@/lib/api"

export function IntegrationLayerPanel() {
  const [metrics, setMetrics] = useState<IntegrationMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIntegrationMetrics()
  }, [])

  const loadIntegrationMetrics = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data = await ToolsService.getIntegrationMetrics()
      setMetrics(data)
    } catch (error) {
      console.error('Error loading integration metrics:', error)
      setError(error instanceof Error ? error.message : 'Failed to load integration metrics')
      // Set empty metrics on error
      setMetrics({
        apiEndpoints: [],
        connectors: [],
        authentication: {
          type: "Unknown",
          activeTokens: 0,
          expiredTokens: 0
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-card text-card-foreground">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Loading integration data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Integration Layer</CardTitle>
            <CardDescription>
              {error ? 'Real tools integration (with fallback)' : 'Real tools integration'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Plug className="mr-2 h-4 w-4" />
            Add Integration
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">API Error: {error}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null)
                  loadIntegrationMetrics()
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* API Gateway Status */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">API Gateway</h3>
            <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4">
              Online
            </Badge>
          </div>
          <div className="space-y-2">
            {metrics?.apiEndpoints.map((endpoint) => (
              <div key={endpoint.endpoint} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <Badge variant="secondary" className="text-xs font-mono">
                    GET
                  </Badge>
                  <span className="text-sm font-mono">{endpoint.endpoint}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{endpoint.calls.toLocaleString()} calls</p>
                  <p className="text-xs font-medium">{endpoint.latency}ms avg</p>
                </div>
              </div>
            )) || []}
          </div>
        </div>

        {/* Active Integrations */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Connectors</h3>
          </div>
          <div className="space-y-2">
            {metrics?.connectors.map((connector) => (
              <div key={connector.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${connector.status === "active" ? "bg-chart-4" : "bg-muted-foreground"}`}
                  ></div>
                  <div>
                    <p className="font-medium text-sm">{connector.name}</p>
                    <p className="text-xs text-muted-foreground">{connector.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={connector.status === "active" ? "default" : "secondary"}>
                    {connector.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{connector.requests.toLocaleString()} requests</p>
                </div>
              </div>
            )) || []}
          </div>
        </div>

        {/* Authentication Status */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Key className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Authentication</h3>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-chart-4 rounded-full"></div>
                <span className="text-sm font-medium">{metrics?.authentication.type || 'OAuth 2.0 + JWT'}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {metrics?.authentication.activeTokens.toLocaleString() || '847'} active tokens
                </p>
                <p className="text-xs font-medium">
                  {metrics?.authentication.expiredTokens || '23'} expired
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
