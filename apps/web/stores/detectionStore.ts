import { create } from 'zustand';

interface DetectionBox {
  id: number;
  cls: string;
  conf: number;
  xyxy: [number, number, number, number];
  model?: string;
  zone?: string;
  event?: string;
}

interface AlarmState {
  active: boolean;
  tone: 'high' | 'low';
}

interface HeatmapEntry {
  alertCount: number;
  riskLevel: 'RED' | 'YELLOW' | 'GREEN';
}

interface DetectionState {
  // Live detection boxes per camera
  detectionBoxes: Map<string, DetectionBox[]>;
  setDetectionBoxes: (cameraId: string, boxes: DetectionBox[]) => void;
  clearDetectionBoxes: (cameraId: string) => void;

  // Alarm states per camera
  alarmState: Map<string, AlarmState>;
  setAlarm: (cameraId: string, state: AlarmState) => void;
  clearAlarm: (cameraId: string) => void;

  // Heatmap data per camera
  heatmapData: Map<string, HeatmapEntry>;
  setHeatmapData: (cameraId: string, data: HeatmapEntry) => void;
  setHeatmapBulk: (data: Array<{ cameraId: string } & HeatmapEntry>) => void;

  // Surveillance status per camera
  surveillanceStatus: Map<string, boolean>;
  setSurveillance: (cameraId: string, active: boolean) => void;

  // Detection overlay visibility
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;

  // Zone intrusion alerts
  zoneAlerts: Array<{
    cameraId: string;
    zone: string;
    cls: string;
    confidence: number;
    riskLevel: string;
    timestamp: number;
  }>;
  addZoneAlert: (alert: {
    cameraId: string;
    zone: string;
    cls: string;
    confidence: number;
    riskLevel: string;
  }) => void;
  clearZoneAlerts: () => void;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  detectionBoxes: new Map(),
  setDetectionBoxes: (cameraId, boxes) =>
    set((state) => {
      const newMap = new Map(state.detectionBoxes);
      newMap.set(cameraId, boxes);
      return { detectionBoxes: newMap };
    }),
  clearDetectionBoxes: (cameraId) =>
    set((state) => {
      const newMap = new Map(state.detectionBoxes);
      newMap.delete(cameraId);
      return { detectionBoxes: newMap };
    }),

  alarmState: new Map(),
  setAlarm: (cameraId, alarmState) =>
    set((state) => {
      const newMap = new Map(state.alarmState);
      newMap.set(cameraId, alarmState);
      return { alarmState: newMap };
    }),
  clearAlarm: (cameraId) =>
    set((state) => {
      const newMap = new Map(state.alarmState);
      newMap.delete(cameraId);
      return { alarmState: newMap };
    }),

  heatmapData: new Map(),
  setHeatmapData: (cameraId, data) =>
    set((state) => {
      const newMap = new Map(state.heatmapData);
      newMap.set(cameraId, data);
      return { heatmapData: newMap };
    }),
  setHeatmapBulk: (data) =>
    set(() => {
      const newMap = new Map<string, HeatmapEntry>();
      data.forEach((d) => newMap.set(d.cameraId, { alertCount: d.alertCount, riskLevel: d.riskLevel }));
      return { heatmapData: newMap };
    }),

  surveillanceStatus: new Map(),
  setSurveillance: (cameraId, active) =>
    set((state) => {
      const newMap = new Map(state.surveillanceStatus);
      newMap.set(cameraId, active);
      return { surveillanceStatus: newMap };
    }),

  showOverlay: true,
  setShowOverlay: (show) => set({ showOverlay: show }),

  zoneAlerts: [],
  addZoneAlert: (alert) =>
    set((state) => ({
      zoneAlerts: [
        { ...alert, timestamp: Date.now() },
        ...state.zoneAlerts,
      ].slice(0, 50),
    })),
  clearZoneAlerts: () => set({ zoneAlerts: [] }),
}));
