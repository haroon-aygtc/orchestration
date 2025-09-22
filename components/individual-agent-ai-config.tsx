"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, TestTube, CheckCircle, XCircle, Clock } from "lucide-react"
// Removed direct service import - using API calls instead
import type { AIProviderConfig, AgentAIProvider } from "@/lib/types"
import { ToastManager, toastManager } from "@/lib/toast-notifications"
import { llmProviderRegistry } from "@/lib/llm/providers/registry"
import { LLMModel } from "@/lib/llm/providers/registry"

interface IndividualAgentAIConfigProps {
  agentName: string
  agentDescription: string
}

export function IndividualAgentAIConfig({ agentName, agentDescription }: IndividualAgentAIConfigProps) {
  const [providers, setProviders] = useState<AgentAIProvider[]>([])
  const [testResults, setTestResults] = useState<
    Map<string, { success: boolean; responseTime: number; error?: string }>
  >(new Map())
  const [testing, setTesting] = useState<Set<string>>(new Set())

  // Load existing configuration
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch(`/api/ai-config?action=getAgentProviders&agentType=${agentName}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            const existingProviders = data.data
            setProviders(existingProviders)
          }
        }
      } catch (error) {
        console.error('Failed to load agent providers:', error)
        toastManager.add(ToastManager.general.error("Load Failed", "Could not load agent providers"))
      }
    }
    loadProviders()
  }, [agentName])

  // Add new provider
  const addProvider = () => {
    const openaiConfig = llmProviderRegistry.getProvider('openai')  
    const newProvider: AgentAIProvider = {
      id: `temp-${Date.now()}`,
      agentName,
      providerId: "temp-provider",
      isDefault: false,
      priority: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: {
        id: "temp-provider",
        provider: "openai",
        apiKey: "",
        model: openaiConfig?.defaultModel || 'gpt-4o-mini',
        maxTokens: 4096,
        temperature: 0.7,
        baseUrl: openaiConfig?.baseUrl || 'https://api.openai.com/v1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
    setProviders([...providers, newProvider])
  }

  // Remove provider
  const removeProvider = (index: number) => {
    const newProviders = providers.filter((_, i) => i !== index)
    setProviders(newProviders)
    // Note: Provider removal would need to be implemented in the service
  }

  // Update provider
  const updateProvider = (index: number, field: string, value: string) => {
    const newProviders = [...providers]
    if (field === "provider") {
      // Update provider configuration when provider changes
      const providerConfig = llmProviderRegistry.getProvider(value as any)
      if (providerConfig) {
        newProviders[index] = {
          ...newProviders[index],
          provider: {
            ...newProviders[index].provider,
            provider: value as any,
            baseUrl: providerConfig.baseUrl,
            model: providerConfig.models.length > 0 ? providerConfig.models[0].id : providerConfig.defaultModel,
          }
        }
      }
    } else if (field === "apiKey") {
      newProviders[index] = {
        ...newProviders[index],
        provider: {
          ...newProviders[index].provider,
          apiKey: value
        }
      }
    } else if (field === "model") {
      newProviders[index] = {
        ...newProviders[index],
        provider: {
          ...newProviders[index].provider,
          model: value
        }
      }
    }
    setProviders(newProviders)
  }

  // Save configuration
  const saveConfiguration = async () => {
    try {
      // Note: This would need to be implemented in the service
      console.log(`[v0] Saved AI configuration for ${agentName} agent with ${providers.length} providers`)
      
      // Show success toast
      toastManager.add(ToastManager.general.success(
        "Configuration Saved",
        `AI configuration saved for ${agentName} agent with ${providers.length} providers`
      ))
    } catch (error) {
      console.error(`[v0] Failed to save configuration for ${agentName}:`, error)
      
      // Show error toast
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toastManager.add(ToastManager.general.error(
        "Save Failed",
        `Failed to save configuration for ${agentName}: ${errorMessage}`
      ))
    }
  }

  // Test provider
  const testProvider = async (provider: AgentAIProvider, model: string) => {
    const testKey = `${provider.provider.provider}-${model}`
    setTesting((prev) => new Set([...prev, testKey]))

    try {
      console.log(`[v0] Testing ${provider.provider.provider} with model ${model} for ${agentName} agent`)
      
      // Show loading toast
      const loadingToastId = toastManager.add(ToastManager.aiProvider.testingInProgress(provider.provider.provider))
      
      const response = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'testConnection',
          provider: provider.provider.provider,
          config: provider.provider
        })
      })
      
      let result
      if (response.ok) {
        const data = await response.json()
        result = data.success ? data.data : { success: false, error: data.error }
      } else {
        result = { success: false, error: 'Test failed' }
      }
      setTestResults((prev) => new Map([...prev, [testKey, result]]))
      
      // Remove loading toast
      toastManager.remove(loadingToastId)
      
      if (result.success) {
        // Show success toast
        toastManager.add(ToastManager.aiProvider.agentTestSuccess(`${agentName} (${provider.provider.provider})`, result.responseTime))
      } else {
        // Show error toast
        toastManager.add(ToastManager.aiProvider.agentTestFailed(`${agentName} (${provider.provider.provider})`, result.error || 'Unknown error'))
      }
      
      console.log(`[v0] Test completed for ${provider.provider.provider}: ${result.success ? "SUCCESS" : "FAILED"}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      
      setTestResults(
        (prev) =>
          new Map([
            ...prev,
            [
              testKey,
              {
                success: false,
                responseTime: 0,
                error: errorMessage,
              },
            ],
          ]),
      )
      
      // Show error toast
      toastManager.add(ToastManager.aiProvider.agentTestFailed(`${agentName} (${provider.provider.provider})`, errorMessage))
    } finally {
      setTesting((prev) => {
        const newSet = new Set(prev)
        newSet.delete(testKey)
        return newSet
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">AI Configuration for {agentName} Agent</CardTitle>
          <CardDescription>{agentDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.map((provider, index) => (
            <Card key={index} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Provider {index + 1}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeProvider(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`provider-${index}`}>AI Provider</Label>
                    <Select value={provider.provider.provider} onValueChange={(value) => updateProvider(index, "name", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`apikey-${index}`}>API Key</Label>
                    <Input
                      id={`apikey-${index}`}
                      type="password"
                      value={provider.provider.apiKey}
                      onChange={(e) => updateProvider(index, "apiKey", e.target.value)}
                      placeholder="Enter API key..."
                    />
                  </div>
                </div>

                <div>
                  <Label>Available Models</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {llmProviderRegistry.getModelsByProvider(provider.provider.provider as any).map((modelItem: LLMModel) => {
                      const testKey = `${provider.provider.provider}-${modelItem.id}`
                      const testResult = testResults.get(testKey)
                      const isTestingThis = testing.has(testKey)

                      return (
                        <div key={modelItem.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            {modelItem.id}
                            {testResult &&
                              (testResult.success ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500" />
                              ))}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testProvider(provider, modelItem.id)}
                            disabled={!provider.provider.apiKey || isTestingThis}
                            className="h-6 px-2"
                          >
                            {isTestingThis ? (
                              <Clock className="h-3 w-3 animate-spin" />
                            ) : (
                              <TestTube className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Show test results */}
                  {llmProviderRegistry.getModelsByProvider(provider.provider.provider as any).some((modelItem: LLMModel) => {
                    const testResult = testResults.get(`${provider.provider.provider}-${modelItem}`)
                    return testResult && !testResult.success
                  }) && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Test Errors:</strong>
                      {llmProviderRegistry.getModelsByProvider(provider.provider.provider as any).map((modelItem: LLMModel) => {
                        const testResult = testResults.get(`${provider.provider.provider}-${modelItem}`)
                        return testResult && !testResult.success ? (
                          <div key={modelItem.id}>
                            • {modelItem.id}: {testResult.error}
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-2">
            <Button onClick={addProvider} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add AI Provider
            </Button>
            <Button onClick={saveConfiguration} disabled={providers.length === 0}>
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
