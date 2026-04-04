'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Badge } from '@hostel-monitor/ui';
import { ALERT_TYPE_EMOJI, ALERT_TYPE_LABEL, SEVERITY_COLOR, AlertType } from '@hostel-monitor/types';

interface AlertEntry {
  id: string;
  cameraId: string;
  type: string;
  severity: string;
  description: string;
  thumbnail?: string;
  frameSnapshot?: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
  zone?: string;
  detectedClass?: string;
  confidence?: number;
  actionTaken?: string;
  resolved: boolean;
  read: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const RISK_LEVELS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ALERT_TYPES = [
  '', 'FIGHT', 'LIQUOR', 'SMOKING', 'ANIMAL_MONKEY', 'ANIMAL_DOG',
  'UNAUTHORIZED_PERSON', 'WEAPON', 'ANIMAL_INTRUSION', 'LOITERING',
  'CROWD_SURGE', 'TRESPASSING', 'FOOD_INTRUSION', 'FIRE_DETECTED',
];

export default function AlertHistoryPage() {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertEntry | null>(null);
  const [actionText, setActionText] = useState('');
  const [resolving, setResolving] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterCameraId, setFilterCameraId] = useState('');

  const fetchAlerts = async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterType) params.set('type', filterType);
    if (filterSeverity) params.set('severity', filterSeverity);
    if (filterCameraId) params.set('cameraId', filterCameraId);

    try {
      const res = await fetch(`/api/alerts/history?${params}`);
      const result = await res.json();
      if (result.success) {
        setAlerts(result.data.alerts || []);
        setPagination(result.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [filterType, filterSeverity, filterCameraId]);

  const handleResolve = async () => {
    if (!selectedAlert) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/alerts/${selectedAlert.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionTaken: actionText }),
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a =>
          a.id === selectedAlert.id ? { ...a, resolved: true, actionTaken: actionText } : a
        ));
        setSelectedAlert(prev => prev ? { ...prev, resolved: true, actionTaken: actionText } : null);
        setActionText('');
      }
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-black text-white font-mono">
      {/* Header */}
      <div className="w-full border-b border-white/20 bg-black px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold tracking-widest uppercase flex items-center gap-3">
              <span className="w-3 h-3 bg-alert-red" />
              Alert History
            </h1>
            <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-1">
              {pagination.total} total events recorded
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="w-full border-b border-white/10 px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-black border border-white/20 px-3 py-2 text-[10px] font-mono text-white uppercase tracking-wider focus:border-accent-violet outline-none"
          >
            <option value="">All Types</option>
            {ALERT_TYPES.filter(Boolean).map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-black border border-white/20 px-3 py-2 text-[10px] font-mono text-white uppercase tracking-wider focus:border-accent-violet outline-none"
          >
            <option value="">All Severity</option>
            {RISK_LEVELS.filter(Boolean).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            type="text"
            value={filterCameraId}
            onChange={(e) => setFilterCameraId(e.target.value)}
            placeholder="Camera ID"
            className="bg-black border border-white/20 px-3 py-2 text-[10px] font-mono text-white placeholder:text-text-secondary focus:border-accent-violet outline-none w-[180px]"
          />

          <button
            onClick={() => { setFilterType(''); setFilterSeverity(''); setFilterCameraId(''); }}
            className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-text-secondary border border-white/10 hover:text-white hover:border-white/30 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Alert list */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[900px] mx-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold animate-pulse">
                  Loading alerts...
                </span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border border-dashed border-white/20">
                <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">
                  No alerts found
                </span>
              </div>
            ) : (
              <>
                {alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => { setSelectedAlert(alert); setActionText(alert.actionTaken || ''); }}
                    className={`cursor-pointer border p-4 transition-all hover:bg-white/5 ${
                      selectedAlert?.id === alert.id ? 'border-accent-violet bg-accent-violet/5' :
                      alert.resolved ? 'border-white/10 opacity-60' : 'border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{ALERT_TYPE_EMOJI[alert.type as AlertType] || '⚠️'}</span>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                          {ALERT_TYPE_LABEL[alert.type as AlertType] || alert.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {alert.zone && (
                          <Badge variant="default" className="text-[8px] bg-alert-red/10 text-alert-red border-alert-red/20">
                            {alert.zone}
                          </Badge>
                        )}
                        <div
                          className="w-2 h-2"
                          style={{ backgroundColor: SEVERITY_COLOR[alert.severity as keyof typeof SEVERITY_COLOR] || '#888' }}
                        />
                        {alert.resolved && (
                          <span className="text-[8px] uppercase tracking-wider text-online-green bg-online-green/10 px-2 py-0.5 font-bold">
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-text-secondary mb-2">{alert.description}</p>
                    <div className="flex items-center gap-4 text-[8px] uppercase tracking-widest text-text-secondary font-bold">
                      <span>Camera: {alert.cameraId?.slice(0, 8)}</span>
                      {alert.confidence && <span>Conf: {(alert.confidence * 100).toFixed(0)}%</span>}
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </motion.div>
                ))}

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchAlerts(pagination.page - 1)}
                    className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold border border-white/20 hover:bg-white/5 disabled:opacity-30 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-[10px] text-text-secondary font-bold px-4">
                    Page {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchAlerts(pagination.page + 1)}
                    className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold border border-white/20 hover:bg-white/5 disabled:opacity-30 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {selectedAlert && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="w-[380px] border-l border-white/20 bg-black/95 flex flex-col h-[calc(100vh-130px)] overflow-y-auto shrink-0"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-accent-violet font-bold">
                  Alert Detail
                </span>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-[10px] text-text-secondary hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Frame snapshot */}
                {(selectedAlert.frameSnapshot || selectedAlert.thumbnail) && (
                  <div className="relative w-full aspect-video bg-black border border-white/10 overflow-hidden">
                    <img
                      src={`data:image/jpeg;base64,${selectedAlert.frameSnapshot || selectedAlert.thumbnail}`}
                      className="w-full h-full object-cover"
                      alt="Detection frame"
                    />
                    {/* Bounding box overlay */}
                    {selectedAlert.boundingBox && (
                      <div
                        className="absolute border-2 border-alert-red"
                        style={{
                          left: `${(selectedAlert.boundingBox.x / 640) * 100}%`,
                          top: `${(selectedAlert.boundingBox.y / 480) * 100}%`,
                          width: `${(selectedAlert.boundingBox.w / 640) * 100}%`,
                          height: `${(selectedAlert.boundingBox.h / 480) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Details */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Type</span>
                    <span className="text-[12px] font-bold text-white">
                      {ALERT_TYPE_EMOJI[selectedAlert.type as AlertType]} {ALERT_TYPE_LABEL[selectedAlert.type as AlertType] || selectedAlert.type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Severity</span>
                      <div className="w-3 h-3" style={{ backgroundColor: SEVERITY_COLOR[selectedAlert.severity as keyof typeof SEVERITY_COLOR] }} />
                    </div>
                    <div>
                      <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Camera</span>
                      <span className="text-[10px] text-white font-mono">{selectedAlert.cameraId}</span>
                    </div>
                    {selectedAlert.zone && (
                      <div>
                        <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Zone</span>
                        <span className="text-[10px] text-alert-red font-bold">{selectedAlert.zone}</span>
                      </div>
                    )}
                    {selectedAlert.detectedClass && (
                      <div>
                        <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Class</span>
                        <span className="text-[10px] text-white">{selectedAlert.detectedClass}</span>
                      </div>
                    )}
                    {selectedAlert.confidence && (
                      <div>
                        <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Confidence</span>
                        <span className="text-[10px] text-white">{(selectedAlert.confidence * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold block mb-1">Timestamp</span>
                    <span className="text-[10px] text-white font-mono">{new Date(selectedAlert.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Resolve section */}
                {!selectedAlert.resolved ? (
                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <span className="text-[9px] uppercase tracking-widest text-accent-violet font-bold">Resolve Alert</span>
                    <textarea
                      value={actionText}
                      onChange={(e) => setActionText(e.target.value)}
                      placeholder="Action taken (e.g. Security dispatched, false alarm)..."
                      className="w-full bg-black border border-white/20 p-3 text-[11px] font-mono text-white placeholder:text-text-secondary focus:border-accent-violet outline-none resize-none h-20"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleResolve}
                      loading={resolving}
                      className="w-full"
                    >
                      Mark Resolved
                    </Button>
                  </div>
                ) : (
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-online-green" />
                      <span className="text-[9px] uppercase tracking-widest text-online-green font-bold">Resolved</span>
                    </div>
                    {selectedAlert.actionTaken && (
                      <p className="text-[10px] text-text-secondary bg-white/5 p-3 border border-white/10">
                        {selectedAlert.actionTaken}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
