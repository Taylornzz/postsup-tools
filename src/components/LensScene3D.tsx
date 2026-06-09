import { useEffect, useRef, useCallback } from "react";

/** Interactive 3D wireframe of what the lens numbers mean spatially.
 *  Camera at origin looking down +Z; ground plane; live view frustum; framing
 *  rectangle at the subject plane; green depth-of-field slab between near/far
 *  focus; a 1.8 m wireframe person at subject distance plus fainter reference
 *  figures behind (lens-compression cue). Drag to orbit, wheel/pinch to zoom.
 *  Hand-rolled perspective projection — no 3D library. */

export interface LensSceneProps {
  hAOV: number;     // degrees (already de-squeezed for anamorphic)
  vAOV: number;     // degrees
  distM: number;    // subject distance
  nearM: number;    // near focus
  farM: number;     // far focus (Infinity allowed)
  frameW: number;   // coverage width at subject (m)
  frameH: number;   // coverage height at subject (m)
  hyperfocalM: number;
  focal: number;
  fstop: number;
}

type V3 = [number, number, number];

const CAM_H = 1.4; // camera lens height above ground (m)

export function LensScene3D(p: LensSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ yaw: -0.62, pitch: 0.34, radius: 0, drag: false, lx: 0, ly: 0, userRadius: 0 });
  const propsRef = useRef(p);
  propsRef.current = p;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { hAOV, vAOV, distM, nearM, farM, frameW, frameH, hyperfocalM, focal, fstop } = propsRef.current;
    const v = view.current;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Scene extent — keep the subject framed whatever the distance.
    const maxZ = Math.max(distM * 1.7, 10);
    const target: V3 = [0, 0.6, Math.min(distM * 0.62, maxZ * 0.45)];
    const autoRadius = Math.max(distM * 1.25, 7);
    const radius = v.userRadius > 0 ? v.userRadius : autoRadius;
    v.radius = radius;

    const cy0 = Math.cos(v.yaw), sy0 = Math.sin(v.yaw);
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    const persp = H * 1.05;

    const project = (pt: V3): { x: number; y: number; z: number } | null => {
      let x = pt[0] - target[0], y = pt[1] - target[1], z = pt[2] - target[2];
      // yaw around Y
      const x1 = x * cy0 - z * sy0, z1 = x * sy0 + z * cy0;
      // pitch around X
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const zc = z2 + radius;
      if (zc < 0.25) return null;
      return { x: W / 2 + (x1 * persp) / zc, y: H / 2 - (y2 * persp) / zc, z: zc };
    };

    const line = (a: V3, b: V3, color: string, width = 1, dash?: number[]) => {
      const A = project(a), B = project(b);
      if (!A || !B) return;
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.setLineDash([]);
    };
    const poly = (pts: V3[], color: string, width = 1, close = true, dash?: number[]) => {
      const pr = pts.map(project);
      if (pr.some((q) => !q)) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      pr.forEach((q, i) => (i === 0 ? ctx.moveTo(q!.x, q!.y) : ctx.lineTo(q!.x, q!.y)));
      if (close) ctx.closePath();
      ctx.stroke(); ctx.setLineDash([]);
    };
    const fillPoly = (pts: V3[], color: string) => {
      const pr = pts.map(project);
      if (pr.some((q) => !q)) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      pr.forEach((q, i) => (i === 0 ? ctx.moveTo(q!.x, q!.y) : ctx.lineTo(q!.x, q!.y)));
      ctx.closePath(); ctx.fill();
    };
    const label = (pt: V3, text: string, color: string, size = 10, dx = 0, dy = 0) => {
      const A = project(pt);
      if (!A) return;
      ctx.fillStyle = color;
      ctx.font = `${size}px ui-monospace, Menlo, monospace`;
      ctx.fillText(text, A.x + dx, A.y + dy);
    };

    // ---- ground grid ----
    const gw = Math.max(3, Math.min(frameW * 0.9, 8)); // half-width of grid
    const gridStep = maxZ > 24 ? 4 : maxZ > 12 ? 2 : 1;
    for (let z = 0; z <= maxZ + 0.01; z += gridStep) {
      line([-gw, 0, z], [gw, 0, z], "rgba(120,128,145,0.16)");
    }
    for (let x = -Math.floor(gw); x <= gw; x += 1) {
      line([x, 0, 0], [x, 0, maxZ], "rgba(120,128,145,0.10)");
    }
    // centre axis + distance ticks
    line([0, 0, 0], [0, 0, maxZ], "rgba(148,163,184,0.35)", 1, [4, 4]);
    for (let z = gridStep; z <= maxZ + 0.01; z += gridStep) {
      label([0.12, 0, z], `${z}m`, "rgba(148,163,184,0.55)", 9);
    }

    // ---- camera body + lens at origin, height CAM_H ----
    const cb = 0.22; // body half-size
    const cz = -0.42;
    const bodyA: V3[] = [[-cb, CAM_H - cb, cz], [cb, CAM_H - cb, cz], [cb, CAM_H + cb, cz], [-cb, CAM_H + cb, cz]];
    const bodyB: V3[] = bodyA.map((q) => [q[0], q[1], q[2] - 0.3] as V3);
    poly(bodyA, "#94a3b8", 1.2); poly(bodyB, "#94a3b8", 1);
    bodyA.forEach((q, i) => line(q, bodyB[i], "#94a3b8"));
    // lens barrel
    line([0, CAM_H, cz], [0, CAM_H, 0], "#cbd5e1", 2);
    label([-cb, CAM_H + cb + 0.12, cz], "CAMERA", "rgba(203,213,225,0.8)", 9);

    // ---- frustum ----
    const tanH = Math.tan(((hAOV / 2) * Math.PI) / 180);
    const tanV = Math.tan(((vAOV / 2) * Math.PI) / 180);
    const rectAt = (z: number): V3[] => {
      const hw = z * tanH, hh = z * tanV;
      return [
        [-hw, CAM_H - hh, z], [hw, CAM_H - hh, z], [hw, CAM_H + hh, z], [-hw, CAM_H + hh, z],
      ];
    };
    const subj = rectAt(distM);
    const beyond = rectAt(maxZ);
    const apex: V3 = [0, CAM_H, 0];
    // to subject plane: solid cyan
    subj.forEach((q) => line(apex, q, "rgba(34,211,238,0.75)", 1.2));
    poly(subj, "#f59e0b", 1.8); // framing rectangle — amber
    fillPoly(subj, "rgba(245,158,11,0.06)");
    // beyond subject: dashed faint
    subj.forEach((q, i) => line(q, beyond[i], "rgba(34,211,238,0.25)", 1, [3, 5]));
    poly(beyond, "rgba(34,211,238,0.25)", 1, true, [3, 5]);
    const fmt = (n: number) => (n >= 10 ? n.toFixed(1) : n.toFixed(2));
    label(subj[2], `${fmt(frameW)} × ${fmt(frameH)} m`, "#f59e0b", 11, 6, -6);

    // ---- depth of field slab (green) ----
    const farClamped = Math.min(farM === Infinity ? maxZ : farM, maxZ);
    const nearClamped = Math.max(Math.min(nearM, maxZ), 0.01);
    if (farClamped > nearClamped) {
      const nr = rectAt(nearClamped), fr = rectAt(farClamped);
      fillPoly(nr, "rgba(52,211,153,0.10)");
      fillPoly(fr, "rgba(52,211,153,0.08)");
      poly(nr, "rgba(52,211,153,0.9)", 1.4);
      poly(fr, farM === Infinity ? "rgba(52,211,153,0.5)" : "rgba(52,211,153,0.9)", 1.4, true, farM === Infinity ? [4, 4] : undefined);
      nr.forEach((q, i) => line(q, fr[i], "rgba(52,211,153,0.45)", 1));
      // ground footprint of the slab
      const nw = nearClamped * tanH, fw = farClamped * tanH;
      fillPoly([[-nw, 0.005, nearClamped], [nw, 0.005, nearClamped], [fw, 0.005, farClamped], [-fw, 0.005, farClamped]], "rgba(52,211,153,0.10)");
      label([nr[1][0], 0.1, nearClamped], `near ${fmt(nearM)}m`, "#34d399", 10, 6, 0);
      label([fr[1][0], 0.1, farClamped], farM === Infinity ? "far ∞" : `far ${fmt(farM)}m`, "#34d399", 10, 6, 0);
    }

    // ---- focus plane tick on ground + hyperfocal marker ----
    line([-gw, 0.005, distM], [gw, 0.005, distM], "rgba(245,158,11,0.5)", 1, [6, 4]);
    if (hyperfocalM <= maxZ) {
      line([-gw * 0.5, 0.005, hyperfocalM], [gw * 0.5, 0.005, hyperfocalM], "rgba(167,139,250,0.55)", 1, [2, 4]);
      label([gw * 0.5, 0.1, hyperfocalM], `hyperfocal ${fmt(hyperfocalM)}m`, "rgba(167,139,250,0.85)", 9, 4);
    }

    // ---- wireframe people: subject + compression references ----
    const person = (z: number, color: string, width = 1.2) => {
      const h = 1.8, head = 0.13;
      const hipY = h * 0.5, shY = h * 0.82, headY = h - head;
      line([0, 0, z], [0, hipY, z], color, width);                       // legs joined→hip (centre)
      line([-0.16, 0, z], [0, hipY, z], color, width);                   // left leg
      line([0.16, 0, z], [0, hipY, z], color, width);                    // right leg
      line([0, hipY, z], [0, shY, z], color, width);                     // torso
      line([-0.3, hipY + 0.42, z], [0, shY, z], color, width);           // left arm
      line([0.3, hipY + 0.42, z], [0, shY, z], color, width);            // right arm
      // head circle (octagon)
      const seg = 8;
      for (let i = 0; i < seg; i++) {
        const a1 = (i / seg) * Math.PI * 2, a2 = ((i + 1) / seg) * Math.PI * 2;
        line([Math.cos(a1) * head, headY + head + Math.sin(a1) * head, z], [Math.cos(a2) * head, headY + head + Math.sin(a2) * head, z], color, width);
      }
    };
    person(distM, "#e2e8f0", 1.5);
    label([0.32, 1.85, distM], `subject @ ${fmt(distM)}m`, "rgba(226,232,240,0.85)", 10);
    if (distM + 3 <= maxZ) person(distM + 3, "rgba(148,163,184,0.4)");
    if (distM + 7 <= maxZ) person(distM + 7, "rgba(148,163,184,0.25)");

    // ---- HUD ----
    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillText(`${focal}mm · f/${fstop} · ${fmt(distM)}m  —  AOV ${hAOV.toFixed(1)}°×${vAOV.toFixed(1)}°`, 10, 16);
    ctx.fillStyle = "rgba(100,110,130,0.7)";
    ctx.fillText("drag to orbit · wheel to zoom", 10, H - 8);
  }, []);

  // redraw on prop change
  useEffect(() => { draw(); }, [draw, p.hAOV, p.vAOV, p.distM, p.nearM, p.farM, p.frameW, p.frameH, p.hyperfocalM, p.focal, p.fstop]);

  // resize observer
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    return () => ro.disconnect();
  }, [draw]);

  // orbit interaction
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const v = view.current;
    const down = (e: PointerEvent) => { v.drag = true; v.lx = e.clientX; v.ly = e.clientY; c.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!v.drag) return;
      v.yaw += (e.clientX - v.lx) * 0.008;
      v.pitch = Math.max(0.05, Math.min(1.35, v.pitch + (e.clientY - v.ly) * 0.006));
      v.lx = e.clientX; v.ly = e.clientY;
      draw();
    };
    const up = () => { v.drag = false; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = (v.userRadius > 0 ? v.userRadius : v.radius) * (1 + Math.sign(e.deltaY) * 0.08);
      v.userRadius = Math.max(2.5, Math.min(80, r));
      draw();
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", wheel, { passive: false });
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.removeEventListener("wheel", wheel);
    };
  }, [draw]);

  return (
    <div className="relative rounded-sm border border-suite-border bg-[#0b0c10] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-[400px] touch-none cursor-grab active:cursor-grabbing" />
      <button
        onClick={() => { view.current.yaw = -0.62; view.current.pitch = 0.34; view.current.userRadius = 0; draw(); }}
        className="absolute top-2 right-2 px-2 py-0.5 rounded-sm border border-suite-border bg-suite-bg/80 font-mono text-[9px] uppercase tracking-[0.1em] text-suite-text-dim hover:text-suite-text"
      >
        Reset view
      </button>
    </div>
  );
}
