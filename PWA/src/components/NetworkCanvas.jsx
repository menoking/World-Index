import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { stepForceLayout, moveParticles, hitTestNode } from '../utils/layout';

const CANVAS_W = 343;
const CANVAS_H = 380;

function getPalette(theme) {
  if (theme === 'dark') {
    return {
      background: '#191e29',
      glowA: 'rgba(231, 160, 168, 0.16)',
      glowB: 'rgba(121, 211, 181, 0.10)',
      particle: 'rgba(238, 242, 247, ',
      link: 'rgba(186, 197, 214, 0.23)',
      linkStrong: 'rgba(231, 160, 168, 0.36)',
      text: '#eef2f7',
      positive: 'rgba(239, 160, 168, 0.9)',
      negative: 'rgba(121, 211, 181, 0.86)',
      halo: 'rgba(231, 160, 168, 0.16)',
      labelBg: 'rgba(25, 30, 41, 0.58)',
    };
  }
  return {
    background: '#fffaf4',
    glowA: 'rgba(217, 107, 117, 0.12)',
    glowB: 'rgba(47, 154, 127, 0.08)',
    particle: 'rgba(36, 48, 68, ',
    link: 'rgba(86, 100, 124, 0.21)',
    linkStrong: 'rgba(217, 107, 117, 0.34)',
    text: '#243044',
    positive: 'rgba(217, 107, 117, 0.88)',
    negative: 'rgba(47, 154, 127, 0.86)',
    halo: 'rgba(217, 107, 117, 0.14)',
    labelBg: 'rgba(255, 250, 244, 0.72)',
  };
}

