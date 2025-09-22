'use client';

import React, { useState, useEffect } from 'react';
import type { ReasoningEvent } from '@/lib/types/collaboration';

interface ReasoningStreamProps {
  goalId: string;
  className?: string;
}

export function ReasoningStream({ goalId, className = '' }: ReasoningStreamProps) {
  const [reasoningEvents, setReasoningEvents] = useState<ReasoningEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const handleReasoningEvent = (event: CustomEvent<ReasoningEvent>) => {
      const reasoningEvent = event.detail;
      if (reasoningEvent.goalId === goalId && reasoningEvent.kind === 'reasoning') {
        setReasoningEvents(prev => [...prev, reasoningEvent].slice(-20)); // Keep last 20 reasoning events
        setIsStreaming(true);
        
        // Stop streaming indicator after 3 seconds
        setTimeout(() => setIsStreaming(false), 3000);
      }
    };

    window.addEventListener('collaboration', handleReasoningEvent as EventListener);
    window.addEventListener('reasoning', handleReasoningEvent as EventListener);
    
    return () => {
      window.removeEventListener('collaboration', handleReasoningEvent as EventListener);
          window.removeEventListener('reasoning', handleReasoningEvent as EventListener);
    };
  }, [goalId]);

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <span className="text-lg">🧠</span>
        <h3 className="text-lg font-semibold text-blue-800">Agent Reasoning</h3>
        {isStreaming && (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <span className="text-sm text-blue-600">Thinking...</span>
          </div>
        )}
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {reasoningEvents.length === 0 ? (
          <div className="text-center text-blue-600 py-8">
            <div className="text-4xl mb-2">🤔</div>
            <p>Waiting for agent reasoning...</p>
          </div>
        ) : (
          reasoningEvents.map((event, index) => (
            <div key={index} className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">🧠</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-blue-800">
                      {event.context?.agentId || 'System'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center space-x-1">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${event.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(event.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {event.text}
                  </p>
                  {event.stepId && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        Step {event.stepId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
