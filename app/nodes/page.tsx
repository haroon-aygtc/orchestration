'use client';

import React from 'react';
import { NodeExplorer } from '@/components/nodes/node-explorer';

export default function NodesPage() {
  const handleNodeSelect = (node: any) => {
    console.log('Selected node:', node);
  };

  const handleNodeExecute = (nodeId: string, params: Record<string, any>) => {
    console.log('Executed node:', nodeId, 'with params:', params);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pre-built Nodes Explorer</h1>
        <p className="text-gray-600">
          Explore and execute pre-built nodes for your AI workflows. Each node is a production-ready component
          that can be composed into complex workflows.
        </p>
      </div>
      
      <NodeExplorer 
        onNodeSelect={handleNodeSelect}
        onNodeExecute={handleNodeExecute}
      />
    </div>
  );
}
