export function buildNetworkNodes(sectors, width, height) {
  const max = Math.max(...sectors.map((item) => item.netInflow), 1);
  const centerX = width / 2;
  const centerY = height / 2;
  const ring = Math.min(width, height) * 0.28;

  return sectors.map((item, index) => ({
    ...item,
    x: Math.round(centerX + Math.cos(index * 2.399) * ring * (0.8 + (index % 5) * 0.08)),
    y: Math.round(centerY + Math.sin(index * 2.399) * ring * (0.8 + (index % 4) * 0.08)),
    vx: 0,
    vy: 0,
    radius: Math.round(6 + (item.netInflow / max) * 14),
    labelLevel: index < 10 ? 1 : 0,
  }));
}

export function buildNetworkLinks(nodes) {
  const nodeMap = {};
  const links = [];
  const used = {};
  nodes.forEach((node) => {
    nodeMap[node.id] = node;
  });

  nodes.forEach((node) => {
    (node.links || []).forEach((targetId) => {
      const target = nodeMap[targetId];
      if (!target) return;

      const key = [node.id, target.id].sort().join('::');
      if (used[key]) return;
      used[key] = true;

      links.push({
        source: node,
        target,
        strength: node.category === target.category ? 1.18 : 0.86,
      });
    });
  });

  return links;
}

export function stepForceLayout(nodes, links, width, height, alpha = 0.08) {
  const centerX = width / 2;
  const centerY = height / 2;

  links.forEach((link) => {
    const source = link.source;
    const target = link.target;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const targetDistance = 46 + source.radius + target.radius;
    const force = (distance - targetDistance) * 0.018 * link.strength * alpha;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;

    if (!source.fixed) { source.vx += fx; source.vy += fy; }
    if (!target.fixed) { target.vx -= fx; target.vy -= fy; }
  });

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = Math.max(16, dx * dx + dy * dy);
      const distance = Math.sqrt(distanceSq);
      const charge = (a.category === b.category ? 620 : 920) * alpha / distanceSq;
      const fx = (dx / distance) * charge;
      const fy = (dy / distance) * charge;
      const minDistance = a.radius + b.radius + 14;

      if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
      if (!b.fixed) { b.vx += fx; b.vy += fy; }

      if (distance < minDistance) {
        const push = (minDistance - distance) * 0.035 * alpha;
        if (!a.fixed) { a.vx -= (dx / distance) * push; a.vy -= (dy / distance) * push; }
        if (!b.fixed) { b.vx += (dx / distance) * push; b.vy += (dy / distance) * push; }
      }
    }
  }

  nodes.forEach((node) => {
    if (node.fixed) { node.vx = 0; node.vy = 0; return; }

    node.vx += (centerX - node.x) * 0.004 * alpha;
    node.vy += (centerY - node.y) * 0.004 * alpha;

    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x += node.vx;
    node.y += node.vy;

    const padding = node.radius + 18;
    if (node.x < padding) { node.x = padding; node.vx *= -0.35; }
    if (node.x > width - padding) { node.x = width - padding; node.vx *= -0.35; }
    if (node.y < padding) { node.y = padding; node.vy *= -0.35; }
    if (node.y > height - padding) { node.y = height - padding; node.vy *= -0.35; }
  });
}

export function buildParticles(count, width, height) {
  return Array.from({ length: count }).map((_, index) => {
    const seed = index + 1;
    return {
      x: (seed * 47) % width,
      y: (seed * 71) % height,
      vx: (((seed * 13) % 11) - 5) / 18,
      vy: (((seed * 17) % 9) - 4) / 20,
      radius: 0.8 + (seed % 4) * 0.32,
      alpha: 0.18 + (seed % 5) * 0.05,
    };
  });
}

export function moveParticles(particles, width, height) {
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.x < 0 || particle.x > width) particle.vx *= -1;
    if (particle.y < 0 || particle.y > height) particle.vy *= -1;
  });
  return particles;
}

export function hitTestNode(nodes, x, y) {
  return nodes.find((node) => {
    const dx = x - node.x;
    const dy = y - node.y;
    return Math.sqrt(dx * dx + dy * dy) <= node.radius + 8;
  });
}
