'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Alert, AlertDescription } from './alert';

interface ToolInfo {
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  enhanced: boolean;
  metrics: {
    executions: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

interface CustomToolManagerProps {
  className?: string;
}

export function CustomToolManager({ className }: CustomToolManagerProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newToolName, setNewToolName] = useState('');
  const [newToolCategory, setNewToolCategory] = useState('communication');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const categories = [
    'communication',
    'data-processing',
    'network',
    'validation',
    'utility'
  ];

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const response = await fetch('/api/tools');
      const data = await response.json();
      if (data.success) {
        setTools(data.data.tools);
      }
    } catch (error) {
      console.error('Failed to load tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCustomTool = async () => {
    if (!newToolName.trim()) return;

    setCreating(true);
    setMessage('');

    try {
      // This would call the tool creation script
      const response = await fetch('/api/tools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newToolName,
          category: newToolCategory
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Custom tool "${newToolName}" created successfully!`);
        setNewToolName('');
        await loadTools();
      } else {
        setMessage(`❌ Failed to create tool: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const executeTool = async (toolName: string, params: any = {}) => {
    try {
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          parameters: params
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Tool "${toolName}" executed successfully!`);
        return data.data;
      } else {
        setMessage(`❌ Tool execution failed: ${data.error}`);
        return null;
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
      return null;
    }
  };

  if (loading) {
    return <div className="p-6">Loading custom tools...</div>;
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom Tool Manager</h2>
          <p className="text-muted-foreground">
            Create and manage custom tools with advanced features
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          Enhanced Registry System
        </Badge>
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Available Tools</TabsTrigger>
          <TabsTrigger value="create">Create Tool</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="grid gap-4">
            {tools.map((tool) => (
              <Card key={tool.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                      <Badge variant="outline">{tool.category}</Badge>
                      {tool.enhanced && (
                        <Badge variant="secondary">Enhanced</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => executeTool(tool.name, { test: 'data' })}
                    >
                      Test
                    </Button>
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tool.capabilities.map((cap) => (
                      <Badge key={cap} variant="outline" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>Executions: {tool.metrics.executions}</div>
                    <div>Error Rate: {tool.metrics.errorRate.toFixed(2)}%</div>
                    <div>Cache Hit Rate: {tool.metrics.cacheHitRate.toFixed(2)}%</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Custom Tool</CardTitle>
              <CardDescription>
                Use the enhanced tool creation system with templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tool Name</label>
                  <Input
                    placeholder="my-custom-tool"
                    value={newToolName}
                    onChange={(e) => setNewToolName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newToolCategory}
                    onChange={(e) => setNewToolCategory(e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-mono">
                  Command: node scripts/create-tool.js {newToolName} {newToolCategory}
                </p>
              </div>

              <Button
                onClick={createCustomTool}
                disabled={creating || !newToolName.trim()}
                className="w-full"
              >
                {creating ? 'Creating...' : 'Create Custom Tool'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>🚀 Advanced Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Advanced caching with TTL and singleflight deduplication</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Schema validation with Zod for input/output</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Capability-based access control</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Built-in timeout management</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Production monitoring and metrics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Performance optimizations</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📚 Available Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((category) => (
                    <div key={category} className="p-3 border rounded-lg">
                      <h4 className="font-medium capitalize">{category}</h4>
                      <p className="text-sm text-muted-foreground">
                        Template for {category} tools
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
