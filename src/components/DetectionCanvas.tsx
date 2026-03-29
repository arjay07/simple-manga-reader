'use client';

import { useEffect, useRef } from 'react';
import type { DetectionResult, Panel } from '@/lib/panel-detect/types';

export function DetectionCanvas({
  result,
  pageImage,
  imageWidth,
  imageHeight,
}: {
  result: DetectionResult;
  pageImage: string;
  imageWidth: number;
  imageHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const img = new Image();
    img.onload = () => {
      const containerWidth = container.clientWidth;
      const scale = containerWidth / imageWidth;
      const displayHeight = imageHeight * scale;

      canvas.width = containerWidth;
      canvas.height = displayHeight;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, containerWidth, displayHeight);

      const getColor = (conf: number) => {
        if (conf >= 0.7) return '#22c55e';
        if (conf >= 0.4) return '#eab308';
        return '#ef4444';
      };

      ctx.lineWidth = 3;
      ctx.font = 'bold 14px sans-serif';

      for (const panel of result.panels) {
        const x = panel.x * containerWidth;
        const y = panel.y * displayHeight;
        const w = panel.width * containerWidth;
        const h = panel.height * displayHeight;
        const color = getColor(panel.confidence);

        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = color + '15';
        ctx.fillRect(x, y, w, h);

        const labelText = `${panel.readingOrder} (${panel.confidence.toFixed(2)})`;
        const textMetrics = ctx.measureText(labelText);
        const padding = 4;
        const labelW = textMetrics.width + padding * 2;
        const labelH = 20;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, labelW, labelH);
        ctx.fillStyle = '#000';
        ctx.fillText(labelText, x + padding, y + 15);
      }
    };
    img.src = `data:image/jpeg;base64,${pageImage}`;
  }, [result, pageImage, imageWidth, imageHeight]);

  return (
    <div ref={containerRef} className="relative">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
}
