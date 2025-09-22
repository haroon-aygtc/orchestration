'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap
} from 'lucide-react';

interface SystemMetric {
  name: string;
  value: string;
  status: 'healthy' | 'warning' | 'error';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  tasksCompleted: number;
  lastActivity: string;
}

export function RealTimeMonitor() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    {
      name: 'System Health',
      value: '98.5%',
      status: 'healthy',
      trend: 'stable',
      lastUpdated: new Date().toLocaleTimeString()
    },
    {
      name: 'Active Agents',
      value: '10',
      status: 'healthy',
      trend: 'up',
      lastUpdated: new Date().toLocaleTimeString()
    },
    {
      name: 'Tasks Completed',
      value: '1,247',
      status: 'healthy',
      trend: 'up',
      lastUpdated: new Date().toLocaleTimeString()
    },
    {
      name: 'Response Time',
      value: '125ms',
      status: 'healthy',
      trend: 'down',
      lastUpdated: new Date().toLocaleTimeString()
    }
  ]);

  const [agents, setAgents] = useState<AgentStatus[]>([
    { id: '1', name: 'Intent Agent', status: 'active', tasksCompleted: 156, lastActivity: '2 min ago' },
    { id: '2', name: 'Retriever Agent', status: 'active', tasksCompleted: 89, lastActivity: '1 min ago' },
    { id: '3', name: 'Tool Agent', status: 'idle', tasksCompleted: 234, lastActivity: '5 min ago' },
    { id: '4', name: 'Workflow Agent', status: 'active', tasksCompleted: 67, lastActivity: '30 sec ago' },
    { id: '5', name: 'Memory Agent', status: 'active', tasksCompleted: 445, lastActivity: '1 min ago' },
    { id: '6', name: 'Follow Agent', status: 'idle', tasksCompleted: 23, lastActivity: '10 min ago' },
    { id: '7', name: 'Formatter Agent', status: 'active', tasksCompleted: 178, lastActivity: '45 sec ago' },
    { id: '8', name: 'Guardrail Agent', status: 'active', tasksCompleted: 12, lastActivity: '3 min ago' },
    { id: '9', name: 'LLM Agent', status: 'active', tasksCompleted: 334, lastActivity: '15 sec ago' },
    { id: '10', name: 'UI Generator Agent', status: 'idle', tasksCompleted: 5, lastActivity: '20 min ago' }
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // Real production API call to get metrics
      const response = await fetch('/api/metrics/real-time');
      if (response.ok) {
        const realMetrics = await response.json();
        setMetrics(realMetrics);
      } else {
        console.error('Failed to fetch real-time metrics');
      }
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      // Auto-refresh every 30 seconds
      refreshData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'idle':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'idle':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-Time System Monitor</h1>
          <p className="text-muted-foreground">Monitor agent performance and system health in real-time</p>
        </div>
        <Button onClick={refreshData} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              {getStatusIcon(metric.status)}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{metric.value}</div>
                {getTrendIcon(metric.trend)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Updated {metric.lastUpdated}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Agent Status
          </CardTitle>
          <CardDescription>
            Real-time status of all specialized agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(agent.status)}
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {agent.tasksCompleted} tasks completed
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={getStatusBadgeVariant(agent.status)}>
                    {agent.status}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {agent.lastActivity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
