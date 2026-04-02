'use client';

import type { Recommendation } from '@/lib/database';

interface AIRoadmapProps {
  recommendations: Recommendation[];
}

const priorityConfig = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-400', label: 'CRITICAL' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-400', label: 'HIGH' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-400', label: 'MEDIUM' },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', dot: 'bg-blue-400', label: 'LOW' },
};

export default function AIRoadmap({ recommendations }: AIRoadmapProps) {
  if (recommendations.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <div className="text-cyber-lime text-4xl mb-3">✓</div>
        <div className="text-white font-semibold">Optimal AI Configuration Detected</div>
        <div className="text-slate-400 text-sm mt-1">No critical optimization vectors identified.</div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="p-4 border-b border-electric-blue/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-cyber-lime rounded-full"></div>
          <h3 className="text-white font-semibold">AI Optimization Roadmap</h3>
          <span className="ml-auto text-xs font-mono text-slate-400">
            {recommendations.length} optimization vector{recommendations.length !== 1 ? 's' : ''} identified
          </span>
        </div>
      </div>

      <div className="divide-y divide-electric-blue/10">
        {recommendations.map((rec, index) => {
          const config = priorityConfig[rec.priority];
          return (
            <div key={index} className="p-4 hover:bg-electric-blue/5 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${config.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{rec.category}</span>
                  </div>
                  <p className="text-sm text-white font-medium mt-1.5">{rec.issue}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    <span className="text-electric-blue">Impact: </span>
                    {rec.impact}
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    <span className="text-cyber-lime">Fix: </span>
                    {rec.fix}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
