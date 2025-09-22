"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { ToastManager, toastManager } from "@/lib/toast-notifications"
import { llmProviderRegistry } from "@/lib/llm/providers/registry"
import { maskKey } from "@/lib/ai-config-service"

interface AIProvider {
  id: string
  name: string
  status: "connected" | "disconnected" | "error"
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
}

export function AIConfigurationPanel() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [selectedProvider, setSelectedProvider] = useState("")
  const [testResults, setTestResults] = useState<Record<string, any>>({})
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // Load providers from API on component mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/ai-config/providers')
        const data = await response.json()
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load providers')
        }
        
        // Use centralized provider configuration
        const providerMap: Record<string, { name: string; models: string[] }> = Object.fromEntries(
          llmProviderRegistry.getAllProviders().map((provider) => [
            provider.id,
            { name: provider.displayName, models: provider.models.map(m => m.id) }
          ])
        )

        const loadedProviders: AIProvider[] = data.providers.map((config: any) => ({
          id: config.provider,
          name: providerMap[config.provider]?.name || config.provider,
          status: config.isActive ? "connected" : "disconnected",
          apiKey: config.apiKey,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
        }))

        setProviders(loadedProviders)
        if (loadedProviders.length > 0) {
          setSelectedProvider(loadedProviders[0].id)
        }
      } catch (error) {
        console.error('Failed to load providers:', error)
        toastManager.add(ToastManager.general.error("Failed to Load Providers", "Could not load AI provider configurations"))
      } finally {
        setIsLoading(false)
      }
    }

    loadProviders()
  }, [])

  const updateProvider = async (id: string, updates: Partial<AIProvider>) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))

    const updatedProvider = providers.find((p) => p.id === id)
    if (updatedProvider && updates.apiKey) {
      try {
        const response = await fetch('/api/ai-config/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: id,
            apiKey: updates.apiKey,
            model: updatedProvider.model,
            maxTokens: updatedProvider.maxTokens,
            temperature: updatedProvider.temperature,
            isActive: true
          })
        })
        
        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || 'Failed to save provider config')
        }
      } catch (error) {
        console.error('Failed to save provider config:', error)
        toastManager.add(ToastManager.general.error("Save Failed", "Could not save provider configuration"))
      }
    }
  }

  const testConnection = async (providerId: string) => {
    setIsTestingConnection(true)
    const provider = providers.find((p) => p.id === providerId)

    if (!provider?.apiKey) {
      toastManager.add(ToastManager.general.error("API Key Required", "Please enter an API key before testing"));
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { success: false, error: "API key required" },
      }))
      setIsTestingConnection(false)
      return
    }

    try {
      // Show loading toast
      const loadingToastId = toastManager.add(ToastManager.aiProvider.testingInProgress(provider.name))
      
      console.log(`[v0] Testing ${provider.name} connection with API key: ${maskKey(provider.apiKey)}`)

      // Use universal direct API test route for all providers
      const response = await fetch("/api/direct-groq-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          apiKey: provider.apiKey,
          model: provider.model,
          message: "Hello, this is a connection test. Please respond with a brief confirmation.",
        }),
      })

      // Remove loading toast
      toastManager.remove(loadingToastId)

      if (response.ok) {
        const result = await response.json()
        updateProvider(providerId, { status: "connected" })
        setTestResults((prev) => ({
          ...prev,
          [providerId]: {
            success: true,
            response: result.response || result.text,
            latency: result.latency || "N/A",
          },
        }))
        
        // Show success toast
        toastManager.add(ToastManager.aiProvider.connectionSuccess(provider.name, result.latency || 0))
        console.log(`[v0] ${provider.name} connection successful:`, result)
      } else {
        const errorData = await response.json()
        throw new Error(`HTTP ${response.status}: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.log(`[v0] ${provider.name} connection failed:`, error)
      updateProvider(providerId, { status: "error" })
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      }))
      
      // Show error toast
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toastManager.add(ToastManager.aiProvider.connectionFailed(provider.name, errorMessage))
    }

    setIsTestingConnection(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-500">
            Connected
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">Disconnected</Badge>
    }
  }

  const currentProvider = providers.find((p) => p.id === selectedProvider)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">AI Configuration</h2>
        </div>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading AI providers...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h2 className="text-2xl font-bold">AI Configuration</h2>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="providers">AI Providers</TabsTrigger>
          <TabsTrigger value="models">Model Settings</TabsTrigger>
          <TabsTrigger value="testing">Connection Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <Card
                key={provider.id}
                className={`cursor-pointer transition-colors ${
                  selectedProvider === provider.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    {getStatusIcon(provider.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <CardDescription>{provider.model}</CardDescription>
                    {getStatusBadge(provider.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">API Key: </span>
                      {provider.apiKey ? `••••••••••••••••` : "Not configured"}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Max Tokens: </span>
                      {provider.maxTokens}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {currentProvider && (
            <Card>
              <CardHeader>
                <CardTitle>Configure {currentProvider.name}</CardTitle>
                <CardDescription>Set up API credentials and connection settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your API key"
                    value={currentProvider.apiKey}
                    onChange={(e) => updateProvider(currentProvider.id, { apiKey: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select
                    value={currentProvider.model}
                    onValueChange={(value) => updateProvider(currentProvider.id, { model: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProvider && llmProviderRegistry.getModelsByProvider(currentProvider.id as any).map((model) => (
                        <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Max Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      value={currentProvider.maxTokens}
                      onChange={(e) =>
                        updateProvider(currentProvider.id, { maxTokens: Number.parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={currentProvider.temperature}
                      onChange={(e) =>
                        updateProvider(currentProvider.id, { temperature: Number.parseFloat(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={() => testConnection(currentProvider.id)}
                  disabled={isTestingConnection || !currentProvider.apiKey}
                  className="w-full"
                >
                  {isTestingConnection ? "Testing Connection..." : "Test Connection"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Model Assignment</CardTitle>
              <CardDescription>Configure which AI models each specialized agent uses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-muted-foreground">
                <p>Agent model assignments will be loaded from the database.</p>
                <p className="text-sm">This feature is coming soon!</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Testing</CardTitle>
              <CardDescription>Test AI provider connections and view real responses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {providers.map((provider) => (
                <div key={provider.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{provider.name}</h4>
                      {getStatusIcon(provider.status)}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => testConnection(provider.id)}
                      disabled={isTestingConnection || !provider.apiKey}
                    >
                      Test
                    </Button>
                  </div>

                  {testResults[provider.id] && (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      {testResults[provider.id].success ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="font-medium">Connection Successful</span>
                          </div>
                          <div className="text-sm">
                            <p>
                              <strong>Response:</strong> {testResults[provider.id].response}
                            </p>
                            <p>
                              <strong>Latency:</strong> {testResults[provider.id].latency}ms
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="font-medium">Error: {testResults[provider.id].error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
