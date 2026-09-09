"use client";

import { Canvas } from "@react-three/fiber";
import { CAMERA_DISTANCE, ParticleSphere } from "./particle-sphere";

interface JarvisOrbProps {
  warningCount: number;
}

// The orb shrinks as warnings appear - a clear day fills the screen, five
// warnings and it's a small mark at the top (build spec §5). This is the
// only status surface: no spinners, no "thinking..." text anywhere.
function scaleForWarnings(count: number): number {
  if (count <= 0) return 1;
  return Math.max(0.35, 1 - count * 0.13);
}

export function JarvisOrb({ warningCount }: JarvisOrbProps) {
  const scale = scaleForWarnings(warningCount);

  return (
    <div
      data-jarvis-orb
      className="mx-auto aspect-square w-full max-w-sm transition-[max-width] duration-700 ease-out"
      style={{ maxWidth: `${Math.max(140, 384 * scale)}px` }}
    >
      <Canvas
        camera={{ position: [0, 0, CAMERA_DISTANCE], fov: 40 }}
        // The particles are additively blended, so the canvas itself stays
        // transparent and lets the page background show through.
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <ParticleSphere />
      </Canvas>
    </div>
  );
}
