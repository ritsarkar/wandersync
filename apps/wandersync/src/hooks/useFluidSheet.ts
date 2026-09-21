import { useState, useRef, useCallback, useEffect } from 'react';

export type SheetDetent = 'peek' | 'half' | 'full';

interface FluidSheetOptions {
  peekHeight?: number;       // default: 76px
  halfRatio?: number;        // default: 0.46 of viewport
  fullRatio?: number;        // default: 0.88 of viewport
  initialDetent?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
}

export function useFluidSheet(options: FluidSheetOptions = {}) {
  const {
    peekHeight = 76,
    halfRatio = 0.46,
    fullRatio = 0.88,
    initialDetent = 'peek',
    onDetentChange,
  } = options;

  const [detent, setDetent] = useState<SheetDetent>(initialDetent);
  const [currentHeight, setCurrentHeight] = useState<number>(peekHeight);
  const [isDragging, setIsDragging] = useState(false);

  // References for live tracking without re-render delays
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(peekHeight);
  const historyRef = useRef<{ y: number; time: number }[]>([]);

  // Compute heights based on window size
  const getDetentHeights = useCallback(() => {
    const vh = window.innerHeight;
    return {
      peek: peekHeight,
      half: Math.round(vh * halfRatio),
      full: Math.round(vh * fullRatio),
    };
  }, [peekHeight, halfRatio, fullRatio]);

  // Sync initial and resize heights
  useEffect(() => {
    const heights = getDetentHeights();
    setCurrentHeight(heights[detent]);
  }, [detent, getDetentHeights]);

  // Apple Rubber-Banding Formula (WWDC Designing Fluid Interfaces)
  const rubberband = (overshoot: number, dimension: number, constant = 0.55): number => {
    return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
  };

  // Apple Momentum Projection Formula (WWDC Designing Fluid Interfaces)
  const projectMomentum = (velocityPxPerSec: number, decelerationRate = 0.998): number => {
    return (velocityPxPerSec / 1000) * decelerationRate / (1 - decelerationRate);
  };

  // Handle pointer down on drag handle / peek bar
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Don't drag if clicking interactive buttons or inputs inside header
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('a')) {
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      setIsDragging(true);

      startYRef.current = e.clientY;
      // Read current live presentation height
      if (sheetRef.current) {
        const rect = sheetRef.current.getBoundingClientRect();
        startHeightRef.current = rect.height;
      } else {
        startHeightRef.current = currentHeight;
      }

      historyRef.current = [{ y: e.clientY, time: performance.now() }];
    },
    [currentHeight]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;

      const heights = getDetentHeights();
      const deltaY = startYRef.current - e.clientY; // pulling up increases height
      let rawHeight = startHeightRef.current + deltaY;

      // Track velocity history (keep last 100ms)
      const now = performance.now();
      historyRef.current.push({ y: e.clientY, time: now });
      if (historyRef.current.length > 8) {
        historyRef.current.shift();
      }

      // Apply rubber-banding at bounds
      if (rawHeight < heights.peek) {
        const overshoot = rawHeight - heights.peek;
        rawHeight = heights.peek + rubberband(overshoot, heights.peek);
      } else if (rawHeight > heights.full) {
        const overshoot = rawHeight - heights.full;
        rawHeight = heights.full + rubberband(overshoot, heights.full);
      }

      setCurrentHeight(Math.max(20, Math.round(rawHeight)));
    },
    [getDetentHeights]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}

      // Calculate release velocity in px/sec
      let releaseVelocity = 0;
      const history = historyRef.current;
      if (history.length >= 2) {
        const first = history[0];
        const last = history[history.length - 1];
        const dt = (last.time - first.time) / 1000;
        if (dt > 0.01) {
          // Negative clientY delta means moving up -> positive upward velocity
          releaseVelocity = (first.y - last.y) / dt;
        }
      }

      const heights = getDetentHeights();
      // Project final landing point using Apple's exponential decay
      const projectedDelta = projectMomentum(releaseVelocity);
      const projectedHeight = currentHeight + projectedDelta;

      // Determine best target detent
      let targetDetent: SheetDetent = 'peek';

      // If user flicked strongly in a direction (> 500 px/s), bias to next detent
      if (releaseVelocity > 500) {
        if (detent === 'peek') targetDetent = 'half';
        else targetDetent = 'full';
      } else if (releaseVelocity < -500) {
        if (detent === 'full') targetDetent = 'half';
        else targetDetent = 'peek';
      } else {
        // Snap to nearest detent based on projected endpoint
        const distToPeek = Math.abs(projectedHeight - heights.peek);
        const distToHalf = Math.abs(projectedHeight - heights.half);
        const distToFull = Math.abs(projectedHeight - heights.full);

        if (distToPeek <= distToHalf && distToPeek <= distToFull) {
          targetDetent = 'peek';
        } else if (distToHalf <= distToFull) {
          targetDetent = 'half';
        } else {
          targetDetent = 'full';
        }
      }

      setDetent(targetDetent);
      setCurrentHeight(heights[targetDetent]);
      if (onDetentChange) {
        onDetentChange(targetDetent);
      }
    },
    [currentHeight, detent, getDetentHeights, onDetentChange]
  );

  const snapTo = useCallback(
    (newDetent: SheetDetent) => {
      const heights = getDetentHeights();
      setDetent(newDetent);
      setCurrentHeight(heights[newDetent]);
      if (onDetentChange) {
        onDetentChange(newDetent);
      }
    },
    [getDetentHeights, onDetentChange]
  );

  return {
    detent,
    currentHeight,
    isDragging,
    sheetRef,
    snapTo,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
