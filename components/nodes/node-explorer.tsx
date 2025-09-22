'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Play, CheckCircle, XCircle, Search, Filter } from 'lucide-react';

interface NodeInput {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: any;
}

interface NodeOutput {
  name: string;
  type: string;
  description: string;
}

interface NodeMetadata {
  author: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  complexity: 'simple' | 'medium' | 'complex';
  performance: {
    averageExecutionTime: number;
    memoryUsage: number;
    successRate: number;
    errorRate: number;
    lastExecuted: string;
    executionCount: number;
  };
  dependencies: string[];
  documentation: string;
  examples: Array<{
    name: string;
    description: string;
    input: Record<string, any>;
    expectedOutput: any;
  }>;
}

interface PrebuiltNode {
  id: string;
  name: string;
  category: string;
  version: string;
  description: string;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  metadata: NodeMetadata;
}

interface NodeExplorerProps {
  onNodeSelect?: (node: PrebuiltNode) => void;
  onNodeExecute?: (nodeId: string, params: Record<string, any>) => void;
}

export function NodeExplorer({ onNodeSelect, onNodeExecute }: NodeExplorerProps) {
  const [nodes, setNodes] = useState<PrebuiltNode[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<PrebuiltNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedComplexity, setSelectedComplexity] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<PrebuiltNode | null>(null);
  const [executionParams, setExecutionParams] = useState<Record<string, any>>({});
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchNodes();
  }, []);

  useEffect(() => {
    filterNodes();
  }, [nodes, searchTerm, selectedCategory, selectedComplexity]);

  const fetchNodes = async () => {
    try {
      const response = await fetch('/api/nodes');
      const data = await response.json();
      
      if (data.success) {
        setNodes(data.data);
      } else {
        console.error('Failed to fetch nodes:', data.error);
      }
    } catch (error) {
      console.error('Error fetching nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterNodes = () => {
    let filtered = nodes;

    if (searchTerm) {
      filtered = filtered.filter(node =>
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(node => node.category === selectedCategory);
    }

    if (selectedComplexity !== 'all') {
      filtered = filtered.filter(node => node.metadata.complexity === selectedComplexity);
    }

    setFilteredNodes(filtered);
  };

  const executeNode = async (node: PrebuiltNode) => {
    setExecuting(true);
    try {
      const response = await fetch(`/api/nodes/${node.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'execute',
          params: executionParams
        })
      });

      const data = await response.json();
      setExecutionResult(data);
      
      if (onNodeExecute) {
        onNodeExecute(node.id, executionParams);
      }
    } catch (error) {
      console.error('Error executing node:', error);
      setExecutionResult({ success: false, error: 'Execution failed' });
    } finally {
      setExecuting(false);
    }
  };

  const categories = Array.from(new Set(nodes.map(node => node.category)));
  const complexities = ['simple', 'medium', 'complex'];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading nodes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedComplexity} onValueChange={setSelectedComplexity}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Complexity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Complexities</SelectItem>
              {complexities.map(complexity => (
                <SelectItem key={complexity} value={complexity}>
                  {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNodes.map((node) => (
              <Card 
                key={node.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedNode(node);
                  if (onNodeSelect) onNodeSelect(node);
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{node.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {node.description}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{node.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {node.metadata.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {node.metadata.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{node.metadata.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Complexity: {node.metadata.complexity}</span>
                      <span>v{node.version}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Success Rate: {(node.metadata.performance.successRate * 100).toFixed(1)}%</span>
                      <span>{node.metadata.performance.averageExecutionTime}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="space-y-2">
            {filteredNodes.map((node) => (
              <Card 
                key={node.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedNode(node);
                  if (onNodeSelect) onNodeSelect(node);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{node.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{node.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary">{node.category}</Badge>
                        <Badge variant="outline">{node.metadata.complexity}</Badge>
                        <span className="text-xs text-gray-500">
                          {(node.metadata.performance.successRate * 100).toFixed(1)}% success
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div>v{node.version}</div>
                      <div>{node.metadata.performance.averageExecutionTime}ms</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Node Details and Execution */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedNode.name}</CardTitle>
            <CardDescription>{selectedNode.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="execute">Execute</TabsTrigger>
                <TabsTrigger value="documentation">Documentation</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Inputs</h4>
                    <div className="space-y-2">
                      {selectedNode.inputs.map((input) => (
                        <div key={input.name} className="text-sm">
                          <span className="font-medium">{input.name}</span>
                          <span className="text-gray-500 ml-2">({input.type})</span>
                          {input.required && <Badge variant="destructive" className="ml-2">Required</Badge>}
                          <p className="text-gray-600 text-xs mt-1">{input.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Outputs</h4>
                    <div className="space-y-2">
                      {selectedNode.outputs.map((output) => (
                        <div key={output.name} className="text-sm">
                          <span className="font-medium">{output.name}</span>
                          <span className="text-gray-500 ml-2">({output.type})</span>
                          <p className="text-gray-600 text-xs mt-1">{output.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Performance Metrics</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Execution Count: {selectedNode.metadata.performance.executionCount}</div>
                    <div>Average Time: {selectedNode.metadata.performance.averageExecutionTime}ms</div>
                    <div>Success Rate: {(selectedNode.metadata.performance.successRate * 100).toFixed(1)}%</div>
                    <div>Error Rate: {(selectedNode.metadata.performance.errorRate * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="execute" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Execution Parameters</h4>
                  <div className="space-y-3">
                    {selectedNode.inputs.map((input) => (
                      <div key={input.name}>
                        <label className="block text-sm font-medium mb-1">
                          {input.name} {input.required && <span className="text-red-500">*</span>}
                        </label>
                        {input.type === 'string' && (
                          <Input
                            placeholder={input.description}
                            value={executionParams[input.name] || ''}
                            onChange={(e) => setExecutionParams(prev => ({
                              ...prev,
                              [input.name]: e.target.value
                            }))}
                          />
                        )}
                        {input.type === 'number' && (
                          <Input
                            type="number"
                            placeholder={input.description}
                            value={executionParams[input.name] || ''}
                            onChange={(e) => setExecutionParams(prev => ({
                              ...prev,
                              [input.name]: parseFloat(e.target.value) || 0
                            }))}
                          />
                        )}
                        {input.type === 'boolean' && (
                          <Select
                            value={executionParams[input.name]?.toString() || ''}
                            onValueChange={(value) => setExecutionParams(prev => ({
                              ...prev,
                              [input.name]: value === 'true'
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select boolean value" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">True</SelectItem>
                              <SelectItem value="false">False</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {input.type === 'object' && (
                          <Textarea
                            placeholder={input.description}
                            value={JSON.stringify(executionParams[input.name] || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setExecutionParams(prev => ({
                                  ...prev,
                                  [input.name]: parsed
                                }));
                              } catch {
                                // Invalid JSON, keep as string for now
                              }
                            }}
                            rows={3}
                          />
                        )}
                        {input.type === 'array' && (
                          <Textarea
                            placeholder={input.description}
                            value={JSON.stringify(executionParams[input.name] || [], null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setExecutionParams(prev => ({
                                  ...prev,
                                  [input.name]: parsed
                                }));
                              } catch {
                                // Invalid JSON, keep as string for now
                              }
                            }}
                            rows={3}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={() => executeNode(selectedNode)}
                  disabled={executing}
                  className="w-full"
                >
                  {executing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute Node
                    </>
                  )}
                </Button>
                {executionResult && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Execution Result</h4>
                    <div className={`p-3 rounded-md ${executionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center mb-2">
                        {executionResult.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 mr-2" />
                        )}
                        <span className={`font-medium ${executionResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {executionResult.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      <pre className="text-sm overflow-auto max-h-64">
                        {JSON.stringify(executionResult.data || executionResult.error, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documentation" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Documentation</h4>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm">
                      {selectedNode.metadata.documentation}
                    </pre>
                  </div>
                </div>
                {selectedNode.metadata.examples.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Examples</h4>
                    <div className="space-y-4">
                      {selectedNode.metadata.examples.map((example, index) => (
                        <div key={index} className="border rounded-md p-3">
                          <h5 className="font-medium mb-2">{example.name}</h5>
                          <p className="text-sm text-gray-600 mb-2">{example.description}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h6 className="text-sm font-medium mb-1">Input:</h6>
                              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                                {JSON.stringify(example.input, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h6 className="text-sm font-medium mb-1">Expected Output:</h6>
                              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                                {JSON.stringify(example.expectedOutput, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {filteredNodes.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-500">No nodes found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
