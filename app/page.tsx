'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ScoreRing from '@/components/ScoreRing';
import RawDataModal from '@/components/RawDataModal';
import AIRoadmap from '@/components/AIRoadmap';
import type { RawFindings, Recommendation } from '@/lib/database';

interface LogEntry {
  tag: string;
  message: string;
  timestamp: string;
}

interface ScanResult {
  score: number;
  semanticScore: number;
  tokenScore: number;
  metadataScore: number;
  rawFindings: RawFindings;
  recommendations: Recommendation[];
}

type ScanState = 'idle' | 'scanning' | 'complete' | 'error';

const TAG_COLORS: Record<string, string> = {
  INIT: 'text-slate-400',
  FETCH: 'text-electric-blue',
  PARSE: 'text-neon-purple',
  META: 'text-yellow-400',
  OG: 'text-orange-400',
  SCHEMA: 'text-cyan-400',
  SEMANTIC: 'text-green-400',
  MULTIMODAL: 'text-pink-400',
  LINKS: 'text-indigo-400',
  TOKENIZE: 'text-amber-400',
  SCORE: 'text-cyber-lime',
  ROADMAP: 'text-teal-400',
  COMPLETE: 'text-cyber-lime',
  ERROR: 'text-red-400',
};

function getScoreColor(score: number): string {
  if (score >= 75) return '#b9ff57';
  if (score >= 50) return '#00d4ff';
  if (score >= 25) return '#f59e0b';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Weak';
  return 'Critical';
}

