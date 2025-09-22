'use client';

import React, { useState, useEffect } from 'react';
import { CollaborationPanel } from '@/components/collaboration/collaboration-panel';
import { ReasoningStream } from '@/components/collaboration/reasoning-stream';
import { SuggestionPanel } from '@/components/collaboration/suggestion-panel';
import { StatusIndicator } from '@/components/collaboration/status-indicator';
import type { CollaborationEvent } from '@/lib/types/collaboration';

export default function CollaborationDemoPage() {
  const [goalId, setGoalId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Generate a demo goal ID
    const demoGoalId = `demo_goal_${Date.now()}`;
    setGoalId(demoGoalId);
    setIsConnected(true);

    // Simulate some demo collaboration events
    const simulateEvents = () => {
      const events: CollaborationEvent[] = [
        {
          id: 'demo_1',
          kind: 'reasoning',
          goalId: demoGoalId,
          text: 'Analyzing user requirements and determining the best approach...',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
          correlationId: 'demo_corr_1'
        },
        {
          id: 'demo_2',
          kind: 'status',
          goalId: demoGoalId,
          status: 'plan.generated',
          progress: 25,
          timestamp: new Date().toISOString(),
          correlationId: 'demo_corr_2'
        },
        {
          id: 'demo_3',
          kind: 'suggestion',
          goalId: demoGoalId,
          suggestion: 'Consider breaking this into smaller, more manageable tasks',
          action: 'split_goal',
          confidence: 0.7,
          fromAgent: 'PlanningAgent',
          timestamp: new Date().toISOString(),
          correlationId: 'demo_corr_3'
        }
      ];

      // Emit events with delays
      events.forEach((event, index) => {
        setTimeout(() => {
          const customEvent = new CustomEvent('collaboration', {
            detail: event
          });
          window.dispatchEvent(customEvent);
        }, index * 2000); // 2 seconds between events
      });
    };

    // Start simulation after a short delay
    setTimeout(simulateEvents, 1000);
  }, []);

  const handleSuggestionClick = (suggestion: CollaborationEvent) => {
    console.log('Suggestion clicked:', suggestion);
    // Here you would typically handle the suggestion action
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Real-Time Collaboration Demo
          </h1>
          <p className="text-gray-600">
            Experience real-time reasoning, suggestions, and status updates from AI agents.
          </p>
          <div className="mt-4 flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Goal ID: {goalId}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Reasoning and Status */}
          <div className="space-y-6">
            <ReasoningStream goalId={goalId} />
            <StatusIndicator goalId={goalId} />
          </div>

          {/* Right Column - Suggestions and Full Panel */}
          <div className="space-y-6">
            <SuggestionPanel 
              goalId={goalId} 
              onSuggestionClick={handleSuggestionClick}
            />
            <CollaborationPanel goalId={goalId} />
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            🎯 How to Use This Demo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <h4 className="font-medium mb-2">🧠 Reasoning Stream</h4>
              <p>Shows real-time thinking from AI agents as they process your goals.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">📊 Status Indicator</h4>
              <p>Displays current system status and progress updates.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">💡 Suggestions Panel</h4>
              <p>AI recommendations and actionable insights for your goals.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">🤝 Collaboration Panel</h4>
              <p>Complete history of all collaboration events for debugging.</p>
            </div>
          </div>
        </div>

        {/* Integration Code Example */}
        <div className="mt-8 bg-gray-900 text-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">💻 Integration Example</h3>
          <pre className="text-sm overflow-x-auto">
{`// Add to your OrchestrationService
import { OrchestrationCollab } from '@/lib/collaboration/orchestration-integration';

async createGoal(input: CreateGoalInput): Promise<OrchestrationGoal> {
  const goalId = generateUUID();
  
  // Add collaboration event
  await OrchestrationCollab.onGoalStart(goalId, input.description);
  
  // ... existing logic ...
}

// Add to your React components
import { CollaborationPanel } from '@/components/collaboration/collaboration-panel';

function MyGoalPage({ goalId }: { goalId: string }) {
  return (
    <div>
      <CollaborationPanel goalId={goalId} />
      {/* Your existing UI */}
    </div>
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
