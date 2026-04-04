'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDetectionStore } from '@/stores/detectionStore';

// Web Audio API alarm generator
class AlarmAudio {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private intervalId: NodeJS.Timer | null = null;

  start(tone: 'high' | 'low' = 'high') {
    if (this.isPlaying) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
    this.gainNode.gain.value = 0.3;

    const freq = tone === 'high' ? 880 : 440;
    let toggle = false;

    // Alternating siren effect
    this.intervalId = setInterval(() => {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
      }
      this.oscillator = this.ctx!.createOscillator();
      this.oscillator.type = 'square';
      this.oscillator.frequency.value = toggle ? freq : freq * 1.5;
      this.oscillator.connect(this.gainNode!);
      this.oscillator.start();
      toggle = !toggle;
    }, 500);

    this.isPlaying = true;
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId as unknown as number);
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
    }
    if (this.ctx) this.ctx.close();
    this.oscillator = null;
    this.ctx = null;
    this.gainNode = null;
    this.isPlaying = false;
  }

  get playing() {
    return this.isPlaying;
  }
}

const alarmAudio = new AlarmAudio();

const ALARM_MODES = [
  { value: 'always_on', label: 'Always On', desc: 'Alarm for every detection' },
  { value: 'user_choice', label: 'User Choice', desc: 'Alarm only on RED alerts' },
  { value: 'always_off', label: 'Always Off', desc: 'No alarm audio' },
] as const;

export default function AlarmControl() {
  const alarmState = useDetectionStore(state => state.alarmState);
  const clearAlarm = useDetectionStore(state => state.clearAlarm);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [alarmModes, setAlarmModes] = useState<Record<string, string>>({});
  const [savingMode, setSavingMode] = useState<string | null>(null);

  // Active alarms
  const activeAlarms = Array.from(alarmState.entries()).filter(([_, s]) => s.active);
  const hasActiveAlarm = activeAlarms.length > 0;

  useEffect(() => {
    if (hasActiveAlarm && !muted) {
      const tone = activeAlarms[0]?.[1]?.tone || 'high';
      alarmAudio.start(tone);
    } else {
      alarmAudio.stop();
    }

    return () => alarmAudio.stop();
  }, [hasActiveAlarm, muted]);

  const dismissAll = () => {
    activeAlarms.forEach(([camId]) => clearAlarm(camId));
    alarmAudio.stop();
  };

  const updateAlarmMode = async (cameraId: string, mode: string) => {
    setSavingMode(cameraId);
    try {
      const res = await fetch(`/api/cameras/${cameraId}/alarm-mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmMode: mode }),
      });
      if (res.ok) {
        setAlarmModes(prev => ({ ...prev, [cameraId]: mode }));
      }
    } catch (err) {
      console.error('[AlarmControl] Failed to update alarm mode:', err);
    } finally {
      setSavingMode(null);
    }
  };

  if (!hasActiveAlarm && !showSettings) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      {/* Active alarm panel */}
      {hasActiveAlarm && (
        <div className="bg-black border-2 border-alert-red animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]">
          <div className="px-4 py-3 border-b border-alert-red/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-alert-red animate-ping" />
              <span className="text-[11px] uppercase tracking-widest font-bold text-alert-red">
                ⚠ Security Alert
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-text-secondary font-mono">
                {activeAlarms.length} active
              </span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                title="Alarm settings"
                className="text-[9px] text-text-secondary hover:text-white px-1.5 py-0.5 border border-white/20 hover:border-white/40 transition-colors"
              >
                ⚙
              </button>
            </div>
          </div>

          <div className="px-4 py-3 space-y-2 max-h-[200px] overflow-y-auto">
            {activeAlarms.map(([camId, state]) => (
              <div key={camId} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-alert-red rounded-full animate-pulse" />
                  <span className="text-[10px] font-mono text-white font-bold uppercase tracking-wider">
                    Cam {camId.slice(0, 8)}
                  </span>
                </div>
                <span className="text-[9px] text-alert-red font-bold uppercase">
                  {state.tone === 'high' ? 'CRITICAL' : 'WARNING'}
                </span>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-alert-red/30 flex gap-2">
            <button
              onClick={() => setMuted(!muted)}
              className="flex-1 px-3 py-1.5 text-[9px] uppercase tracking-widest font-bold bg-black border border-white/20 text-white hover:bg-white/10 transition-colors"
            >
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            <button
              onClick={dismissAll}
              className="flex-1 px-3 py-1.5 text-[9px] uppercase tracking-widest font-bold bg-alert-red text-black hover:bg-red-400 transition-colors"
            >
              Dismiss All
            </button>
          </div>
        </div>
      )}

      {/* Alarm mode settings panel */}
      {showSettings && (
        <div className="bg-black border border-white/20 shadow-lg">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-accent-violet font-bold">
              Alarm Mode Settings
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-[10px] text-text-secondary hover:text-white px-1"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-3 max-h-[250px] overflow-y-auto">
            {activeAlarms.length > 0 ? (
              activeAlarms.map(([camId]) => (
                <div key={camId} className="border border-white/10 p-3 space-y-2">
                  <span className="text-[9px] font-mono text-text-secondary uppercase tracking-widest font-bold">
                    Cam {camId.slice(0, 12)}
                  </span>
                  <div className="flex gap-1">
                    {ALARM_MODES.map(mode => {
                      const current = alarmModes[camId] || 'user_choice';
                      return (
                        <button
                          key={mode.value}
                          onClick={() => updateAlarmMode(camId, mode.value)}
                          disabled={savingMode === camId}
                          title={mode.desc}
                          className={`flex-1 px-2 py-1.5 text-[8px] uppercase tracking-wider font-bold border transition-colors ${
                            current === mode.value
                              ? mode.value === 'always_on' ? 'bg-alert-red/20 border-alert-red text-alert-red'
                              : mode.value === 'always_off' ? 'bg-white/10 border-white/40 text-white/60'
                              : 'bg-accent-violet/20 border-accent-violet text-accent-violet'
                              : 'border-white/10 text-text-secondary hover:border-white/30'
                          } disabled:opacity-50`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <span className="text-[10px] text-text-secondary">
                No active cameras to configure
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
