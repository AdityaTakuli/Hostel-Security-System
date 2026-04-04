'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@hostel-monitor/ui';

interface HeatmapEntry {
  cameraId: string;
  alertCount: number;
  redCount: number;
  yellowCount: number;
  riskLevel: 'RED' | 'YELLOW' | 'GREEN';
}

const RISK_COLORS = {
  RED: { bg: 'bg-alert-red/20', border: 'border-alert-red', text: 'text-alert-red', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
  YELLOW: { bg: 'bg-warning-amber/20', border: 'border-warning-amber', text: 'text-warning-amber', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.2)]' },
  GREEN: { bg: 'bg-online-green/10', border: 'border-online-green/30', text: 'text-online-green', glow: '' },
};

const TIME_WINDOWS = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
];

export default function HeatmapPage() {
  const [data, setData] = useState<HeatmapEntry[]>([]);
  const [window, setWindow] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/alerts/heatmap?window=${window}`)
      .then(res => res.json())
      .then(result => {
        setData(result.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [window]);

  const totalAlerts = data.reduce((sum, d) => sum + d.alertCount, 0);
  const redCameras = data.filter(d => d.riskLevel === 'RED').length;
  const yellowCameras = data.filter(d => d.riskLevel === 'YELLOW').length;

  const selectedEntry = data.find(d => d.cameraId === selectedCamera);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-black text-white font-mono">
      {/* Header */}
      <div className="w-full border-b border-white/20 bg-black px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold tracking-widest uppercase flex items-center gap-3">
              <span className="w-3 h-3 bg-accent-violet" />
              Threat Heatmap
            </h1>
            <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-1">
              Real-time alert density visualization
            </p>
          </div>

          {/* Time window selector */}
          <div className="flex items-center gap-1 border border-white/20">
            {TIME_WINDOWS.map(tw => (
              <button
                key={tw.value}
                onClick={() => setWindow(tw.value)}
                className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${
                  window === tw.value
                    ? 'bg-accent-violet text-black'
                    : 'bg-black text-text-secondary hover:text-white'
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="w-full border-b border-white/10 px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-text-secondary font-bold">Total Alerts:</span>
            <span className="text-[14px] font-bold text-white">{totalAlerts}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-alert-red" />
            <span className="text-[9px] uppercase tracking-widest text-text-secondary font-bold">Critical:</span>
            <span className="text-[14px] font-bold text-alert-red">{redCameras}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-warning-amber" />
            <span className="text-[9px] uppercase tracking-widest text-text-secondary font-bold">Warning:</span>
            <span className="text-[14px] font-bold text-warning-amber">{yellowCameras}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-online-green" />
            <span className="text-[9px] uppercase tracking-widest text-text-secondary font-bold">Clear:</span>
            <span className="text-[14px] font-bold text-online-green">{Math.max(0, data.length - redCameras - yellowCameras)}</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 px-6 py-6">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Heatmap grid */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="flex items-center justify-center h-64 border border-dashed border-white/20">
                <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold animate-pulse">
                  Loading heatmap data...
                </span>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border border-dashed border-white/20">
                <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">
                  No alerts in selected time window
                </span>
                <span className="text-[9px] text-text-secondary mt-2">
                  All cameras are clear
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {data.map((entry, i) => {
                  const risk = RISK_COLORS[entry.riskLevel];
                  return (
                    <motion.div
                      key={entry.cameraId}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedCamera(entry.cameraId)}
                      className={`cursor-pointer border ${risk.border} ${risk.bg} ${risk.glow} p-4 hover:bg-white/5 transition-all ${
                        selectedCamera === entry.cameraId ? 'ring-1 ring-accent-violet' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] uppercase tracking-widest text-text-secondary font-bold">
                          {entry.cameraId.slice(0, 8)}
                        </span>
                        <div className={`w-2.5 h-2.5 ${
                          entry.riskLevel === 'RED' ? 'bg-alert-red animate-pulse' :
                          entry.riskLevel === 'YELLOW' ? 'bg-warning-amber' : 'bg-online-green'
                        }`} />
                      </div>
                      <div className={`text-2xl font-bold ${risk.text} mb-1`}>
                        {entry.alertCount}
                      </div>
                      <div className="text-[8px] uppercase tracking-widest text-text-secondary font-bold">
                        Alerts
                      </div>

                      {/* Mini bar chart */}
                      <div className="mt-3 flex gap-1 h-2">
                        {entry.redCount > 0 && (
                          <div className="bg-alert-red" style={{ flex: entry.redCount }} />
                        )}
                        {entry.yellowCount > 0 && (
                          <div className="bg-warning-amber" style={{ flex: entry.yellowCount }} />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-1 border border-white/20 bg-black self-start">
            <div className="p-4 border-b border-white/10">
              <span className="text-[9px] uppercase tracking-widest text-accent-violet font-bold">
                Camera Detail
              </span>
            </div>
            {selectedEntry ? (
              <div className="p-4 space-y-4">
                <div>
                  <span className="text-[9px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Camera ID</span>
                  <span className="text-[12px] font-bold text-white font-mono">{selectedEntry.cameraId}</span>
                </div>
                <div>
                  <span className="text-[9px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Risk Level</span>
                  <Badge variant={selectedEntry.riskLevel === 'RED' ? 'danger' : selectedEntry.riskLevel === 'YELLOW' ? 'warning' : 'success'}>
                    {selectedEntry.riskLevel}
                  </Badge>
                </div>
                <div>
                  <span className="text-[9px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Alert Breakdown</span>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-alert-red font-bold">RED</span>
                      <span className="text-[12px] font-bold text-white">{selectedEntry.redCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-warning-amber font-bold">YELLOW</span>
                      <span className="text-[12px] font-bold text-white">{selectedEntry.yellowCount}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/10 pt-2">
                      <span className="text-[10px] text-text-secondary font-bold">TOTAL</span>
                      <span className="text-[14px] font-bold text-white">{selectedEntry.alertCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 flex items-center justify-center h-32">
                <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">
                  Click a camera node
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
