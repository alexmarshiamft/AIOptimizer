'use client';

import { useState } from 'react';
import type { RawFindings } from '@/lib/database';

interface RawDataModalProps {
  rawFindings: RawFindings;
  url: string;
}

export default function RawDataModal({ rawFindings, url }: RawDataModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'headers' | 'schemas' | 'og' | 'text'>('overview');

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'headers' as const, label: 'HTTP Headers' },
    { id: 'schemas' as const, label: 'JSON-LD' },
    { id: 'og' as const, label: 'OpenGraph' },
    { id: 'text' as const, label: 'Raw Text' },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-mono border border-electric-blue/30 text-electric-blue hover:bg-electric-blue/10 rounded transition-all duration-200"
      >
        <span className="text-xs">{'{ }'}</span>
        View Raw Findings
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-4xl max-h-[85vh] glass rounded-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-electric-blue/20">
              <div>
                <h3 className="text-electric-blue font-mono font-semibold">RAW FINDINGS</h3>
                <p className="text-slate-400 text-xs mt-0.5 font-mono truncate max-w-md">{url}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-electric-blue/20 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs font-mono whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'text-electric-blue border-b-2 border-electric-blue bg-electric-blue/5'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'overview' && (
                <div className="space-y-3">
                  <h4 className="text-cyber-lime text-xs font-mono uppercase tracking-widest mb-3">// Scan Overview</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'HTTP Status', value: rawFindings.httpStatus, highlight: rawFindings.httpStatus === 200 },
                      { label: 'Load Time', value: `${rawFindings.loadTime}ms` },
                      { label: 'Text/HTML Ratio', value: `${rawFindings.textToHtmlRatio.toFixed(1)}%` },
                      { label: 'Word Count', value: rawFindings.wordCount.toLocaleString() },
                      { label: 'Total Images', value: rawFindings.imageCount },
                      { label: 'Images with Alt', value: rawFindings.imagesWithAlt },
                      { label: 'Internal Links', value: rawFindings.internalLinks },
                      { label: 'External Links', value: rawFindings.externalLinks },
                      { label: 'JSON-LD Schemas', value: rawFindings.jsonLdSchemas.length },
                      { label: 'OG Tags', value: Object.keys(rawFindings.openGraphTags).length },
                    ].map(item => (
                      <div key={item.label} className="bg-dark-bg/50 rounded p-3 border border-electric-blue/10">
                        <div className="text-slate-400 text-xs font-mono">{item.label}</div>
                        <div className={`text-sm font-mono font-semibold mt-1 ${item.highlight ? 'text-cyber-lime' : 'text-white'}`}>
                          {String(item.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="text-slate-400 text-xs font-mono mb-2">Title Tag:</div>
                    <div className="bg-dark-bg/50 p-3 rounded border border-electric-blue/10 text-sm font-mono text-white">
                      {rawFindings.titleTag || <span className="text-red-400">(missing)</span>}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-slate-400 text-xs font-mono mb-2">Meta Description:</div>
                    <div className="bg-dark-bg/50 p-3 rounded border border-electric-blue/10 text-sm font-mono text-white">
                      {rawFindings.metaDescription || <span className="text-red-400">(missing)</span>}
                    </div>
                  </div>
                  {rawFindings.semanticHeaders.length > 0 && (
                    <div className="mt-3">
                      <div className="text-slate-400 text-xs font-mono mb-2">Semantic Headers:</div>
                      <div className="bg-dark-bg/50 p-3 rounded border border-electric-blue/10 space-y-1 max-h-40 overflow-auto">
                        {rawFindings.semanticHeaders.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-electric-blue w-6">H{h.level}</span>
                            <span className="text-slate-300">{h.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'headers' && (
                <div>
                  <h4 className="text-cyber-lime text-xs font-mono uppercase tracking-widest mb-3">// HTTP Response Headers</h4>
                  <div className="space-y-1">
                    {Object.entries(rawFindings.headers).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-xs font-mono bg-dark-bg/50 p-2 rounded">
                        <span className="text-electric-blue min-w-[160px] shrink-0">{key}:</span>
                        <span className="text-slate-300 break-all">{value}</span>
                      </div>
                    ))}
                    {Object.keys(rawFindings.headers).length === 0 && (
                      <div className="text-slate-400 text-sm font-mono">No headers captured</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'schemas' && (
                <div>
                  <h4 className="text-cyber-lime text-xs font-mono uppercase tracking-widest mb-3">
                    // JSON-LD Structured Data ({rawFindings.jsonLdSchemas.length} schema(s))
                  </h4>
                  {rawFindings.jsonLdSchemas.length === 0 ? (
                    <div className="text-slate-400 text-sm font-mono p-4 bg-dark-bg/50 rounded border border-red-500/20">
                      ⚠ No JSON-LD schemas detected — critical indexing gap
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rawFindings.jsonLdSchemas.map((schema, i) => (
                        <div key={i}>
                          <div className="text-slate-400 text-xs font-mono mb-1">Schema {i + 1}:</div>
                          <pre className="bg-dark-bg/50 p-3 rounded border border-electric-blue/10 text-xs font-mono text-slate-300 overflow-auto max-h-64">
                            {JSON.stringify(schema, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'og' && (
                <div>
                  <h4 className="text-cyber-lime text-xs font-mono uppercase tracking-widest mb-3">// OpenGraph & Social Metadata</h4>
                  {Object.keys(rawFindings.openGraphTags).length === 0 ? (
                    <div className="text-slate-400 text-sm font-mono p-4 bg-dark-bg/50 rounded border border-red-500/20">
                      ⚠ No OpenGraph tags detected
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(rawFindings.openGraphTags).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-xs font-mono bg-dark-bg/50 p-2 rounded">
                          <span className="text-electric-blue min-w-[160px] shrink-0">{key}:</span>
                          <span className="text-slate-300 break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'text' && (
                <div>
                  <h4 className="text-cyber-lime text-xs font-mono uppercase tracking-widest mb-3">// Raw Text Sample (First 500 chars)</h4>
                  <pre className="bg-dark-bg/50 p-4 rounded border border-electric-blue/10 text-xs font-mono text-slate-300 whitespace-pre-wrap break-words">
                    {rawFindings.rawTextSample || '(No text content extracted)'}
                  </pre>
                  <div className="mt-4">
                    <h4 className="text-cyber-lime text-xs font-mono uppercase tracking-widest mb-3">// Extracted Schema Tags</h4>
                    {rawFindings.extractedTags.length > 0 ? (
                      <div className="space-y-1">
                        {rawFindings.extractedTags.map((tag, i) => (
                          <div key={i} className="text-xs font-mono text-slate-300 bg-dark-bg/50 p-2 rounded">
                            → {tag}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-sm font-mono">No schema tags extracted</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
