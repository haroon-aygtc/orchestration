'use client';

import React, { useState, useEffect } from 'react';
import type { StatusEvent } from '@/lib/types/collaboration';

interface StatusIndicatorProps {
  goalId: string;
  className?: string;
}

export function StatusIndicator({ goalId, className = '' }: StatusIndicatorProps) {
  const [currentStatus, setCurrentStatus] = useState<StatusEvent | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusEvent[]>([]);

  useEffect(() => {
    const handleStatusEvent = (event: CustomEvent<StatusEvent>) => {
      const statusEvent = event.detail;
      if (statusEvent.goalId === goalId && statusEvent.kind === 'status') {
        setCurrentStatus(statusEvent);
        setStatusHistory(prev => [...prev, statusEvent].slice(-5)); // Keep last 5 status events
      }
    };

    window.addEventListener('collaboration', handleStatusEvent as EventListener);
    
    return () => {
      window.removeEventListener('collaboration', handleStatusEvent as EventListener);
    };
  }, [goalId]);

  const getStatusIcon = (status: string) => {
    if (status.includes('started')) return '🚀';
    if (status.includes('completed')) return '✅';
    if (status.includes('failed')) return '❌';
    if (status.includes('progress')) return '📈';
    if (status.includes('plan')) return '📋';
    return '📊';
  };

  const getStatusColor = (status: string) => {
    if (status.includes('started')) return 'text-blue-600 bg-blue-100';
    if (status.includes('completed')) return 'text-green-600 bg-green-100';
    if (status.includes('failed')) return 'text-red-600 bg-red-100';
    if (status.includes('progress')) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const formatStatus = (status: string) => {
    return status.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="p-4">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-lg">📊</span>
          <h3 className="text-lg font-semibold text-gray-800">System Status</h3>
        </div>

        {currentStatus ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-2xl">{getStatusIcon(currentStatus.status)}</span>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(currentStatus.status)}`}>
                    {formatStatus(currentStatus.status)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(currentStatus.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                {currentStatus.progress !== undefined && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{currentStatus.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${currentStatus.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {currentStatus.meta && (
                  <div className="mt-2 text-xs text-gray-600">
                    {Object.entries(currentStatus.meta).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {statusHistory.length > 1 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Recent Status Updates</h4>
                <div className="space-y-1">
                  {statusHistory.slice(-3).reverse().map((status, index) => (
                    <div key={index} className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{getStatusIcon(status.status)}</span>
                      <span>{formatStatus(status.status)}</span>
                      <span>•</span>
                      <span>{new Date(status.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">⏳</div>
            <p>Waiting for status updates...</p>
          </div>
        )}
      </div>
    </div>
  );
}
