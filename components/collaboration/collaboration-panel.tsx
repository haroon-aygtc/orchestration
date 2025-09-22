'use client';

import React, { useState, useEffect } from 'react';
import type { CollaborationEvent } from '@/lib/types/collaboration';

interface CollaborationPanelProps {
  goalId: string;
  className?: string;
}

export function CollaborationPanel({ goalId, className = '' }: CollaborationPanelProps) {
  const [events, setEvents] = useState<CollaborationEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Listen for collaboration events
    const handleCollaborationEvent = (event: CustomEvent<CollaborationEvent>) => {
      const collabEvent = event.detail;
      if (collabEvent.goalId === goalId) {
        setEvents(prev => [...prev, collabEvent].slice(-50)); // Keep last 50 events
      }
    };

    window.addEventListener('collaboration', handleCollaborationEvent as EventListener);
    
    return () => {
      window.removeEventListener('collaboration', handleCollaborationEvent as EventListener);
    };
  }, [goalId]);

  const getEventIcon = (kind: string) => {
    switch (kind) {
      case 'reasoning': return '🧠';
      case 'status': return '📊';
      case 'suggestion': return '💡';
      default: return '📝';
    }
  };

  const getEventColor = (kind: string) => {
    switch (kind) {
      case 'reasoning': return 'text-blue-600';
      case 'status': return 'text-green-600';
      case 'suggestion': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            🤝 Real-time Collaboration
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {events.length} events
            </span>
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No collaboration events yet. Start a goal to see real-time reasoning and suggestions.
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {events.map((event, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">{getEventIcon(event.kind)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${getEventColor(event.kind)}`}>
                        {event.kind.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      {event.stepId && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Step {event.stepId}
                        </span>
                      )}
                    </div>
                    
                    {event.kind === 'reasoning' && (
                      <p className="text-sm text-gray-700 mt-1">
                        {event.text}
                      </p>
                    )}
                    
                    {event.kind === 'status' && (
                      <div className="mt-1">
                        <p className="text-sm text-gray-700">{event.status}</p>
                        {event.progress !== undefined && (
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${event.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {event.kind === 'suggestion' && (
                      <div className="mt-1">
                        <p className="text-sm text-gray-700">{event.suggestion}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Action: {event.action}
                          </span>
                          <span className="text-xs text-gray-500">
                            Confidence: {Math.round(event.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
