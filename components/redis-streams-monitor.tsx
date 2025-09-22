'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Database, MessageSquare, Workflow, Cpu, Settings } from 'lucide-react';

interface StreamHealth {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  redis: {
    connected: boolean;
    url: string;
  };
  streams: {
    orchestration: StreamInfo;
    agentCommunication: StreamInfo;
    workflowSteps: StreamInfo;
    nodeExecutions: StreamInfo;
    coordination: StreamInfo;
  };
  summary: {
    totalStreams: number;
    healthyStreams: number;
    totalGroups: number;
    healthyGroups: number;
    totalPendingMessages: number;
  };
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

interface StreamInfo {
  exists: boolean;
  info?: {
    length: number;
    groups: number;
    lastGeneratedId: string;
  };
  group?: {
    name: string;
    consumers: number;
    pending: number;
    lastDeliveredId: string;
  };
  pending: number;
  error?: string;
}

export function RedisStreamsMonitor() {
  const [health, setHealth] = useState<StreamHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/streams/health');
      const data = await response.json();
      
      if (data.success) {
        setHealth(data.data);
        setLastRefresh(new Date());
      } else {
        setError(data.error || 'Failed to fetch health data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (exists: boolean, error?: string) => {
    if (error) return <Badge variant="destructive">Error</Badge>;
    if (exists) return <Badge variant="default">Active</Badge>;
    return <Badge variant="secondary">Inactive</Badge>;
  };

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading Redis Streams health...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load Redis Streams health: {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={fetchHealth}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!health) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Redis Streams Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of Redis Streams and Consumer Groups
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchHealth}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {lastRefresh && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${getStatusColor(health.status)}`} />
              <p className="text-sm font-medium">Overall Status</p>
              <p className="text-xs text-muted-foreground capitalize">{health.status}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{health.summary.healthyStreams}/{health.summary.totalStreams}</p>
              <p className="text-sm text-muted-foreground">Streams Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{health.summary.healthyGroups}/{health.summary.totalGroups}</p>
              <p className="text-sm text-muted-foreground">Groups Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{health.summary.totalPendingMessages}</p>
              <p className="text-sm text-muted-foreground">Pending Messages</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Streams Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Orchestration Events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Orchestration Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Status</span>
                {getStatusBadge(health.streams.orchestration.exists, health.streams.orchestration.error)}
              </div>
              {health.streams.orchestration.info && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Messages</span>
                    <span className="text-xs font-mono">{health.streams.orchestration.info.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Groups</span>
                    <span className="text-xs font-mono">{health.streams.orchestration.info.groups}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Pending</span>
                    <span className="text-xs font-mono">{health.streams.orchestration.pending}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agent Communication */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Agent Communication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Status</span>
                {getStatusBadge(health.streams.agentCommunication.exists, health.streams.agentCommunication.error)}
              </div>
              {health.streams.agentCommunication.info && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Messages</span>
                    <span className="text-xs font-mono">{health.streams.agentCommunication.info.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Groups</span>
                    <span className="text-xs font-mono">{health.streams.agentCommunication.info.groups}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Pending</span>
                    <span className="text-xs font-mono">{health.streams.agentCommunication.pending}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Workflow Steps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm">
              <Workflow className="h-4 w-4 mr-2" />
              Workflow Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Status</span>
                {getStatusBadge(health.streams.workflowSteps.exists, health.streams.workflowSteps.error)}
              </div>
              {health.streams.workflowSteps.info && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Messages</span>
                    <span className="text-xs font-mono">{health.streams.workflowSteps.info.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Groups</span>
                    <span className="text-xs font-mono">{health.streams.workflowSteps.info.groups}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Pending</span>
                    <span className="text-xs font-mono">{health.streams.workflowSteps.pending}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Node Executions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm">
              <Cpu className="h-4 w-4 mr-2" />
              Node Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Status</span>
                {getStatusBadge(health.streams.nodeExecutions.exists, health.streams.nodeExecutions.error)}
              </div>
              {health.streams.nodeExecutions.info && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Messages</span>
                    <span className="text-xs font-mono">{health.streams.nodeExecutions.info.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Groups</span>
                    <span className="text-xs font-mono">{health.streams.nodeExecutions.info.groups}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Pending</span>
                    <span className="text-xs font-mono">{health.streams.nodeExecutions.pending}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coordination */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm">
              <Settings className="h-4 w-4 mr-2" />
              Coordination
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Status</span>
                {getStatusBadge(health.streams.coordination.exists, health.streams.coordination.error)}
              </div>
              {health.streams.coordination.info && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Messages</span>
                    <span className="text-xs font-mono">{health.streams.coordination.info.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Groups</span>
                    <span className="text-xs font-mono">{health.streams.coordination.info.groups}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Pending</span>
                    <span className="text-xs font-mono">{health.streams.coordination.pending}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Redis Connection</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant={health.redis.connected ? "default" : "destructive"}>
                    {health.redis.connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>URL:</span>
                  <span className="font-mono text-xs">{health.redis.url}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Process Information</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span>{formatUptime(health.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory RSS:</span>
                  <span>{formatBytes(health.memory.rss)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Heap Used:</span>
                  <span>{formatBytes(health.memory.heapUsed)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
