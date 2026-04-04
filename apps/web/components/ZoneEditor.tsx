'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface RestrictedZone {
  label: string;
  polygon: number[][];
  isFullFrame: boolean;
}

interface ZoneEditorProps {
  cameraId: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  initialZones?: RestrictedZone[];
  onSave?: (zones: RestrictedZone[]) => void;
}

export default function ZoneEditor({ cameraId, videoRef, initialZones = [], onSave }: ZoneEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zones, setZones] = useState<RestrictedZone[]>(initialZones);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newZoneLabel, setNewZoneLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingZoneIdx, setEditingZoneIdx] = useState<number | null>(null);

  // Render zones on canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing zones
    zones.forEach((zone, idx) => {
      if (zone.isFullFrame) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        ctx.setLineDash([]);
      } else if (zone.polygon.length > 0) {
        // Draw polygon fill
        ctx.beginPath();
        ctx.moveTo(zone.polygon[0][0], zone.polygon[0][1]);
        zone.polygon.forEach(([x, y], i) => {
          if (i > 0) ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = editingZoneIdx === idx ? 'rgba(192, 132, 252, 0.25)' : 'rgba(239, 68, 68, 0.2)';
        ctx.fill();
        ctx.strokeStyle = editingZoneIdx === idx ? '#C084FC' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw vertices
        zone.polygon.forEach(([x, y]) => {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - 3, y - 3, 6, 6);
          ctx.strokeStyle = '#ef4444';
          ctx.strokeRect(x - 3, y - 3, 6, 6);
        });
      }

      // Zone label
      if (zone.polygon.length > 0) {
        const cx = zone.polygon.reduce((s, p) => s + p[0], 0) / zone.polygon.length;
        const cy = zone.polygon.reduce((s, p) => s + p[1], 0) / zone.polygon.length;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#000';
        const text = zone.label || `Zone ${idx + 1}`;
        const tw = ctx.measureText(text).width;
        ctx.fillRect(cx - tw / 2 - 4, cy - 8, tw + 8, 16);
        ctx.fillStyle = '#ef4444';
        ctx.fillText(text, cx - tw / 2, cy + 4);
      }
    });

    // Draw current polygon being drawn
    if (currentPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentPoints[0][0], currentPoints[0][1]);
      currentPoints.forEach(([x, y], i) => {
        if (i > 0) ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw vertices
      currentPoints.forEach(([x, y], i) => {
        ctx.fillStyle = i === 0 ? '#C084FC' : '#fff';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.strokeStyle = '#C084FC';
        ctx.strokeRect(x - 4, y - 4, 8, 8);
      });

      // "Click first point to close" hint
      if (currentPoints.length >= 3) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#C084FC';
        ctx.fillText('Click first point to close', currentPoints[0][0] + 10, currentPoints[0][1] - 10);
      }
    }
  }, [zones, currentPoints, editingZoneIdx]);

  useEffect(() => {
    renderCanvas();
    const interval = setInterval(renderCanvas, 500);
    return () => clearInterval(interval);
  }, [renderCanvas]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking near first point to close polygon
    if (currentPoints.length >= 3) {
      const [fx, fy] = currentPoints[0];
      if (Math.abs(x - fx) < 15 && Math.abs(y - fy) < 15) {
        // Close polygon
        const label = newZoneLabel || `Zone ${zones.length + 1}`;
        setZones(prev => [...prev, { label, polygon: currentPoints, isFullFrame: false }]);
        setCurrentPoints([]);
        setIsDrawing(false);
        setNewZoneLabel('');
        return;
      }
    }

    setCurrentPoints(prev => [...prev, [x, y]]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cameras/${cameraId}/zones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones }),
      });
      if (res.ok) {
        onSave?.(zones);
      }
    } catch (err) {
      console.error('Failed to save zones:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteZone = (idx: number) => {
    setZones(prev => prev.filter((_, i) => i !== idx));
  };

  const addFullFrame = () => {
    const label = newZoneLabel || `Zone ${zones.length + 1}`;
    setZones(prev => [...prev, { label, polygon: [], isFullFrame: true }]);
    setNewZoneLabel('');
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Canvas Overlay */}
      <div ref={containerRef} className="relative w-full aspect-video bg-black border border-white/20 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair z-10"
          onClick={handleCanvasClick}
        />
        {/* Instructions */}
        {isDrawing && (
          <div className="absolute top-2 left-2 z-20 bg-black/80 border border-accent-violet/50 px-3 py-1.5">
            <span className="text-[9px] uppercase tracking-widest text-accent-violet font-bold">
              Click to place vertices • Close by clicking first point
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* Label input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newZoneLabel}
            onChange={(e) => setNewZoneLabel(e.target.value)}
            placeholder="Zone label (e.g. Entry Gate)"
            className="flex-1 bg-black border border-white/20 px-3 py-2 text-[12px] font-mono text-white placeholder:text-text-secondary focus:border-accent-violet outline-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => { setIsDrawing(!isDrawing); setCurrentPoints([]); }}
            className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold border transition-colors ${
              isDrawing
                ? 'bg-accent-violet text-black border-accent-violet'
                : 'bg-black text-white border-white/20 hover:border-accent-violet'
            }`}
          >
            {isDrawing ? '✕ Cancel Drawing' : '◇ Draw Polygon'}
          </button>
          <button
            onClick={addFullFrame}
            className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold bg-black text-white border border-white/20 hover:border-accent-violet transition-colors"
          >
            ▣ Full Frame Zone
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-[10px] uppercase tracking-widest font-bold bg-white text-black border border-white hover:bg-gray-200 transition-colors disabled:opacity-50 ml-auto"
          >
            {saving ? 'Saving...' : '↑ Save Zones'}
          </button>
        </div>

        {/* Zone list */}
        {zones.length > 0 && (
          <div className="border border-white/10 bg-black">
            <div className="px-3 py-2 border-b border-white/10">
              <span className="text-[9px] uppercase tracking-widest text-text-secondary font-bold">
                Restricted Zones ({zones.length})
              </span>
            </div>
            {zones.map((zone, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 border-b border-white/10 last:border-0 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-alert-red/30 border border-alert-red" />
                  <span className="text-[11px] font-mono font-bold text-white">
                    {zone.label}
                  </span>
                  <span className="text-[9px] text-text-secondary uppercase tracking-wider">
                    {zone.isFullFrame ? 'Full Frame' : `${zone.polygon.length} pts`}
                  </span>
                </div>
                <button
                  onClick={() => deleteZone(idx)}
                  className="text-[9px] uppercase tracking-widest text-alert-red hover:text-white font-bold px-2 py-1 border border-alert-red/30 hover:bg-alert-red/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
