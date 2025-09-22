'use client';

import React, { useState, useEffect } from 'react';
import type { SuggestionEvent } from '@/lib/types/collaboration';

interface SuggestionPanelProps {
  goalId: string;
  className?: string;
  onSuggestionClick?: (suggestion: SuggestionEvent) => void;
}

export function SuggestionPanel({ goalId, className = '', onSuggestionClick }: SuggestionPanelProps) {
  const [suggestions, setSuggestions] = useState<SuggestionEvent[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const handleSuggestionEvent = (event: CustomEvent<SuggestionEvent>) => {
      const suggestionEvent = event.detail;
      if (suggestionEvent.goalId === goalId && suggestionEvent.kind === 'suggestion') {
        setSuggestions(prev => [...prev, suggestionEvent].slice(-10)); // Keep last 10 suggestions
      }
    };

    window.addEventListener('collaboration', handleSuggestionEvent as EventListener);
    
    return () => {
      window.removeEventListener('collaboration', handleSuggestionEvent as EventListener);
    };
  }, [goalId]);

  const handleSuggestionClick = (suggestion: SuggestionEvent) => {
    setSelectedSuggestion(suggestion.id);
    onSuggestionClick?.(suggestion);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center space-x-2">
          <span className="text-lg">💡</span>
          <h3 className="text-lg font-semibold text-gray-800">AI Suggestions</h3>
          {suggestions.length > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
              {suggestions.length} new
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {suggestions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">💭</div>
            <p>No suggestions yet...</p>
            <p className="text-sm">AI will provide recommendations as it analyzes your goal.</p>
          </div>
        ) : (
          suggestions.map((suggestionEvent, index) => (
            <div 
              key={suggestionEvent.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedSuggestion === suggestionEvent.id 
                  ? 'border-yellow-400 bg-yellow-50' 
                  : 'border-gray-200 hover:border-yellow-300'
              }`}
              onClick={() => handleSuggestionClick(suggestionEvent)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 text-sm">💡</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-gray-800">
                      {suggestionEvent.fromAgent}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(suggestionEvent.confidence)}`}>
                      {getConfidenceLabel(suggestionEvent.confidence)} Confidence
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(suggestionEvent.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">
                    {suggestionEvent.suggestion}
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      Action: <span className="font-medium">{suggestionEvent.action}</span>
                    </span>
                    {suggestionEvent.toAgent && (
                      <span className="text-xs text-gray-500">
                        → {suggestionEvent.toAgent}
                      </span>
                    )}
                  </div>
                  
                  {suggestionEvent.stepId && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        Step {suggestionEvent.stepId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Click on a suggestion to see details
            </span>
            <button 
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={() => setSuggestions([])}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
