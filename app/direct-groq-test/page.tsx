"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"

export default function DirectGroqTest() {
  const [apiKey, setApiKey] = useState("")
  const [message, setMessage] = useState("Hello, this is a test message. Please respond.")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const testDirectGroq = async () => {
    if (!apiKey) {
      setError("Please enter your Groq API key")
      return
    }

    setLoading(true)
    setError("")
    setResponse("")

    try {
      console.log("[v0] Testing direct Groq API with key:", apiKey.substring(0, 10) + "...")

      const res = await fetch("/api/direct-groq-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, message }),
      })

      const data = await res.json()

      if (data.success) {
        setResponse(data.response)
        console.log("[v0] Direct Groq test successful!")
      } else {
        setError(data.error)
        console.log("[v0] Direct Groq test failed:", data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setError(errorMsg)
      console.log("[v0] Direct Groq test error:", errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Direct Groq API Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Groq API Key</label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="gsk_..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Test Message</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>

          <Button onClick={testDirectGroq} disabled={loading} className="w-full">
            {loading ? "Testing..." : "Test Direct Groq API"}
          </Button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {response && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <strong>AI Response:</strong>
              <p className="mt-2 whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  )
}