function formatTimestamp(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string>('');
  const terminalRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startScan = useCallback(async () => {
    if (!url.trim() || scanState === 'scanning') return;

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      // Use http for localhost/IP addresses, https for everything else
      const isLocal = /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/i.test(normalizedUrl);
      normalizedUrl = (isLocal ? 'http://' : 'https://') + normalizedUrl;
    }

    // Reset state
    setLogs([]);
    setResult(null);
    setError(null);
    setScanState('scanning');

    try {
      // Create scan
      const createRes = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create scan');
      }

      const { id, url: resolvedUrl } = await createRes.json();
      setScanId(id);
      setScannedUrl(resolvedUrl);

      // Connect to SSE stream
      const es = new EventSource(`/api/scan/${id}/stream`);
      eventSourceRef.current = es;

      es.addEventListener('log', (e) => {
        try {
          const data = JSON.parse(e.data);
          const timestamp = formatTimestamp(new Date());
          setLogs(prev => [...prev, { tag: data.tag, message: data.message, timestamp }]);
        } catch {
          // skip
        }
      });

      es.addEventListener('complete', (e) => {
        try {
          const data = JSON.parse(e.data);
          setResult(data);
          setScanState('complete');
        } catch {
          setError('Failed to parse scan results');
          setScanState('error');
        }
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener('error', (e) => {
        try {
          if (e instanceof MessageEvent) {
            const data = JSON.parse(e.data);
            setError(data.message || 'Scan failed');
          } else {
            setError('Connection error during scan');
          }
        } catch {
          setError('Scan failed');
        }
        setScanState('error');
        es.close();
        eventSourceRef.current = null;
      });

      es.onerror = () => {
        setError('Connection lost during scan');
        setScanState('error');
        es.close();
        eventSourceRef.current = null;
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setScanState('error');
    }
  }, [url, scanState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startScan();
  };

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setScanState('idle');
    setLogs([]);
    setResult(null);
    setError(null);
    setScanId(null);
    setScannedUrl('');
    setUrl('');
  };

  return (
    <main className="min-h-screen neural-bg grid-lines">
      {/* Header */}
      <header className="border-b border-electric-blue/10 bg-dark-bg/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-electric-blue/20 border border-electric-blue/40 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight">LUMINA</span>
            <span className="text-slate-500 text-sm hidden sm:block">AI-Optimization Engine</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
            <span className="hidden md:block">v1.0.0</span>
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-lime animate-pulse" />
            <span className="text-cyber-lime">ONLINE</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero Section */}
        {scanState === 'idle' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            {/* Decorative rings */}
            <div className="relative mb-10">
              <div className="w-24 h-24 rounded-full border border-electric-blue/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border border-electric-blue/30 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-electric-blue/10 border border-electric-blue/50 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="8" stroke="#00d4ff" strokeWidth="2"/>
                      <path d="m21 21-4.35-4.35" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full border border-cyber-lime/10 animate-[spin_20s_linear_infinite]" />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight tracking-tight">
              AI Readiness{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-cyber-lime">
                Scanner
              </span>
            </h1>

            <p className="text-slate-400 text-lg max-w-2xl mb-2">
              Evaluate your website&apos;s AI Readiness Score. Discover how effectively your content is parsed, indexed, and understood by LLMs and AI search engines.
            </p>
            <p className="text-slate-500 text-sm max-w-xl mb-10 font-mono">
              Powered by semantic entropy analysis · context window optimization · indexing latency metrics
            </p>

            {/* URL Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-2xl">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-electric-blue/60 font-mono text-sm select-none">
                    https://
                  </div>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="yourdomain.com"
                    className="w-full pl-20 pr-4 py-3.5 bg-dark-card/80 border border-electric-blue/30 rounded-lg text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-electric-blue/60 focus:ring-1 focus:ring-electric-blue/30 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="px-6 py-3.5 bg-electric-blue/20 border border-electric-blue/40 text-electric-blue font-semibold rounded-lg hover:bg-electric-blue/30 hover:border-electric-blue/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 glow-blue font-mono text-sm whitespace-nowrap"
                >
                  SCAN →
                </button>
              </div>
              <p className="text-slate-600 text-xs mt-3 font-mono text-center">
                Real-time analysis · No data stored beyond session · Secure scanning protocol
              </p>
            </form>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-8 justify-center">
              {['JSON-LD Schema', 'OpenGraph', 'Semantic Headers', 'Token Density', 'Indexing Latency', 'Multimodal'].map(f => (
                <span key={f} className="px-3 py-1 text-xs font-mono border border-electric-blue/20 text-slate-400 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Scanning / Terminal Phase */}
        {(scanState === 'scanning' || scanState === 'complete' || scanState === 'error') && (
          <div className="space-y-6">
            {/* Status bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  scanState === 'scanning' ? 'bg-electric-blue animate-pulse' :
                  scanState === 'complete' ? 'bg-cyber-lime' : 'bg-red-400'
                }`} />
                <span className="text-sm font-mono text-slate-300">
                  {scanState === 'scanning' ? 'SCANNING IN PROGRESS' :
                   scanState === 'complete' ? 'SCAN COMPLETE' : 'SCAN ERROR'}
                </span>
                {scanId && (
                  <span className="text-xs font-mono text-slate-500 hidden md:block">
                    ID: {scanId.substring(0, 8)}...
                  </span>
                )}
              </div>
              <button
                onClick={handleReset}
                className="text-xs font-mono text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-3 py-1.5 rounded transition-all"
              >
                ← New Scan
              </button>
            </div>

            {/* Terminal Feed */}
            <div className="terminal-bg rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-electric-blue/20">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <span className="text-slate-400 text-xs font-mono ml-2">lumina-scanner — live feed</span>
                {scanState === 'scanning' && (
                  <span className="ml-auto text-xs font-mono text-electric-blue animate-pulse">● LIVE</span>
                )}
              </div>
              <div
                ref={terminalRef}
                className="p-4 h-80 overflow-auto space-y-0.5"
              >
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs font-mono leading-5">
                    <span className="text-slate-600 shrink-0 w-24 hidden sm:block">{log.timestamp}</span>
                    <span className={`shrink-0 w-20 ${TAG_COLORS[log.tag] || 'text-slate-400'}`}>
                      [{log.tag}]
                    </span>
                    <span className="text-slate-300 break-words min-w-0">{log.message}</span>
                  </div>
                ))}
                {scanState === 'scanning' && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-600 shrink-0 w-24 hidden sm:block">
                      {formatTimestamp(new Date())}
                    </span>
                    <span className="text-cyber-lime terminal-cursor"></span>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 text-xs font-mono">
                    <span className="text-red-400 shrink-0 w-20">[ERROR]</span>
                    <span className="text-red-300">{error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            {scanState === 'complete' && result && (
              <div className="space-y-6 animate-fadeIn">
                {/* Score Overview */}
                <div className="glass rounded-xl p-6">
                  <div className="flex flex-col lg:flex-row gap-6 items-center">
                    {/* Main score */}
                    <div className="flex flex-col items-center gap-2">
                      <ScoreRing
                        score={result.score}
                        size={160}
                        strokeWidth={12}
                        color={getScoreColor(result.score)}
                      />
                      <div className="text-center">
                        <div className="text-white font-bold text-xl">{getScoreLabel(result.score)}</div>
                        <div className="text-slate-400 text-xs font-mono">AI Readiness Score</div>
                      </div>
                    </div>

                    {/* Score breakdown */}
                    <div className="flex-1 space-y-4">
                      <h2 className="text-white font-bold text-lg">AI Readiness Score</h2>
                      <div className="bg-dark-bg/40 rounded-lg p-3 font-mono text-xs text-slate-400 border border-electric-blue/10">
                        <span className="text-slate-500">AI Score = </span>
                        <span className="text-electric-blue">(0.4 × Semantic)</span>
                        <span className="text-slate-500"> + </span>
                        <span className="text-cyber-lime">(0.3 × Token)</span>
                        <span className="text-slate-500"> + </span>
                        <span className="text-neon-purple">(0.3 × Metadata)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Semantic Structure', score: result.semanticScore, color: '#00d4ff', weight: 'W=0.4' },
                          { label: 'Token Density', score: result.tokenScore, color: '#b9ff57', weight: 'W=0.3' },
                          { label: 'Metadata Accuracy', score: result.metadataScore, color: '#c084fc', weight: 'W=0.3' },
                        ].map(item => (
                          <div key={item.label} className="bg-dark-bg/50 rounded-lg p-3 border border-electric-blue/10">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs text-slate-400">{item.label}</span>
                              <span className="text-xs font-mono text-slate-500">{item.weight}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-dark-bg rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-1000"
                                  style={{
                                    width: `${item.score}%`,
                                    background: item.color,
                                    boxShadow: `0 0 8px ${item.color}`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-mono font-bold w-10 text-right" style={{ color: item.color }}>
                                {Math.round(item.score)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 items-stretch lg:items-end">
                      <RawDataModal rawFindings={result.rawFindings} url={scannedUrl || url} />
                      <button
                        onClick={() => {
                          const report = {
                            url: scannedUrl || url,
                            score: result.score,
                            semanticScore: result.semanticScore,
                            tokenScore: result.tokenScore,
                            metadataScore: result.metadataScore,
                            recommendations: result.recommendations,
                            generatedAt: new Date().toISOString(),
                          };
                          const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.download = `lumina-report-${new URL(scannedUrl || url).hostname}.json`;
                          link.click();
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-mono border border-cyber-lime/30 text-cyber-lime hover:bg-cyber-lime/10 rounded transition-all duration-200"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Export Report
                      </button>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'HTTP Status',
                      value: result.rawFindings.httpStatus,
                      sub: 'Response code',
                      color: result.rawFindings.httpStatus === 200 ? 'text-cyber-lime' : 'text-yellow-400',
                    },
                    {
                      label: 'Load Time',
                      value: `${result.rawFindings.loadTime}ms`,
                      sub: 'Indexing latency',
                      color: result.rawFindings.loadTime < 2000 ? 'text-cyber-lime' : result.rawFindings.loadTime < 5000 ? 'text-yellow-400' : 'text-red-400',
                    },
                    {
                      label: 'Text Density',
                      value: `${result.rawFindings.textToHtmlRatio.toFixed(1)}%`,
                      sub: 'Text-to-HTML ratio',
                      color: result.rawFindings.textToHtmlRatio >= 20 ? 'text-cyber-lime' : 'text-yellow-400',
                    },
                    {
                      label: 'JSON-LD Schemas',
                      value: result.rawFindings.jsonLdSchemas.length,
                      sub: 'Structured data objects',
                      color: result.rawFindings.jsonLdSchemas.length >= 2 ? 'text-cyber-lime' : result.rawFindings.jsonLdSchemas.length === 1 ? 'text-yellow-400' : 'text-red-400',
                    },
                  ].map(metric => (
                    <div key={metric.label} className="glass rounded-lg p-4">
                      <div className={`text-2xl font-bold font-mono ${metric.color}`}>{metric.value}</div>
                      <div className="text-white text-sm font-medium mt-1">{metric.label}</div>
                      <div className="text-slate-500 text-xs">{metric.sub}</div>
                    </div>
                  ))}
                </div>

                {/* AI Roadmap */}
                <AIRoadmap recommendations={result.recommendations} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-electric-blue/10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-slate-600 text-xs font-mono">
            LUMINA AI-OPTIMIZATION ENGINE · v1.0.0
          </div>
          <div className="text-slate-600 text-xs font-mono">
            Semantic Entropy Analysis · Context Window Optimization · Indexing Latency Metrics
          </div>
        </div>
      </footer>
    </main>
  );
}
