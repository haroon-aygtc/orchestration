'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { BusinessIntelligencePanel } from '@/components/business-intelligence-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Code,
  Folder,
  Calendar,
  Trash2,
  RefreshCw,
  Download,
  ExternalLink,
  Package,
  AlertCircle,
  Brain,
  Building2,
  Target,
  Zap,
  Settings,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

interface Solution {
  id: string;
  name: string;
  description: string;
  version: string;
  path: string;
  created: string | null;
  readme: string | null;
}

interface SolutionsListResponse {
  success: boolean;
  data?: {
    solutions: Solution[];
    path: string;
    count: number;
  };
  error?: string;
}

// Enhanced Solution Creator Component that uses ALL 9 agents
function EnhancedSolutionCreator({ onSolutionCreated }: { onSolutionCreated: () => void }) {
  const [step, setStep] = useState<'business' | 'problem' | 'options' | 'creating'>('business');
  const [businessContext, setBusinessContext] = useState({
    industry: '',
    companySize: '',
    revenue: '',
    goals: [] as string[],
    challenges: [] as string[],
    timeline: '',
    budget: ''
  });
  const [problem, setProblem] = useState('');
  const [useAllAgents, setUseAllAgents] = useState(true);
  const [includeMonitoring, setIncludeMonitoring] = useState(true);
  const [includeUI, setIncludeUI] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCreateSolution = async () => {
    setIsCreating(true);
    setStep('creating');

    try {
      const response = await fetch('/api/solutions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem,
          businessContext,
          useAllAgents: true, // Force using all 9 agents
          includeMonitoring,
          includeUI
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        onSolutionCreated();
      } else {
        throw new Error(data.error || 'Failed to create solution');
      }
    } catch (error) {
      console.error('Error creating solution:', error);
      alert('Failed to create solution: ' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  if (step === 'business') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Intelligence Analysis (Step 1/4)
          </CardTitle>
          <CardDescription>
            Complete business profiling to create a targeted multi-agent solution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessIntelligencePanel />

          <div className="flex justify-between mt-6 pt-6 border-t">
            <Button variant="outline" disabled>Previous</Button>
            <Button
              onClick={() => setStep('problem')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continue to Problem Description
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'problem') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Problem Description (Step 2/4)
          </CardTitle>
          <CardDescription>
            Describe the automation challenge you want to solve
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Problem Description</Label>
            <Textarea
              placeholder="Describe your automation needs in detail..."
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={6}
            />
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('business')}>Previous</Button>
            <Button
              onClick={() => setStep('options')}
              disabled={problem.length < 20}
            >
              Next: Solution Options
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'options') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Solution Options (Step 3/4)
          </CardTitle>
          <CardDescription>
            Configure your multi-agent automation system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useAllAgents"
                checked={useAllAgents}
                onCheckedChange={(checked) => setUseAllAgents(checked === true)}
              />
              <Label htmlFor="useAllAgents">
                Use All 9 Specialized Agents (Intent, Retriever, Tool, Workflow, Memory, Follow, Formatter, Guardrail, LLM)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeMonitoring"
                checked={includeMonitoring}
                onCheckedChange={(checked) => setIncludeMonitoring(checked === true)}
              />
              <Label htmlFor="includeMonitoring">
                Include monitoring and error handling
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeUI"
                checked={includeUI}
                onCheckedChange={(checked) => setIncludeUI(checked === true)}
              />
              <Label htmlFor="includeUI">
                Generate React UI Dashboard (NEW!)
              </Label>
            </div>
          </div>

          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription>
              This will create a comprehensive multi-agent system using all 9 specialized agents working together.
              {includeUI && " A React dashboard will be generated for monitoring and controlling your automation."}
            </AlertDescription>
          </Alert>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('problem')}>Previous</Button>
            <Button onClick={handleCreateSolution}>
              Create Multi-Agent Solution
              <Zap className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'creating') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Creating Your Solution...
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isCreating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Generating multi-agent automation system...</p>
              {includeUI && (
                <p className="text-sm text-blue-600 mt-2">Including React UI dashboard generation...</p>
              )}
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Solution Created Successfully!</span>
              </div>
              <div className="bg-gray-50 p-4 rounded space-y-2">
                <p><strong>Solution ID:</strong> {result.solutionId}</p>
                <p><strong>Agents:</strong> {result.agents?.join(', ')}</p>
                <p><strong>Workflows:</strong> {result.workflows?.join(', ')}</p>
                {includeUI && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Code className="h-4 w-4" />
                    <span><strong>UI Dashboard:</strong> React components generated in /ui directory</span>
                  </div>
                )}
              </div>
              {includeUI && (
                <Alert>
                  <Code className="h-4 w-4" />
                  <AlertDescription>
                    <strong>To run the UI:</strong> Navigate to the solution's /ui directory, run <code>npm install && npm run dev</code>
                  </AlertDescription>
                </Alert>
              )}
              <Button onClick={() => {
                setStep('business');
                setResult(null);
                setProblem('');
              }}>
                Create Another Solution
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return null;
}

export default function SolutionsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solutionsPath, setSolutionsPath] = useState<string>('');

  const fetchSolutions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/solutions/create');
      const data: SolutionsListResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch solutions');
      }

      if (data.success && data.data) {
        setSolutions(data.data.solutions);
        setSolutionsPath(data.data.path);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load solutions');
    } finally {
      setLoading(false);
    }
  };

  const deleteSolution = async (solutionId: string) => {
    if (!confirm(`Are you sure you want to delete solution "${solutionId}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/solutions/create?id=${solutionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete solution');
      }

      // Refresh the solutions list
      await fetchSolutions();
    } catch (err: any) {
      setError(err.message || 'Failed to delete solution');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    fetchSolutions();
  }, []);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Solution Creator</h1>
          <p className="text-muted-foreground">
            Create deployable automation solutions from problem descriptions
          </p>
        </div>
        <Button variant="outline" onClick={fetchSolutions} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList>
          <TabsTrigger value="create">Create Solution</TabsTrigger>
          <TabsTrigger value="manage">
            Manage Solutions ({solutions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <EnhancedSolutionCreator onSolutionCreated={fetchSolutions} />
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Generated Solutions
              </CardTitle>
              <CardDescription>
                Solutions directory: <code className="text-xs bg-gray-100 px-1 rounded">{solutionsPath}</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading solutions...
                </div>
              ) : solutions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No solutions created yet</p>
                  <p className="text-sm">Create your first solution using the "Create Solution" tab</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {solutions.map((solution) => (
                    <Card key={solution.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{solution.name}</CardTitle>
                            <CardDescription>{solution.description}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{solution.version}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteSolution(solution.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Code className="h-4 w-4" />
                              <span className="font-medium">Solution ID:</span>
                              <code className="text-xs bg-gray-100 px-1 rounded">{solution.id}</code>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span className="font-medium">Created:</span>
                              <span>{formatDate(solution.created)}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4" />
                              <span className="font-medium">Path:</span>
                              <code className="text-xs bg-gray-100 px-1 rounded truncate max-w-48">
                                {solution.path}
                              </code>
                            </div>
                          </div>
                        </div>

                        {solution.readme && (
                          <div className="bg-gray-50 p-3 rounded-md">
                            <h5 className="font-medium mb-2">README Preview:</h5>
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                              {solution.readme}
                            </pre>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(solution.path)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Copy Path
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`cd "${solution.path}" && npm install && npm run build && npm start`)}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Copy Run Commands
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AdminLayout>
  );
}
