"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"

export default function SimpleAITest() {
  const [apiKey, setApiKey] = useState("")
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)

  const testAI = async () => {
    if (!apiKey) {
      setResult("Please enter your Groq API key")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/simple-ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })

      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(`Error: ${error}`)
    }
    setLoading(false)
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Simple AI Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Enter your Groq API key (gsk_...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Button onClick={testAI} disabled={loading}>
            {loading ? "Testing..." : "Test AI Connection"}
          </Button>
          {result && <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">{result}</pre>}
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  )
}
