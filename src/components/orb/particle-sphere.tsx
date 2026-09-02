"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { agentHex } from "@/lib/colors";
import type { AgentId } from "@/lib/types";
import { useOrbStore } from "@/store/orb-store";

const COUNT = 2600;
const BASE_RADIUS = 0.725;

// Kept in step with the camera position set in jarvis-orb.tsx; the shader
// needs it to size particles and to place the depth-fade band.
export const CAMERA_DISTANCE = 4.2;

// The particle that carries a delegated request. Taken from the middle of
// the sequence so it sits near the equator, where it reads clearly against
// the rest of the shell rather than being lost at a pole.
const MESSENGER = Math.floor(COUNT / 2);

// Roughly where each agent's tab sits relative to centre, so a delegated
// particle visibly travels toward the tab that is about to answer.
const DELEGATE_DIRECTION: Record<AgentId, THREE.Vector3> = {
  tony: new THREE.Vector3(-2.6, -2.0, 0.6),
  lisa: new THREE.Vector3(-1.2, -2.2, 0.9),
  jarvis: new THREE.Vector3(0, 0, 0),
  vanessa: new THREE.Vector3(1.2, -2.2, 0.9),
  marco: new THREE.Vector3(2.6, -2.0, 0.6),
};

// Seeded so the shell is generated deterministically: the orb looks the
// same on every load, and building it stays a pure computation.
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// All motion is driven by uniforms rather than rewriting the position
// buffer each frame: the geometry is uploaded once and the GPU does the
// rest, which is what keeps a screen-filling orb cheap on a mid-range
// phone. A soft round dot is drawn in the fragment shader for the same
// reason - a postprocessing bloom pass would cost far more.
const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec3 aScatterDir;
  attribute float aMessenger;

  uniform float uRadius;
  uniform float uScatter;
  uniform float uMessengerT;
  uniform vec3 uMessengerTarget;
  uniform vec3 uMessengerColor;
  uniform float uPixelRatio;
  uniform float uCameraDistance;
  uniform float uShellRadius;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position * (uRadius + uScatter) + aScatterDir * uScatter * 0.35;
    p = mix(p, uMessengerTarget, aMessenger * uMessengerT);

    vColor = mix(aColor, uMessengerColor, aMessenger);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Particles on the far side of the shell dim, which is what reads as
    // volume without needing depth sorting or real transparency. View-space
    // z is negative in front of the camera, so this band is expressed
    // relative to the camera distance rather than around zero.
    float band = uShellRadius * 1.1;
    float near = -uCameraDistance + band;
    float far = -uCameraDistance - band;
    vAlpha = 0.45 + 0.55 * smoothstep(far, near, mv.z);

    // aSize is in CSS pixels at the nominal camera distance; the ratio
    // gives perspective falloff and uPixelRatio keeps the apparent size
    // consistent on high-density screens.
    gl_PointSize = aSize * uPixelRatio * (uCameraDistance / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;

    // A bright centre with a wide soft skirt. Additive blending then does
    // the rest: where the shell is seen edge-on the sprites overlap and
    // the silhouette brightens on its own, no bloom pass required.
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.5, 0.0, d);
    float a = clamp(core * 0.95 + pow(halo, 1.6) * 0.55, 0.0, 1.0);

    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export function ParticleSphere() {
  const pointsRef = useRef<THREE.Points>(null);
  const { state, delegateTarget, inputLevel } = useOrbStore();

  const jarvisColor = useMemo(() => new THREE.Color(agentHex("jarvis")), []);
  const clock = useRef(0);
  const celebrateClock = useRef(0);
  const detach = useRef(0);
  const messengerColor = useRef(new THREE.Color(agentHex("jarvis")));

  // Created once for the material's initial values. The frame loop writes
  // through `materialRef` rather than touching this object, keeping all
  // per-frame mutation on the Three.js side of the boundary.
  const initialUniforms = useMemo(
    () => ({
      uRadius: { value: 1 },
      uScatter: { value: 0 },
      uMessengerT: { value: 0 },
      uMessengerTarget: { value: new THREE.Vector3() },
      uMessengerColor: { value: new THREE.Color(agentHex("jarvis")) },
      uPixelRatio: { value: 1 },
      uCameraDistance: { value: CAMERA_DISTANCE },
      // Derived from the radius so the depth fade keeps its shape if the
      // shell is resized, instead of flattening out.
      uShellRadius: { value: BASE_RADIUS },
    }),
    [],
  );
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pixelRatio = useThree((s) => s.viewport.dpr);

  const { positions, sizes, colors, scatterDirs, messengerFlags } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const scatterDirs = new Float32Array(COUNT * 3);
    const messengerFlags = new Float32Array(COUNT);

    // Fibonacci distribution spreads points evenly over the sphere; the
    // jitter below breaks that evenness back up so the shell reads as
    // organic rather than as a woven mesh.
    const golden = Math.PI * (3 - Math.sqrt(5));
    const emerald = new THREE.Color(agentHex("jarvis"));
    const rand = seededRandom(0x5eed);

    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;

      const jitter = 0.94 + rand() * 0.12;
      const x = Math.cos(theta) * ring * jitter;
      const z = Math.sin(theta) * ring * jitter;
      const yj = y * jitter;

      positions[i * 3] = x * BASE_RADIUS;
      positions[i * 3 + 1] = yj * BASE_RADIUS;
      positions[i * 3 + 2] = z * BASE_RADIUS;

      // Each particle keeps its own outward direction, so a celebrating
      // scatter expands the shell instead of smearing it one way.
      const len = Math.hypot(x, yj, z) || 1;
      scatterDirs[i * 3] = x / len;
      scatterDirs[i * 3 + 1] = yj / len;
      scatterDirs[i * 3 + 2] = z / len;

      // Scaled with BASE_RADIUS: dots held at their old size would pack
      // into a quarter of the area and read as a solid blob rather than a
      // shell of separate particles.
      sizes[i] = 2 + rand() * 4.5;

      // Slight per-particle brightness variation at the same hue - the
      // locked chroma of the colour system still holds.
      const shade = 0.78 + rand() * 0.34;
      colors[i * 3] = emerald.r * shade;
      colors[i * 3 + 1] = emerald.g * shade;
      colors[i * 3 + 2] = emerald.b * shade;
    }

    sizes[MESSENGER] = 7.5;
    messengerFlags[MESSENGER] = 1;
    return { positions, sizes, colors, scatterDirs, messengerFlags };
  }, []);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    clock.current += delta;

    let radius = 1;
    let spin = 0.12;
    let scatter = 0;

    if (state === "thinking") {
      // Contracts inward, tighter and faster.
      radius = 0.68;
      spin = 0.75;
    } else if (state === "listening") {
      radius = 1 + inputLevel * 0.22;
      spin = 0.4;
    } else if (state === "speaking") {
      radius = 1 + Math.sin(clock.current * 9) * 0.05 * (0.4 + inputLevel);
      spin = 0.2;
    } else if (state === "celebrating") {
      // Scatter outward, then re-form.
      celebrateClock.current += delta;
      const t = Math.min(1, celebrateClock.current * 0.8);
      scatter = Math.sin(t * Math.PI) * 1.4;
      spin = 0.9;
    } else if (state === "delegating") {
      spin = 0.3;
    } else {
      // Idle: a slow turn with a gentle breath.
      radius = 1 + Math.sin(clock.current * 0.5) * 0.02;
    }

    if (state !== "celebrating") celebrateClock.current = 0;

    const uniforms = materialRef.current?.uniforms;
    if (!uniforms) return;

    if (state === "delegating" && delegateTarget) {
      detach.current = Math.min(1, detach.current + delta * 0.9);
      uniforms.uMessengerTarget.value.copy(DELEGATE_DIRECTION[delegateTarget]);
      messengerColor.current.lerp(new THREE.Color(agentHex(delegateTarget)), delta * 2.5);
    } else {
      detach.current = Math.max(0, detach.current - delta * 2);
      messengerColor.current.lerp(jarvisColor, delta * 3);
    }

    uniforms.uPixelRatio.value = pixelRatio;
    uniforms.uRadius.value = radius;
    uniforms.uScatter.value = scatter;
    uniforms.uMessengerT.value = detach.current;
    uniforms.uMessengerColor.value.copy(messengerColor.current);

    points.rotation.y += delta * spin;
    points.rotation.x = Math.sin(clock.current * 0.2) * 0.12;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aScatterDir" args={[scatterDirs, 3]} />
        <bufferAttribute attach="attributes-aMessenger" args={[messengerFlags, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={initialUniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
