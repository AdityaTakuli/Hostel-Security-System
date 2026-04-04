'use client';

import { useDetectionStore } from '@/stores/detectionStore';

interface DetectionOverlayProps {
  cameraId: string;
  width?: number;
  height?: number;
}

// Color scheme for different detection classes
const CLASS_COLORS: Record<string, string> = {
  person: '#4ADE80',
  dog: '#FBBF24',
  cat: '#FBBF24',
  bird: '#FBBF24',
  cow: '#FBBF24',
  horse: '#FBBF24',
  monkey: '#FBBF24',
  knife: '#F87171',
  scissors: '#F87171',
  'baseball bat': '#F87171',
  fire: '#F87171',
  smoke: '#F87171',
  bottle: '#60A5FA',
  cup: '#60A5FA',
  pizza: '#60A5FA',
};

function getColor(cls: string): string {
  return CLASS_COLORS[cls.toLowerCase()] || '#C084FC';
}

export default function DetectionOverlay({ cameraId, width = 640, height = 480 }: DetectionOverlayProps) {
  const detectionBoxes = useDetectionStore(state => state.detectionBoxes);
  const showOverlay = useDetectionStore(state => state.showOverlay);

  const boxes = detectionBoxes.get(cameraId) || [];

  if (!showOverlay || boxes.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full z-[5] pointer-events-none"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {boxes.map((box, i) => {
        const [x1, y1, x2, y2] = box.xyxy;
        const color = getColor(box.cls);
        const w = x2 - x1;
        const h = y2 - y1;

        return (
          <g key={`${box.id}-${i}`}>
            {/* Bounding box */}
            <rect
              x={x1}
              y={y1}
              width={w}
              height={h}
              fill="none"
              stroke={color}
              strokeWidth="2"
              opacity="0.9"
            />
            {/* Corner markers for brutalist feel */}
            <line x1={x1} y1={y1} x2={x1 + 10} y2={y1} stroke={color} strokeWidth="3" />
            <line x1={x1} y1={y1} x2={x1} y2={y1 + 10} stroke={color} strokeWidth="3" />
            <line x1={x2} y1={y1} x2={x2 - 10} y2={y1} stroke={color} strokeWidth="3" />
            <line x1={x2} y1={y1} x2={x2} y2={y1 + 10} stroke={color} strokeWidth="3" />
            <line x1={x1} y1={y2} x2={x1 + 10} y2={y2} stroke={color} strokeWidth="3" />
            <line x1={x1} y1={y2} x2={x1} y2={y2 - 10} stroke={color} strokeWidth="3" />
            <line x1={x2} y1={y2} x2={x2 - 10} y2={y2} stroke={color} strokeWidth="3" />
            <line x1={x2} y1={y2} x2={x2} y2={y2 - 10} stroke={color} strokeWidth="3" />
            {/* Label background */}
            <rect
              x={x1}
              y={y1 - 18}
              width={Math.max(box.cls.length * 7 + 40, 60)}
              height={18}
              fill={color}
              opacity="0.9"
            />
            {/* Label text */}
            <text
              x={x1 + 4}
              y={y1 - 5}
              fill="#000"
              fontSize="11"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {box.cls.toUpperCase()} {(box.conf * 100).toFixed(0)}%
            </text>
            {/* Zone indicator */}
            {box.zone && (
              <>
                <rect
                  x={x1}
                  y={y2 + 2}
                  width={box.zone.length * 7 + 8}
                  height={14}
                  fill="#ef4444"
                  opacity="0.9"
                />
                <text
                  x={x1 + 4}
                  y={y2 + 13}
                  fill="#fff"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  ⚠ {box.zone}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
