import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { graphAPI, teacherAPI } from '../services/api';
import api from '../services/api';
import { Network, Grid3X3, BarChart3, Search, RefreshCw, Zap, Maximize2, Minimize2, X, GitBranch } from 'lucide-react';
import { cn } from '../lib/utils';

// ── Constants ─────────────────────────────────────────────────────
const TOPIC_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#7c3aed', '#0ea5e9', '#d97706',
];

const DIFF_LABELS = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };
const DIFF_BADGE = {
  1: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  2: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  3: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ── Topic Network SVG ─────────────────────────────────────────────
function TopicNetworkGraph({ nodes, edges }) {
  const [hovered, setHovered] = useState(null);
  const W = 900, H = 580;

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
        Sin datos de grafo de temas
      </div>
    );
  }

  // Circular layout with colour assignment
  const cx = W / 2, cy = H / 2;
  const radius = Math.min(W, H) / 2 - 100;
  const posNodes = nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    return {
      ...n,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      color: TOPIC_COLORS[i % TOPIC_COLORS.length],
      colorIdx: i % TOPIC_COLORS.length,
    };
  });
  const posMap = Object.fromEntries(posNodes.map(n => [n.id, n]));
  const maxTrans = Math.max(...edges.map(e => e.n_transitions), 1);
  const nodeR = (n) => Math.max(22, Math.min(38, 15 + (n.size || 1) * 0.22));

  // Quadratic bezier, curved away from center
  const curvedPath = (src, tgt) => {
    if (!src || !tgt || src.id === tgt.id) return null;
    const dx = tgt.x - src.x, dy = tgt.y - src.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return null;
    const ux = dx / dist, uy = dy / dist;
    // Perpendicular offset: curve toward outside of circle
    const ox = -uy * 40, oy = ux * 40;
    const mx = (src.x + tgt.x) / 2 + ox, my = (src.y + tgt.y) / 2 + oy;
    const tR = nodeR(tgt) + 9;
    // Approximate tangent from quadratic end: direction from control to end
    const cx2 = tgt.x - mx, cy2 = tgt.y - my;
    const cd = Math.hypot(cx2, cy2) || 1;
    const ex = tgt.x - (cx2 / cd) * tR, ey = tgt.y - (cy2 / cd) * tR;
    return `M ${src.x} ${src.y} Q ${mx} ${my} ${ex} ${ey}`;
  };

  const isConnected = (id) => {
    if (!hovered) return true;
    if (id === hovered) return true;
    return edges.some(e => (e.source === hovered && e.target === id) || (e.target === hovered && e.source === id));
  };

  const shortLabel = (s) => {
    const first = (s || '').split(',')[0].trim();
    return first.length > 13 ? first.slice(0, 12) + '…' : first;
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl"
        style={{ maxHeight: 540, background: '#09090b' }}
      >
        <defs>
          {/* Per-node radial gradients */}
          {posNodes.map((n, i) => (
            <radialGradient key={i} id={`ng-${i}`} cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor={n.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={n.color} stopOpacity="0.4" />
            </radialGradient>
          ))}
          {/* Per-color arrowheads */}
          {TOPIC_COLORS.map((color, i) => (
            <marker key={i} id={`arr-${i}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5 z" fill={color} fillOpacity="0.85" />
            </marker>
          ))}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Subtle guide circles */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#27272a" strokeWidth={1} strokeDasharray="4 10" />
        <circle cx={cx} cy={cy} r={radius * 0.55} fill="none" stroke="#1c1c1e" strokeWidth={1} strokeDasharray="3 8" />

        {/* Edges */}
        {edges.map((e, i) => {
          const src = posMap[e.source], tgt = posMap[e.target];
          if (!src || !tgt || e.source === e.target) return null;
          const path = curvedPath(src, tgt);
          if (!path) return null;
          const t = e.n_transitions / maxTrans;
          const isActive = hovered && (e.source === hovered || e.target === hovered);
          const opacity = hovered ? (isActive ? 0.9 : 0.04) : (0.18 + 0.55 * t);
          const sw = 1.2 + 3.2 * t;
          return (
            <path key={i} d={path} fill="none"
              stroke={src.color} strokeWidth={isActive ? sw + 1.5 : sw}
              strokeOpacity={opacity}
              markerEnd={`url(#arr-${src.colorIdx})`}
            />
          );
        })}

        {/* Nodes */}
        {posNodes.map((n, i) => {
          const r = nodeR(n);
          const isHov = hovered === n.id;
          const dimmed = hovered && !isConnected(n.id);
          return (
            <g key={n.id}
              transform={`translate(${n.x},${n.y})`}
              style={{ cursor: 'pointer' }}
              opacity={dimmed ? 0.18 : 1}
              filter={isHov ? 'url(#glow-strong)' : 'url(#glow)'}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Pulse ring on hover */}
              {isHov && <circle r={r + 10} fill="none" stroke={n.color} strokeWidth={1.5} strokeOpacity={0.4} />}
              {/* Outer ring */}
              <circle r={r + 4} fill="none" stroke={n.color} strokeWidth={1} strokeOpacity={isHov ? 0.55 : 0.18} />
              {/* Node body */}
              <circle r={r} fill={`url(#ng-${i})`} stroke={n.color} strokeWidth={isHov ? 2.5 : 1.5} />
              {/* Label */}
              <text dy="0.35em" textAnchor="middle" fontSize={10} fontWeight="700"
                fontFamily="system-ui,sans-serif"
                stroke="#09090b" strokeWidth={3.5} paintOrder="stroke" fill="#f4f4f5">
                {shortLabel(n.id)}
              </text>
              {/* Size badge below */}
              <text y={r + 13} textAnchor="middle" fontSize={8.5}
                fill={n.color} fillOpacity={isHov ? 1 : 0.65} fontFamily="system-ui">
                {n.size} Q
              </text>
            </g>
          );
        })}

        {/* Tooltip on hover */}
        {hovered && (() => {
          const n = posMap[hovered];
          if (!n) return null;
          const outEdges = edges.filter(e => e.source === hovered).sort((a, b) => b.n_transitions - a.n_transitions);
          const inCount = edges.filter(e => e.target === hovered).length;
          const TW = 200, TH = inCount > 0 || outEdges.length > 0 ? 76 : 52;
          let tx = n.x + nodeR(n) + 14, ty = n.y - TH / 2;
          if (tx + TW > W - 10) tx = n.x - nodeR(n) - TW - 14;
          if (ty < 8) ty = 8;
          if (ty + TH > H - 8) ty = H - TH - 8;
          const topTarget = outEdges[0] ? posMap[outEdges[0].target]?.id?.split(',')[0]?.trim() : null;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TW} height={TH} rx={8}
                fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
              <text x={tx + 10} y={ty + 18} fontSize={11} fontWeight={700}
                fill={n.color} fontFamily="system-ui">{shortLabel(n.id)}</text>
              <text x={tx + 10} y={ty + 34} fontSize={10} fill="#a1a1aa" fontFamily="system-ui">
                {n.size} preguntas · {outEdges.length} salidas · {inCount} entradas
              </text>
              {topTarget && (
                <text x={tx + 10} y={ty + 52} fontSize={10} fill="#71717a" fontFamily="system-ui">
                  → más frecuente: {topTarget.length > 18 ? topTarget.slice(0, 17) + '…' : topTarget}
                </text>
              )}
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3">
        {posNodes.map(n => (
          <button key={n.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-opacity border"
            style={{
              background: `${n.color}12`,
              borderColor: `${n.color}35`,
              color: n.color,
              opacity: hovered && hovered !== n.id ? 0.3 : 1,
            }}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.color }} />
            {n.id.split(',')[0].trim()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Transition Heatmap ─────────────────────────────────────────────
function TransitionHeatmap({ matrix, labels }) {
  if (!matrix || matrix.length === 0) {
    return <div className="py-12 text-center text-zinc-500 text-sm">Sin datos de matriz</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Column headers */}
        <div className="flex gap-2 mb-2" style={{ marginLeft: 116 }}>
          {labels.map(l => (
            <div key={l} className="text-center text-xs font-semibold text-zinc-500" style={{ width: 100 }}>
              → {DIFF_LABELS[l] || `D${l}`}
            </div>
          ))}
        </div>
        {/* Rows */}
        {matrix.map((row, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <div className="text-right text-xs font-semibold text-zinc-500 pr-3" style={{ width: 112 }}>
              {DIFF_LABELS[labels[i]] || `D${labels[i]}`} →
            </div>
            {row.map((val, j) => {
              const pct = Math.round(val * 100);
              const isDiag = i === j;
              const intensity = 0.06 + val * 0.82;
              return (
                <div key={j}
                  className="flex flex-col items-center justify-center rounded-xl border transition-all"
                  style={{
                    width: 100, height: 68,
                    background: isDiag
                      ? `rgba(99,102,241,${intensity})`
                      : `rgba(59,130,246,${intensity})`,
                    borderColor: isDiag
                      ? `rgba(99,102,241,${0.2 + val * 0.6})`
                      : `rgba(59,130,246,${0.1 + val * 0.4})`,
                  }}
                >
                  <span className="text-lg font-bold leading-none"
                    style={{ color: val > 0.35 ? '#f0f9ff' : val > 0.12 ? '#93c5fd' : '#3f3f46' }}>
                    {pct}%
                  </span>
                  {isDiag && (
                    <span className="text-[9px] mt-1 font-medium"
                      style={{ color: val > 0.35 ? '#bfdbfe' : '#4f46e5' }}>
                      mismo nivel
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <p className="text-xs text-zinc-600 mt-4 max-w-lg">
          Cada celda [fila → columna] muestra P(dificultad siguiente = columna | dificultad actual = fila).
          La diagonal (azul-violeta) indica que el motor mantuvo el mismo nivel de dificultad.
        </p>
      </div>
    </div>
  );
}

// ── Topic Stats Table ─────────────────────────────────────────────
function TopicStatsTable({ stats }) {
  if (!stats || stats.length === 0) {
    return <div className="py-12 text-center text-zinc-500 text-sm">Sin datos de estadísticas por tema</div>;
  }

  const maxDensity = Math.max(...stats.map(s => s.density), 0.001);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            {['Tema', 'Preguntas', 'Arcos', 'Densidad intra-red', 'P(correcta) media'].map(h => (
              <th key={h} className={cn(
                'py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider',
                h === 'Tema' ? 'text-left' : h === 'Preguntas' || h === 'Arcos' ? 'text-right' : 'text-left min-w-[150px]'
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={i} className="border-b border-zinc-800/40 hover:bg-zinc-800/25 transition-colors">
              <td className="py-3 px-4 text-zinc-200 font-medium max-w-[200px] truncate" title={s.tema}>{s.tema}</td>
              <td className="py-3 px-4 text-right font-semibold text-blue-400">{s.n_nodes}</td>
              <td className="py-3 px-4 text-right text-violet-400">{s.n_edges}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(s.density / maxDensity) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">
                    {(s.density * 100).toFixed(1)}%
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.avg_p_correct * 100}%`,
                        background: s.avg_p_correct > 0.6 ? '#10b981' : s.avg_p_correct > 0.4 ? '#f59e0b' : '#ef4444',
                      }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">
                    {(s.avg_p_correct * 100).toFixed(1)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Neighborhood Explorer ─────────────────────────────────────────
function NeighborhoodExplorer() {
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [questions, setQuestions] = useState([]);
  const [selectedQ, setSelectedQ] = useState(null);
  const [neighbors, setNeighbors] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingN, setLoadingN] = useState(false);

  useEffect(() => {
    api.get('/quiz/themes').then(r => setThemes(r.data.themes || [])).catch(() => {});
  }, []);

  const handleThemeChange = async (theme) => {
    setSelectedTheme(theme);
    setSelectedQ(null);
    setNeighbors(null);
    if (!theme) { setQuestions([]); return; }
    setLoadingQ(true);
    try {
      const r = await teacherAPI.getQuestions(theme);
      setQuestions(r.data.questions || []);
    } catch { setQuestions([]); }
    finally { setLoadingQ(false); }
  };

  const handleSelectQ = async (q) => {
    setSelectedQ(q);
    setNeighbors(null);
    setLoadingN(true);
    try {
      const r = await graphAPI.getNodeNeighborhood(q.question_id, 12);
      setNeighbors(r.data.neighbors || []);
    } catch { setNeighbors([]); }
    finally { setLoadingN(false); }
  };

  return (
    <div className="space-y-5">
      {/* Step 1 */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">1. Tema</p>
        <select
          value={selectedTheme}
          onChange={e => handleThemeChange(e.target.value)}
          className="h-9 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors w-full max-w-xs"
        >
          <option value="">— Selecciona un tema —</option>
          {themes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Step 2 */}
      {selectedTheme && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            2. Pregunta de origen
            {loadingQ && <span className="ml-2 text-blue-400 normal-case font-normal">(cargando…)</span>}
            {!loadingQ && questions.length > 0 && (
              <span className="ml-2 text-zinc-600 normal-case font-normal">{questions.length} preguntas</span>
            )}
          </p>
          <div className="grid gap-1.5 max-h-60 overflow-y-auto pr-1 rounded-lg">
            {questions.map(q => (
              <button key={q.question_id}
                onClick={() => handleSelectQ(q)}
                className={cn(
                  'text-left px-3 py-2.5 rounded-lg border text-xs transition-all',
                  selectedQ?.question_id === q.question_id
                    ? 'bg-blue-600/20 border-blue-500/50'
                    : 'bg-zinc-800/40 border-zinc-700/40 hover:bg-zinc-700/40 hover:border-zinc-600/60'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-blue-400">#{q.question_id}</span>
                  <span className={cn('px-1.5 py-px rounded text-[10px] font-semibold border', DIFF_BADGE[q.difficulty])}>
                    {DIFF_LABELS[q.difficulty]}
                  </span>
                  <span className="text-zinc-600 text-[10px]">Sem {q.week}</span>
                </div>
                <p className="text-zinc-400 leading-snug line-clamp-2">{q.preview}</p>
              </button>
            ))}
            {!loadingQ && questions.length === 0 && (
              <p className="text-zinc-500 text-sm py-3 px-2">Sin preguntas para este tema</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3 */}
      {selectedQ && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            3. Preguntas que siguen a #{selectedQ.question_id}
            {loadingN && <span className="ml-2 text-blue-400 normal-case font-normal">(cargando…)</span>}
          </p>
          {neighbors !== null && neighbors.length === 0 && !loadingN && (
            <div className="py-6 text-center text-zinc-500 text-sm bg-zinc-800/30 rounded-lg border border-zinc-800">
              Sin sucesores observados. Se necesitan más sesiones completadas para construir conexiones.
            </div>
          )}
          {neighbors && neighbors.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['#', 'Transiciones', 'P(B|A)', 'P(correcta)', 'Dif.', 'Tema'].map(h => (
                    <th key={h} className={cn(
                      'py-2 px-3 text-xs font-semibold text-zinc-500',
                      h === '#' || h === 'Tema' ? 'text-left' : 'text-right'
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {neighbors.map((n, i) => (
                  <tr key={i} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-400">#{n.question_id}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-300 tabular-nums">{n.n_transitions}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-300 tabular-nums">{(n.p_transition * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums"
                      style={{ color: n.p_correct > 0.6 ? '#34d399' : n.p_correct > 0.4 ? '#fbbf24' : '#f87171' }}>
                      {(n.p_correct * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={cn('px-1.5 py-px rounded text-[10px] font-semibold border', DIFF_BADGE[n.dificultad])}>
                        {DIFF_LABELS[n.dificultad]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 max-w-[160px] truncate text-xs" title={n.tema}>{n.tema}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Question Network (Red de Preguntas) ──────────────────────────
const DIFF_COLORS_Q = { 1: '#10b981', 2: '#f59e0b', 3: '#ef4444' };
const VIRTUAL = 3000;

function computeClusterLayout(nodes) {
  const cx = VIRTUAL / 2, cy = VIRTUAL / 2;
  const outerR = VIRTUAL * 0.38;
  const groups = {};
  nodes.forEach(n => {
    const t = (n.tema || 'Sin tema').split(',')[0].trim();
    if (!groups[t]) groups[t] = [];
    groups[t].push(n);
  });
  const temas = Object.keys(groups).sort();
  const positions = {};
  const temaColorMap = {};
  temas.forEach((tema, ti) => {
    const angle = (ti / temas.length) * 2 * Math.PI - Math.PI / 2;
    const tcx = cx + outerR * Math.cos(angle);
    const tcy = cy + outerR * Math.sin(angle);
    temaColorMap[tema] = TOPIC_COLORS[ti % TOPIC_COLORS.length];
    const group = groups[tema];
    const innerR = Math.max(55, (group.length * 20) / (2 * Math.PI));
    group.forEach((n, ni) => {
      const na = (ni / Math.max(1, group.length)) * 2 * Math.PI;
      positions[n.id] = { x: tcx + innerR * Math.cos(na), y: tcy + innerR * Math.sin(na) };
    });
  });
  return { positions, temas, temaColorMap, nodeEdgesMap: {} };
}

function QuestionNetworkGraph() {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);

  // All drawing state in a single ref — avoids stale closures and skips React re-renders for pan/zoom
  const S = useRef({ transform: { x: 0, y: 0, scale: 1 }, focusId: null, colorBy: 'difficulty', showEdges: true });
  const layoutRef = useRef(null);
  const dataRef = useRef(null);
  const rafRef = useRef(null);
  const isDragging = useRef(false);
  const dragOrigin = useRef(null);

  // React state (UI outside canvas)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltip, setTooltip] = useState(null);         // { node, x, y }
  const [selectedNode, setSelectedNode] = useState(null);
  const [colorBy, setColorBy] = useState('difficulty');
  const [showEdges, setShowEdges] = useState(true);

  // Filter state
  const [week, setWeek] = useState('');
  const [tema, setTema] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [availableTemas, setAvailableTemas] = useState([]);

  // Data state
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Fetch ─────────────────────────────────────────────────────
  useEffect(() => { fetchData({}); }, []); // eslint-disable-line

  async function fetchData(filters) {
    setLoading(true); setError('');
    try {
      const res = await graphAPI.getQuestionNetwork(filters);
      const d = res.data;
      setGraphData(d);
      dataRef.current = d;
      if (!filters.week && !filters.tema && !filters.difficulty) {
        setAvailableWeeks([...new Set(d.nodes.map(n => n.semana).filter(Boolean))].sort((a, b) => a - b));
        setAvailableTemas([...new Set(d.nodes.map(n => (n.tema || '').split(',')[0].trim()).filter(Boolean))].sort());
      }
    } catch {
      setError('Error al cargar la red. Asegúrate de que el grafo esté construido.');
    } finally { setLoading(false); }
  }

  // ── Build layout when data changes ────────────────────────────
  useEffect(() => {
    if (!graphData?.nodes?.length) { layoutRef.current = null; return; }
    const layout = computeClusterLayout(graphData.nodes);
    graphData.edges.forEach(e => {
      if (!layout.nodeEdgesMap[e.source]) layout.nodeEdgesMap[e.source] = [];
      if (!layout.nodeEdgesMap[e.target]) layout.nodeEdgesMap[e.target] = [];
      layout.nodeEdgesMap[e.source].push(e);
      layout.nodeEdgesMap[e.target].push(e);
    });
    layoutRef.current = layout;
    scheduleRedraw();
    setTimeout(fitView, 80);
  }, [graphData]);

  // ── Resize canvas to fill wrapper ─────────────────────────────
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = wrapper.clientWidth, h = wrapper.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      scheduleRedraw();
    }
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, [isFullscreen]);

  // ── Sync color/edges toggles to ref ───────────────────────────
  useEffect(() => { S.current.colorBy = colorBy; S.current.showEdges = showEdges; scheduleRedraw(); }, [colorBy, showEdges]);

  // ── Manual wheel listener (needs passive:false for preventDefault) ─
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }); // re-attach every render so closure is always fresh

  // ── Draw ──────────────────────────────────────────────────────
  function scheduleRedraw() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }

  function draw() {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    const data = dataRef.current;
    if (!canvas || !layout || !data) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const ctx = canvas.getContext('2d');
    const { transform, focusId, colorBy: cby, showEdges: se } = S.current;
    const { positions, temaColorMap, nodeEdgesMap } = layout;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, W, H);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Compute highlight sets
    const connectedNodes = new Set();
    const hlEdgeKeys = new Set();
    if (focusId && nodeEdgesMap[focusId]) {
      nodeEdgesMap[focusId].forEach(e => {
        hlEdgeKeys.add(`${e.source}-${e.target}`);
        connectedNodes.add(e.source); connectedNodes.add(e.target);
      });
    }
    const hasFocus = focusId !== null;

    // ── EDGES ─────────────────────────────────────────────────
    if (se && data.edges.length) {
      data.edges.forEach(e => {
        const s = positions[e.source], t = positions[e.target];
        if (!s || !t) return;
        const key = `${e.source}-${e.target}`;
        const isHL = hlEdgeKeys.has(key);
        if (hasFocus && !isHL) return;
        const p = e.p_correct;
        const r = Math.round(255 * (1 - p));
        const g = Math.round(200 * p + 55);
        const alpha = isHL ? 0.88 : Math.min(0.32, 0.05 + e.p_transition * 0.35);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `rgba(${r},${g},70,${alpha})`;
        ctx.lineWidth = isHL ? 1.8 : 0.55; ctx.stroke();
      });
    }

    // ── NODES ─────────────────────────────────────────────────
    data.nodes.forEach(n => {
      const p = positions[n.id]; if (!p) return;
      const isFocus = n.id === focusId;
      const isConn = connectedNodes.has(n.id) && !isFocus;
      const isDimmed = hasFocus && !isFocus && !isConn;
      const tKey = (n.tema || '').split(',')[0].trim() || 'Sin tema';
      const color = cby === 'difficulty' ? (DIFF_COLORS_Q[n.dificultad] || '#6366f1') : (temaColorMap[tKey] || '#6366f1');
      const nr = isFocus ? 9 : isConn ? 6 : 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, nr, 0, 2 * Math.PI);
      ctx.fillStyle = isDimmed ? '#2a2a2e' : color;
      ctx.globalAlpha = isDimmed ? 0.18 : 1; ctx.fill(); ctx.globalAlpha = 1;
      if (isFocus) {
        ctx.beginPath(); ctx.arc(p.x, p.y, nr + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      }
    });

    ctx.restore();
  }

  // ── Fit all nodes into view ───────────────────────────────────
  function fitView() {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const scale = Math.min(W, H) / (VIRTUAL * 1.06);
    S.current.transform = { x: (W - VIRTUAL * scale) / 2, y: (H - VIRTUAL * scale) / 2, scale };
    scheduleRedraw();
  }

  // ── Mouse helpers ─────────────────────────────────────────────
  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function toWorld(sx, sy) {
    const { x, y, scale } = S.current.transform;
    return { x: (sx - x) / scale, y: (sy - y) / scale };
  }
  function findNode(wx, wy) {
    const layout = layoutRef.current, data = dataRef.current;
    if (!layout || !data) return null;
    const hitR = Math.max(12, 8 / S.current.transform.scale);
    for (const n of data.nodes) {
      const p = layout.positions[n.id]; if (!p) continue;
      if ((p.x - wx) ** 2 + (p.y - wy) ** 2 <= hitR * hitR) return n;
    }
    return null;
  }

  // ── Event handlers ────────────────────────────────────────────
  function onMouseMove(e) {
    if (isDragging.current && dragOrigin.current) {
      const { x, y } = getPos(e);
      S.current.transform = {
        ...S.current.transform,
        x: dragOrigin.current.tx + (x - dragOrigin.current.x),
        y: dragOrigin.current.ty + (y - dragOrigin.current.y),
      };
      scheduleRedraw(); return;
    }
    const { x, y } = getPos(e);
    const { x: wx, y: wy } = toWorld(x, y);
    const node = findNode(wx, wy);
    const prevFocus = S.current.focusId;
    S.current.focusId = node ? node.id : (selectedNode?.id ?? null);
    if (S.current.focusId !== prevFocus) scheduleRedraw();
    setTooltip(node ? { node, x, y } : null);
  }

  function onMouseDown(e) {
    isDragging.current = true;
    const { x, y } = getPos(e);
    dragOrigin.current = { x, y, tx: S.current.transform.x, ty: S.current.transform.y };
  }

  function onMouseUp(e) {
    if (dragOrigin.current) {
      const { x, y } = getPos(e);
      if (Math.abs(x - dragOrigin.current.x) < 5 && Math.abs(y - dragOrigin.current.y) < 5) {
        const { x: wx, y: wy } = toWorld(x, y);
        const node = findNode(wx, wy);
        setSelectedNode(node || null);
        S.current.focusId = node ? node.id : null;
        scheduleRedraw();
      }
    }
    isDragging.current = false; dragOrigin.current = null;
  }

  function onWheel(e) {
    e.preventDefault();
    const { x, y } = getPos(e);
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const { scale, x: tx, y: ty } = S.current.transform;
    const ns = Math.max(0.02, Math.min(15, scale * factor));
    S.current.transform = { scale: ns, x: x - (x - tx) * (ns / scale), y: y - (y - ty) * (ns / scale) };
    scheduleRedraw();
  }

  function applyFilters() {
    const f = {};
    if (week) f.week = parseInt(week);
    if (tema) f.tema = tema;
    if (difficulty) f.difficulty = parseInt(difficulty);
    setSelectedNode(null); S.current.focusId = null;
    fetchData(f);
  }

  function resetFilters() {
    setWeek(''); setTema(''); setDifficulty('');
    setSelectedNode(null); S.current.focusId = null;
    fetchData({});
  }

  // Selected node outgoing edges (for bottom panel)
  const selOutEdges = selectedNode && layoutRef.current?.nodeEdgesMap[selectedNode.id]
    ? layoutRef.current.nodeEdgesMap[selectedNode.id]
        .filter(e => e.source === selectedNode.id)
        .sort((a, b) => b.n_transitions - a.n_transitions)
        .slice(0, 6)
    : [];

  return (
    <div
      ref={containerRef}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        background: '#09090b',
        display: 'flex', flexDirection: 'column',
        height: isFullscreen ? '100vh' : 660,
        borderRadius: isFullscreen ? 0 : 12,
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid #27272a',
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-zinc-800 flex-shrink-0 bg-zinc-950/60">
        {/* Filters */}
        <select value={week} onChange={e => setWeek(e.target.value)}
          className="h-7 px-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-blue-500">
          <option value="">Sem. todas</option>
          {availableWeeks.map(w => <option key={w} value={w}>Sem. {w}</option>)}
        </select>
        <select value={tema} onChange={e => setTema(e.target.value)}
          className="h-7 px-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-blue-500 max-w-[150px]">
          <option value="">Todos los temas</option>
          {availableTemas.map(t => <option key={t} value={t}>{t.length > 22 ? t.slice(0, 21) + '…' : t}</option>)}
        </select>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
          className="h-7 px-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-blue-500">
          <option value="">Dif. todas</option>
          <option value="1">Fácil</option>
          <option value="2">Media</option>
          <option value="3">Difícil</option>
        </select>
        <button onClick={applyFilters}
          className="h-7 px-3 text-xs font-semibold rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 transition-colors">
          Filtrar
        </button>
        {(week || tema || difficulty) && (
          <button onClick={resetFilters}
            className="h-7 px-2 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
            × Reset
          </button>
        )}

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Color mode */}
        <span className="text-xs text-zinc-600">Color:</span>
        {['difficulty', 'tema'].map(mode => (
          <button key={mode} onClick={() => setColorBy(mode)}
            className={cn('h-7 px-2.5 text-xs rounded border font-medium transition-colors',
              colorBy === mode ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300')}>
            {mode === 'difficulty' ? 'Dificultad' : 'Tema'}
          </button>
        ))}

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Toggles */}
        <button onClick={() => setShowEdges(v => !v)}
          className={cn('h-7 px-2.5 text-xs rounded border font-medium transition-colors',
            showEdges ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300')}>
          Arcos {showEdges ? '✓' : ''}
        </button>
        <button onClick={fitView}
          className="h-7 px-2.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 bg-zinc-800 transition-colors">
          Encuadrar
        </button>

        <div className="flex-1 min-w-0" />

        {/* Stats */}
        {graphData && (
          <span className="text-xs text-zinc-600 tabular-nums hidden sm:block">
            <span className="text-blue-400 font-semibold">{graphData.total_nodes}</span> nodos ·{' '}
            <span className="text-violet-400 font-semibold">{graphData.total_edges}</span> arcos
            {graphData.total_edges > 2000 && <span className="text-zinc-600"> (mostrando 2000)</span>}
          </span>
        )}

        {/* Fullscreen */}
        <button
          onClick={() => setIsFullscreen(v => !v)}
          className="h-7 px-2.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 bg-zinc-800 flex items-center gap-1.5 transition-colors">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isFullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      {/* ── Canvas wrapper ───────────────────────────────────── */}
      <div ref={wrapperRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 z-10">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
            <span className="ml-2 text-sm text-zinc-400">Cargando red de preguntas…</span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-red-400 text-sm px-8 text-center">{error}</p>
          </div>
        )}
        {!loading && !error && graphData && !graphData.nodes.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-zinc-500 text-sm">Sin datos — genera la simulación primero.</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: tooltip ? 'pointer' : 'grab', userSelect: 'none' }}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            isDragging.current = false; dragOrigin.current = null;
            const prev = S.current.focusId;
            S.current.focusId = selectedNode?.id ?? null;
            if (S.current.focusId !== prev) scheduleRedraw();
            setTooltip(null);
          }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(tooltip.x + 14, (wrapperRef.current?.clientWidth || 800) - 190),
              top: Math.max(tooltip.y - 14, 8),
              pointerEvents: 'none', zIndex: 20,
            }}
            className="bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2 shadow-2xl backdrop-blur-sm"
          >
            <div className="font-mono font-bold text-blue-400 text-xs">#{tooltip.node.id}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn('px-1.5 py-px rounded text-[10px] font-semibold border', DIFF_BADGE[tooltip.node.dificultad])}>
                {DIFF_LABELS[tooltip.node.dificultad]}
              </span>
              <span className="text-zinc-500 text-[10px]">Sem {tooltip.node.semana}</span>
            </div>
            <div className="text-zinc-500 text-[10px] mt-0.5 max-w-[165px] truncate">{tooltip.node.tema}</div>
          </div>
        )}
      </div>

      {/* ── Bottom bar ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-zinc-800 flex-shrink-0 bg-zinc-950/40">
        {/* Selected node info */}
        {selectedNode ? (
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono font-bold text-blue-400 text-xs">#{selectedNode.id}</span>
            <span className={cn('px-1.5 py-px rounded text-[10px] font-semibold border', DIFF_BADGE[selectedNode.dificultad])}>
              {DIFF_LABELS[selectedNode.dificultad]}
            </span>
            <span className="text-zinc-600 text-[10px]">Sem {selectedNode.semana}</span>
            {selOutEdges.length > 0 && (
              <>
                <span className="text-zinc-700 text-xs">→</span>
                {selOutEdges.map(e => (
                  <span key={e.target}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300">
                    #{e.target}
                    <span style={{ color: e.p_correct > 0.6 ? '#34d399' : e.p_correct > 0.4 ? '#fbbf24' : '#f87171' }}>
                      {Math.round(e.p_correct * 100)}%
                    </span>
                  </span>
                ))}
              </>
            )}
            <button onClick={() => { setSelectedNode(null); S.current.focusId = null; scheduleRedraw(); }}
              className="text-zinc-600 hover:text-zinc-400 text-xs ml-1 transition-colors">
              × limpiar
            </button>
          </div>
        ) : (
          <p className="text-xs text-zinc-600">Click en un nodo para ver detalles · scroll para zoom · arrastra para mover</p>
        )}

        <div className="flex-1" />

        {/* Legend */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {colorBy === 'difficulty' ? (
            [1, 2, 3].map(d => (
              <div key={d} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: DIFF_COLORS_Q[d] }} />
                <span className="text-[11px] text-zinc-500">{DIFF_LABELS[d]}</span>
              </div>
            ))
          ) : (
            <span className="text-[11px] text-zinc-600">Color por tema</span>
          )}
          <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-800">
            <div className="w-10 h-1.5 rounded-full" style={{ background: 'linear-gradient(to right, #ef4444, #eab308, #10b981)' }} />
            <span className="text-[10px] text-zinc-600">P(correcta)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main BayesianNetworkTab ───────────────────────────────────────
const BayesianNetworkTab = () => {
  const [activeTab, setActiveTab] = useState('graph');
  const [status, setStatus] = useState(null);
  const [topicGraph, setTopicGraph] = useState(null);
  const [transMatrix, setTransMatrix] = useState(null);
  const [topicStats, setTopicStats] = useState(null);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const [seedMsg, setSeedMsg] = useState('');

  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const res = await graphAPI.getStatus();
      setStatus(res.data);
      if (res.data.built) fetchVisualizations();
    } catch {
      setError('Error al cargar estado del grafo');
    }
  };

  const fetchVisualizations = async () => {
    setLoad('viz', true);
    try {
      const [tg, tm, ts] = await Promise.all([
        graphAPI.getTopicGraph(),
        graphAPI.getTransitionMatrix(),
        graphAPI.getTopicStats(),
      ]);
      setTopicGraph(tg.data);
      setTransMatrix(tm.data);
      setTopicStats(ts.data.topic_stats);
    } catch {
      setError('Error al cargar visualizaciones');
    } finally {
      setLoad('viz', false);
    }
  };

  const handleSeed = async () => {
    setLoad('seed', true);
    setError('');
    setSeedMsg('Generando datos simulados… puede tardar 1–2 minutos.');
    try {
      const res = await graphAPI.seedSimulation(3000);
      setSeedMsg(`✓ ${res.data.message}`);
      setStatus(res.data.graph_status);
      if (res.data.graph_status.built) fetchVisualizations();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al generar simulación');
      setSeedMsg('');
    } finally {
      setLoad('seed', false);
    }
  };

  const handleRebuild = async () => {
    setLoad('rebuild', true);
    setError('');
    try {
      const res = await graphAPI.rebuild();
      setStatus(res.data.status);
      if (res.data.status.built) fetchVisualizations();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al reconstruir');
    } finally {
      setLoad('rebuild', false);
    }
  };

  const tabs = [
    { id: 'graph',     label: 'Red de Temas',          icon: Network   },
    { id: 'matrix',    label: 'Matriz de Transición',  icon: Grid3X3   },
    { id: 'stats',     label: 'Estadísticas',           icon: BarChart3 },
    { id: 'explorer',  label: 'Explorador',             icon: Search    },
    { id: 'questions', label: 'Red de Preguntas',       icon: GitBranch },
  ];

  const noData = !status?.built;

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full', status?.built ? 'bg-emerald-400' : 'bg-amber-400')} />
            <span className="text-sm text-zinc-300 font-medium">
              {status ? (status.built ? 'Grafo construido' : 'Grafo no construido') : 'Cargando…'}
            </span>
          </div>
          {status?.built && (
            <>
              <span className="text-sm text-zinc-500">
                <span className="text-blue-400 font-semibold tabular-nums">{status.nodes}</span> nodos
              </span>
              <span className="text-sm text-zinc-500">
                <span className="text-violet-400 font-semibold tabular-nums">{status.edges}</span> arcos
              </span>
              <span className="text-sm text-zinc-500">
                <span className="text-emerald-400 font-semibold tabular-nums">{status.transition_rows_used?.toLocaleString()}</span> transiciones
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeed} disabled={loading.seed}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600/25 disabled:opacity-40 transition-colors">
            <Zap className="w-3 h-3" />
            {loading.seed ? 'Generando…' : 'Simular datos'}
          </button>
          <button onClick={handleRebuild} disabled={loading.rebuild}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-300 hover:bg-blue-600/25 disabled:opacity-40 transition-colors">
            <RefreshCw className={cn('w-3 h-3', loading.rebuild && 'animate-spin')} />
            {loading.rebuild ? 'Reconstruyendo…' : 'Reconstruir'}
          </button>
        </div>
      </div>

      {/* Seed progress message */}
      {seedMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
          {seedMsg}
        </div>
      )}

      {/* Inner sub-tabs */}
      <div className="flex gap-0.5 border-b border-zinc-800 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5',
              activeTab === tab.id
                ? 'text-zinc-100 border-blue-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            )}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

        {/* Red de Temas */}
        {activeTab === 'graph' && (
          <div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Cada nodo representa un tema; cada arco una transición observada entre preguntas de distintos temas.
              El grosor del arco indica frecuencia. Pasa el cursor sobre un nodo para resaltar sus conexiones.
            </p>
            {loading.viz ? (
              <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm py-16">
                <RefreshCw className="w-4 h-4 animate-spin" /> Cargando grafo…
              </div>
            ) : topicGraph ? (
              <TopicNetworkGraph nodes={topicGraph.nodes} edges={topicGraph.edges} />
            ) : (
              <div className="py-16 text-center text-zinc-500 text-sm">
                {noData
                  ? 'Usa "Simular datos" para generar sesiones de ejemplo y construir el grafo.'
                  : 'Cargando datos del grafo…'}
              </div>
            )}
          </div>
        )}

        {/* Matriz de Transición */}
        {activeTab === 'matrix' && (
          <div>
            <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
              Probabilidad de que el motor adaptativo seleccione una pregunta de cierta dificultad dada la dificultad de la anterior.
              Cada fila suma 100%. La diagonal (violeta) indica que se mantuvo el mismo nivel.
            </p>
            {transMatrix ? (
              <TransitionHeatmap matrix={transMatrix.matrix} labels={transMatrix.labels} />
            ) : (
              <div className="py-12 text-center text-zinc-500 text-sm">
                {noData ? 'Sin datos — genera la simulación primero.' : 'Cargando…'}
              </div>
            )}
          </div>
        )}

        {/* Estadísticas por Tema */}
        {activeTab === 'stats' && (
          <div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Densidad de la subred de transiciones dentro de cada tema y probabilidad promedio de acierto
              según el historial de sesiones completadas.
            </p>
            {topicStats ? (
              <TopicStatsTable stats={topicStats} />
            ) : (
              <div className="py-12 text-center text-zinc-500 text-sm">
                {noData ? 'Sin datos — genera la simulación primero.' : 'Cargando…'}
              </div>
            )}
          </div>
        )}

        {/* Explorador de Vecindad */}
        {activeTab === 'explorer' && (
          <div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Selecciona un tema y una pregunta para ver qué preguntas suelen responderse a continuación,
              con qué frecuencia y cuál es la probabilidad de acierto observada en ese par.
            </p>
            <NeighborhoodExplorer />
          </div>
        )}

        {/* Red de Preguntas */}
        {activeTab === 'questions' && (
          <div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Red completa de preguntas. Cada nodo es una pregunta; cada arco es una transición observada.
              Color de arco: verde = alta P(correcta), rojo = baja. Usa los filtros para reducir la vista.
              Scroll para zoom, arrastra para navegar, click en nodo para ver sus conexiones.
            </p>
            {noData ? (
              <div className="py-10 text-center text-zinc-500 text-sm">
                Usa "Simular datos" o "Reconstruir" para generar el grafo primero.
              </div>
            ) : (
              <QuestionNetworkGraph />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BayesianNetworkTab;