const NetworkCanvas = forwardRef(function NetworkCanvas({ theme, nodes, links, particles, onNodeTap }, ref) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    nodes: [], links: [], particles: [],
    viewport: { scale: 1, x: 0, y: 0 },
    touchState: null,
    rafId: null,
    theme: 'light',
    dpr: 1,
    cssW: CANVAS_W,
    cssH: CANVAS_H,
  });

  // 高 DPI 初始化
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const s = stateRef.current;
    s.dpr = dpr;

    const rect = canvas.getBoundingClientRect();
    s.cssW = rect.width;
    s.cssH = rect.height;
    canvas.width = s.cssW * dpr;
    canvas.height = s.cssH * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 居中网络内容
    s.viewport.x = (s.cssW - CANVAS_W) / 2;
    s.viewport.y = (s.cssH - CANVAS_H) / 2;
  }, []);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  useEffect(() => {
    stateRef.current.theme = theme;
  }, [theme]);

  useEffect(() => {
    stateRef.current.nodes = nodes;
  }, [nodes]);

  useEffect(() => {
    stateRef.current.links = links;
  }, [links]);

  useEffect(() => {
    stateRef.current.particles = particles;
  }, [particles]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = stateRef.current;
    const palette = getPalette(s.theme);

    stepForceLayout(s.nodes, s.links, CANVAS_W, CANVAS_H, 0.055);
    moveParticles(s.particles, CANVAS_W, CANVAS_H);

    const { scale, x: vx, y: vy } = s.viewport;
    const toScreen = (x, y) => ({ x: x * scale + vx, y: y * scale + vy });

    // background — cover full canvas logical area
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, s.cssW, s.cssH);

    ctx.beginPath();
    ctx.fillStyle = palette.glowA;
    ctx.arc(s.cssW * 0.34, s.cssH * 0.28, 116, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = palette.glowB;
    ctx.arc(s.cssW * 0.72, s.cssH * 0.7, 132, 0, Math.PI * 2);
    ctx.fill();

    // particles
    s.particles.forEach((p) => {
      const pt = toScreen(p.x, p.y);
      ctx.beginPath();
      ctx.fillStyle = `${palette.particle}${p.alpha})`;
      ctx.arc(pt.x, pt.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // links
    s.links.forEach((link) => {
      const sp = toScreen(link.source.x, link.source.y);
      const tp = toScreen(link.target.x, link.target.y);
      ctx.beginPath();
      ctx.strokeStyle = link.source.category === link.target.category ? palette.linkStrong : palette.link;
      ctx.lineWidth = (link.source.category === link.target.category ? 1.4 : 0.8) * Math.sqrt(scale);
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(tp.x, tp.y);
      ctx.stroke();
    });

    // nodes
    s.nodes.forEach((node) => {
      const positive = node.change >= 0;
      const pt = toScreen(node.x, node.y);
      const radius = Math.max(4, node.radius * Math.sqrt(scale));

      ctx.beginPath();
      ctx.fillStyle = palette.halo;
      ctx.arc(pt.x, pt.y, radius + 9 * Math.sqrt(scale), 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = positive ? palette.positive : palette.negative;
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 1.4;
      ctx.arc(pt.x, pt.y, radius + 2, 0, Math.PI * 2);
      ctx.stroke();

      // label
      const fontSize = Math.max(7, Math.min(15, Math.round((node.radius >= 16 ? 10 : node.radius >= 11 ? 8 : 7) * Math.sqrt(scale))));
      const labelWidth = Math.max(30, node.name.length * fontSize + 10);
      const labelHeight = fontSize + 8;
      const lx = pt.x - labelWidth / 2;
      const ly = pt.y + radius + 5;

      ctx.fillStyle = palette.labelBg;
      ctx.fillRect(lx, ly, labelWidth, labelHeight);
      ctx.fillStyle = palette.text;
      ctx.font = `${fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(node.name, pt.x, ly + fontSize + 2);
    });
  }, []);

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      stateRef.current.rafId = requestAnimationFrame(loop);
    };
    loop();
    return () => { running = false; };
  }, [draw]);

  useImperativeHandle(ref, () => ({
    draw,
  }), [draw]);

  const getCanvasPoint = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }, []);

  // DPR 变化时重设 canvas 分辨率
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      stateRef.current.dpr = dpr;

      const rect = canvas.parentElement.getBoundingClientRect();
      const w = rect.width || CANVAS_W;
      const h = rect.height || CANVAS_H;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getTouchDistance = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.max(1, Math.sqrt(dx * dx + dy * dy));
  };

  const handleTouchStart = useCallback((e) => {
    const s = stateRef.current;
    const touches = e.touches;
    if (touches.length >= 2) {
      const a = getCanvasPoint(touches[0].clientX, touches[0].clientY);
      const b = getCanvasPoint(touches[1].clientX, touches[1].clientY);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      s.touchState = {
        type: 'pinch',
        startDistance: getTouchDistance(a, b),
        startScale: s.viewport.scale,
        worldCenter: { x: (center.x - s.viewport.x) / s.viewport.scale, y: (center.y - s.viewport.y) / s.viewport.scale },
        center,
      };
      return;
    }

    const touch = touches[0];
    if (!touch) return;
    const pt = getCanvasPoint(touch.clientX, touch.clientY);
    const world = { x: (pt.x - s.viewport.x) / s.viewport.scale, y: (pt.y - s.viewport.y) / s.viewport.scale };
    const node = hitTestNode(s.nodes, world.x, world.y);

    if (node) {
      node.fixed = true;
      s.touchState = { type: 'node', node, moved: false, startX: pt.x, startY: pt.y, lastX: pt.x, lastY: pt.y };
    } else {
      s.touchState = { type: 'pan', moved: false, startX: pt.x, startY: pt.y, lastX: pt.x, lastY: pt.y };
    }
  }, [getCanvasPoint]);

  const handleTouchMove = useCallback((e) => {
    const s = stateRef.current;
    if (!s.touchState) return;
    const touches = e.touches;

    if (touches.length >= 2 && s.touchState.type === 'pinch') {
      const a = getCanvasPoint(touches[0].clientX, touches[0].clientY);
      const b = getCanvasPoint(touches[1].clientX, touches[1].clientY);
      const distance = getTouchDistance(a, b);
      const nextScale = Math.max(0.7, Math.min(3.2, s.touchState.startScale * (distance / s.touchState.startDistance)));
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      s.viewport.scale = nextScale;
      s.viewport.x = center.x - s.touchState.worldCenter.x * nextScale;
      s.viewport.y = center.y - s.touchState.worldCenter.y * nextScale;
      return;
    }

    const touch = touches[0];
    if (!touch) return;
    const pt = getCanvasPoint(touch.clientX, touch.clientY);
    const dx = pt.x - s.touchState.lastX;
    const dy = pt.y - s.touchState.lastY;
    const totalMove = Math.abs(pt.x - s.touchState.startX) + Math.abs(pt.y - s.touchState.startY);
    s.touchState.moved = s.touchState.moved || totalMove > 5;

    if (s.touchState.type === 'node') {
      const world = { x: (pt.x - s.viewport.x) / s.viewport.scale, y: (pt.y - s.viewport.y) / s.viewport.scale };
      s.touchState.node.x = world.x;
      s.touchState.node.y = world.y;
      s.touchState.node.vx = 0;
      s.touchState.node.vy = 0;
    }

    if (s.touchState.type === 'pan') {
      s.viewport.x += dx;
      s.viewport.y += dy;
    }

    s.touchState.lastX = pt.x;
    s.touchState.lastY = pt.y;
  }, [getCanvasPoint]);

  const handleTouchEnd = useCallback(() => {
    const s = stateRef.current;
    if (!s.touchState) return;

    if (s.touchState.type === 'node') {
      s.touchState.node.fixed = false;
      if (!s.touchState.moved && onNodeTap) {
        onNodeTap(s.touchState.node);
      }
    }

    s.touchState = null;
  }, [onNodeTap]);

  // Mouse support for desktop
  const handleMouseDown = useCallback((e) => {
    const fake = { touches: [{ clientX: e.clientX, clientY: e.clientY }] };
    handleTouchStart(fake);
  }, [handleTouchStart]);

  const handleMouseMove = useCallback((e) => {
    if (!stateRef.current.touchState) return;
    const fake = { touches: [{ clientX: e.clientX, clientY: e.clientY }] };
    handleTouchMove(fake);
  }, [handleTouchMove]);

  const handleMouseUp = useCallback(() => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const s = stateRef.current;
    const pt = getCanvasPoint(e.clientX, e.clientY);
    const world = { x: (pt.x - s.viewport.x) / s.viewport.scale, y: (pt.y - s.viewport.y) / s.viewport.scale };
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const nextScale = Math.max(0.7, Math.min(3.2, s.viewport.scale * factor));
    s.viewport.scale = nextScale;
    s.viewport.x = pt.x - world.x * nextScale;
    s.viewport.y = pt.y - world.y * nextScale;
  }, [getCanvasPoint]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
});

export default NetworkCanvas;
