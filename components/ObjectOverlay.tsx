import React, { useEffect, useRef } from 'react';
import { BoundingBox } from '../types';

interface ObjectOverlayProps {
  objects: BoundingBox[];
  width: number;
  height: number;
  isBuildMode?: boolean;
  className?: string;
}

const ObjectOverlay: React.FC<ObjectOverlayProps> = ({ objects, width, height, isBuildMode, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw Build Mode HUD Indicator
      if (isBuildMode) {
        const badgeW = 200; // Wider for French text
        const badgeH = 40;
        const x = width / 2 - badgeW / 2; // Center top
        const y = 20;

        ctx.save();
        
        // Pulse Animation Calculation
        const time = Date.now() / 600; 
        const pulse = (Math.sin(time) + 1) / 2; // Normalize to 0-1 range
        
        // Dynamic Glow effect
        ctx.shadowColor = `rgba(59, 130, 246, ${0.6 + (pulse * 0.4)})`;
        ctx.shadowBlur = 15 + (pulse * 15);

        // Background
        ctx.fillStyle = 'rgba(30, 58, 138, 0.9)'; // Dark Blue
        ctx.beginPath();
        const r = 8;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + badgeW - r, y);
        ctx.quadraticCurveTo(x + badgeW, y, x + badgeW, y + r);
        ctx.lineTo(x + badgeW, y + badgeH - r);
        ctx.quadraticCurveTo(x + badgeW, y + badgeH, x + badgeW - r, y + badgeH);
        ctx.lineTo(x + r, y + badgeH);
        ctx.quadraticCurveTo(x, y + badgeH, x, y + badgeH - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();

        // Border
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.7 + (pulse * 0.3)})`;
        ctx.stroke();

        ctx.shadowBlur = 0; 

        // Icon
        ctx.fillStyle = '#93C5FD';
        ctx.fillRect(x + 20, y + 10, 6, 20);
        ctx.fillRect(x + 14, y + 10, 18, 8);

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText("MODE CONSTRUCTION", x + 45, y + 26);

        ctx.restore();
      }

      objects.forEach((obj) => {
        // Normalize from 0-1000 to pixels
        const x = (obj.xmin / 1000) * width;
        const y = (obj.ymin / 1000) * height;
        const w = ((obj.xmax - obj.xmin) / 1000) * width;
        const h = ((obj.ymax - obj.ymin) / 1000) * height;

        const color = getBoxColor(obj.label);
        // Default confidence high if not provided
        const confidence = obj.confidence ?? 0.85; 

        // Draw Halo (Shadow)
        ctx.save();
        ctx.shadowColor = color;
        // Blur radius increases with confidence to show a stronger 'lock'
        // Base blur 10px + up to 25px extra
        ctx.shadowBlur = 10 + (25 * confidence); 
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();

        // Draw Label Background
        ctx.fillStyle = color;
        const text = obj.label.toUpperCase();
        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(text).width;
        
        // Ensure label stays within bounds vertically
        const labelY = y - 24 > 0 ? y - 24 : y;
        
        ctx.fillRect(x, labelY, textWidth + 10, 24);

        // Draw Label Text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x + 5, labelY + 17);
      });

      // Continue animation loop if build mode is active 
      // (Optimization: we could animate halo pulse too, but user only asked for static var based on confidence)
      if (isBuildMode) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    // Initial render
    render();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [objects, width, height, isBuildMode]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
};

// Helper for Fortnite-themed colors
const getBoxColor = (label: string): string => {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('enemy') || lowerLabel.includes('player') || lowerLabel.includes('ennemi') || lowerLabel.includes('joueur')) return '#EF4444'; // Red
  if (lowerLabel.includes('weapon') || lowerLabel.includes('arme')) return '#A855F7'; // Purple (Epic)
  if (lowerLabel.includes('ammo') || lowerLabel.includes('chest') || lowerLabel.includes('coffre')) return '#EAB308'; // Gold (Legendary)
  if (lowerLabel.includes('build') || lowerLabel.includes('wall') || lowerLabel.includes('ramp') || lowerLabel.includes('mur') || lowerLabel.includes('rampe')) return '#3B82F6'; // Blue
  return '#10B981'; // Green (Default)
};

export default ObjectOverlay;