import React, { useState, useEffect } from 'react';
import { graphAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ── Theme palette ─────────────────────────────────────────────────
function useColors() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    bg:        dark ? '#1e293b' : '#f1f5f9',
    bg2:       dark ? '#0f172a' : '#e2e8f0',
    bg3:       dark ? '#111827' : '#f8fafc',
    surface:   dark ? '#374151' : '#e4e4e7',
    text:      dark ? '#e2e8f0' : '#1e293b',
    textMuted: dark ? '#9ca3af' : '#52525b',
    textDim:   dark ? '#6b7280' : '#71717a',
    border:    dark ? '#374151' : '#d4d4d8',
    borderSub: dark ? '#1e293b' : '#e4e4e7',
    progressBg: dark ? '#1e293b' : '#d4d4d8',
    seedBg:    dark ? '#0f172a' : '#eff6ff',
    seedText:  dark ? '#86efac' : '#166534',
    errorBg:   dark ? '#7f1d1d' : '#fef2f2',
    errorBorder: dark ? '#ef4444' : '#fca5a5',
    errorText: dark ? '#fca5a5' : '#dc2626',
  };
}

// ── Helper: circular layout ───────────────────────────────────────
function topicLayout(nodes, width, height) {
  const cx = width / 2, cy = height / 2;
  const r = Math.min(width, height) / 2 - 90;
  return nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

// ── Topic Network SVG ─────────────────────────────────────────────
function TopicNetworkGraph({ nodes, edges }) {
  const W = 700, H = 520;
  if (!nodes || nodes.length === 0) return <p style={{ color: '#888' }}>Sin datos de grafo</p>;

  const posNodes = topicLayout(nodes, W, H);
  const posMap = {};
  posNodes.forEach(n => { posMap[n.id] = n; });
  const maxTrans = Math.max(...edges.map(e => e.n_transitions), 1);

  const nodeR = (n) => Math.max(16, Math.min(30, 11 + (n.size || 1) * 0.15));

  const shortLabel = (s) => {
    const first = s.split(',')[0].trim();
    return first.length > 14 ? first.slice(0, 13) + '…' : first;
  };

  // Offset line endpoints to the node circumference, leaving gap for arrowhead
  const arrowLen = 7;
  const getEndpoints = (src, tgt) => {
    const dx = tgt.x - src.x, dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return null;
    const ux = dx / dist, uy = dy / dist;
    const srcR = nodeR(src), tgtR = nodeR(tgt);
    return {
      x1: src.x + ux * (srcR + 2),
      y1: src.y + uy * (srcR + 2),
      x2: tgt.x - ux * (tgtR + arrowLen + 1),
      y2: tgt.y - uy * (tgtR + arrowLen + 1),
    };
  };

  return (
    <svg width={W} height={H} style={{ background: '#0b1220', borderRadius: 12, display: 'block', maxWidth: '100%' }}>
      <defs>
        {/* Arrowhead marker */}
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(148,210,255,0.9)" />
        </marker>
        {/* Node glow filter */}
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {edges.map((e, i) => {
        const src = posMap[e.source], tgt = posMap[e.target];
        if (!src || !tgt || e.source === e.target) return null;
        const pts = getEndpoints(src, tgt);
        if (!pts) return null;
        const t = e.n_transitions / maxTrans;
        const opacity = 0.35 + 0.65 * t;
        const w = 1.2 + 3.5 * t;
        return (
          <line key={i}
            x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
            stroke={`rgba(148,210,255,${opacity})`}
            strokeWidth={w}
            markerEnd="url(#arrow)"
          />
        );
      })}

      {/* Nodes */}
      {posNodes.map(n => {
        const r = nodeR(n);
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`} filter="url(#glow)">
            {/* Outer ring */}
            <circle r={r + 3} fill="none" stroke="rgba(96,165,250,0.35)" strokeWidth={1.5} />
            {/* Node fill */}
            <circle r={r} fill="#1d4ed8" stroke="#60a5fa" strokeWidth={2} />
            {/* Label with outline for contrast */}
            <text
              dy="0.35em" textAnchor="middle"
              fontSize={10} fontWeight="600" fontFamily="sans-serif"
              stroke="#0b1220" strokeWidth={3} paintOrder="stroke"
              fill="#e0f2fe"
            >
              {shortLabel(n.id)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Difficulty Transition Heatmap ─────────────────────────────────
function TransitionHeatmap({ matrix, labels, c }) {
  if (!matrix || matrix.length === 0) return <p style={{ color: c.textDim }}>Sin datos</p>;

  const diffLabels = { '1': 'Fácil', '2': 'Media', '3': 'Difícil' };

  const cellStyle = (val) => ({
    background: `rgba(59, 130, 246, ${val})`,
    color: val > 0.5 ? '#fff' : c.textMuted,
    width: 90, height: 56, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column',
    fontSize: 13, fontWeight: 600, borderRadius: 6, gap: 2,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, marginLeft: 110 }}>
        {labels.map(l => (
          <div key={l} style={{ width: 90, textAlign: 'center', color: c.textMuted, fontSize: 12, fontWeight: 600 }}>
            → {diffLabels[l] || `D${l}`}
          </div>
        ))}
      </div>
      {matrix.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 100, textAlign: 'right', color: c.textMuted, fontSize: 12, fontWeight: 600, paddingRight: 10 }}>
            {diffLabels[labels[i]] || `D${labels[i]}`} →
          </div>
          {row.map((val, j) => (
            <div key={j} style={cellStyle(val)}>
              <span>{(val * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      ))}
      <p style={{ color: c.textDim, fontSize: 11, marginTop: 8 }}>
        P(dificultad destino | dificultad origen). Cada fila suma 1.
      </p>
    </div>
  );
}

// ── Topic Stats Table ─────────────────────────────────────────────
function TopicStatsTable({ stats, c }) {
  if (!stats || stats.length === 0) return <p style={{ color: c.textDim }}>Sin datos</p>;

  const bar = (val, max, color) => (
    <div style={{ background: c.progressBg, borderRadius: 4, height: 6, width: '100%' }}>
      <div style={{ background: color, borderRadius: 4, height: 6, width: `${(val / max) * 100}%` }} />
    </div>
  );

  const maxDensity = Math.max(...stats.map(s => s.density), 0.001);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: c.textMuted, borderBottom: `1px solid ${c.border}` }}>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Tema</th>
            <th style={{ textAlign: 'right', padding: '8px 12px' }}>Preguntas</th>
            <th style={{ textAlign: 'right', padding: '8px 12px' }}>Arcos</th>
            <th style={{ padding: '8px 12px', minWidth: 120 }}>Densidad</th>
            <th style={{ padding: '8px 12px', minWidth: 120 }}>P(correcta)</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${c.borderSub}`, color: c.text }}>
              <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={s.tema}>{s.tema}</td>
              <td style={{ textAlign: 'right', padding: '8px 12px', color: '#60a5fa' }}>{s.n_nodes}</td>
              <td style={{ textAlign: 'right', padding: '8px 12px', color: '#818cf8' }}>{s.n_edges}</td>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {bar(s.density, maxDensity, '#3b82f6')}
                  <span style={{ fontSize: 11, color: c.textMuted, minWidth: 36 }}>{(s.density * 100).toFixed(1)}%</span>
                </div>
              </td>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {bar(s.avg_p_correct, 1, '#10b981')}
                  <span style={{ fontSize: 11, color: c.textMuted, minWidth: 36 }}>{(s.avg_p_correct * 100).toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main BayesianNetworkTab ───────────────────────────────────────
const BayesianNetworkTab = () => {
  const c = useColors();

  const [status, setStatus] = useState(null);
  const [topicGraph, setTopicGraph] = useState(null);
  const [transMatrix, setTransMatrix] = useState(null);
  const [topicStats, setTopicStats] = useState(null);
  const [neighborhood, setNeighborhood] = useState(null);
  const [neighborhoodQId, setNeighborhoodQId] = useState('');
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const [seedProgress, setSeedProgress] = useState('');

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

  const handleSeedSimulation = async () => {
    setLoad('seed', true);
    setError('');
    setSeedProgress('Generando datos simulados... esto puede tardar 1-2 minutos');
    try {
      const res = await graphAPI.seedSimulation(3000);
      setSeedProgress(`✓ ${res.data.message}`);
      setStatus(res.data.graph_status);
      if (res.data.graph_status.built) fetchVisualizations();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al generar simulación');
      setSeedProgress('');
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
      setError(e.response?.data?.error || 'Error al reconstruir grafo');
    } finally {
      setLoad('rebuild', false);
    }
  };

  const handleNeighborhood = async () => {
    const qid = parseInt(neighborhoodQId);
    if (isNaN(qid)) return;
    setLoad('neighbor', true);
    try {
      const res = await graphAPI.getNodeNeighborhood(qid);
      setNeighborhood({ qid, neighbors: res.data.neighbors });
    } catch {
      setError('Error al cargar vecinos');
    } finally {
      setLoad('neighbor', false);
    }
  };

  const sectionStyle = {
    background: c.bg,
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 24,
    border: `1px solid ${c.border}`,
  };

  const headingStyle = { margin: '0 0 8px', fontSize: 18, color: c.text };
  const subStyle = { margin: '0 0 16px', color: c.textMuted, fontSize: 13 };

  const btnStyle = (color, disabled) => ({
    background: disabled ? c.surface : color,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: 14,
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div style={{ color: c.text }}>
      {error && (
        <div style={{ background: c.errorBg, border: `1px solid ${c.errorBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: c.errorText }}>
          {error}
        </div>
      )}

      {/* Status Card */}
      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: c.text }}>Estado del Grafo</h3>
        {status ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: status.built ? '#10b981' : '#f59e0b' }}>
                  {status.built ? '✓' : '✗'}
                </div>
                <div style={{ fontSize: 12, color: c.textMuted }}>{status.built ? 'Construido' : 'No construido'}</div>
              </div>
              {status.built && (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{status.nodes.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: c.textMuted }}>Nodos</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#818cf8' }}>{status.edges.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: c.textMuted }}>Arcos</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#34d399' }}>{status.answers_used.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: c.textMuted }}>Respuestas usadas</div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 'auto' }}>
              <button style={btnStyle('#7c3aed', loading.seed)} onClick={handleSeedSimulation} disabled={loading.seed}>
                {loading.seed ? 'Generando...' : 'Generar Datos Simulados'}
              </button>
              <button style={btnStyle('#2563eb', loading.rebuild)} onClick={handleRebuild} disabled={loading.rebuild}>
                {loading.rebuild ? 'Reconstruyendo...' : 'Reconstruir Grafo'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: c.textMuted }}>Cargando estado...</div>
        )}
        {seedProgress && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: c.seedBg, borderRadius: 8, color: c.seedText, fontSize: 13 }}>
            {seedProgress}
          </div>
        )}
      </div>

      {/* Topic Network */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Red de Temas</h3>
        <p style={subStyle}>Grafo de transición entre temas — cada nodo es un tema, cada arco representa transiciones observadas en sesiones.</p>
        {loading.viz ? (
          <div style={{ color: c.textMuted }}>Cargando grafo...</div>
        ) : topicGraph ? (
          <TopicNetworkGraph nodes={topicGraph.nodes} edges={topicGraph.edges} />
        ) : (
          <div style={{ color: c.textMuted }}>
            {status?.built ? 'Cargando...' : 'Genera datos de simulación primero para ver el grafo.'}
          </div>
        )}
      </div>

      {/* Transition Matrix */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Matriz de Transición por Dificultad</h3>
        <p style={subStyle}>Probabilidad de que la siguiente pregunta tenga cierta dificultad dado que la actual tenía otra.</p>
        {transMatrix ? (
          <TransitionHeatmap matrix={transMatrix.matrix} labels={transMatrix.labels} c={c} />
        ) : (
          <div style={{ color: c.textMuted }}>{status?.built ? 'Cargando...' : 'Sin datos aún.'}</div>
        )}
      </div>

      {/* Topic Stats */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Estadísticas por Tema</h3>
        <p style={subStyle}>Densidad de la subred intra-tema y probabilidad promedio de respuesta correcta.</p>
        {topicStats ? (
          <TopicStatsTable stats={topicStats} c={c} />
        ) : (
          <div style={{ color: c.textMuted }}>{status?.built ? 'Cargando...' : 'Sin datos aún.'}</div>
        )}
      </div>

      {/* Question Neighborhood Explorer */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Explorador de Vecindad</h3>
        <p style={subStyle}>Ver las preguntas más frecuentemente respondidas después de una pregunta dada.</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input
            type="number"
            placeholder="ID de pregunta"
            value={neighborhoodQId}
            onChange={e => setNeighborhoodQId(e.target.value)}
            style={{ background: c.bg2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px', color: c.text, width: 160 }}
          />
          <button
            style={btnStyle('#2563eb', loading.neighbor || !neighborhoodQId)}
            onClick={handleNeighborhood}
            disabled={loading.neighbor || !neighborhoodQId}
          >
            {loading.neighbor ? 'Buscando...' : 'Ver vecinos'}
          </button>
        </div>
        {neighborhood && (
          <div>
            <p style={{ color: c.textMuted, fontSize: 13, marginBottom: 12 }}>
              Pregunta {neighborhood.qid} — top {neighborhood.neighbors.length} sucesores:
            </p>
            {neighborhood.neighbors.length === 0 ? (
              <p style={{ color: c.textDim }}>Sin sucesores encontrados para esta pregunta.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: c.textMuted, borderBottom: `1px solid ${c.border}` }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>Pregunta B</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px' }}>Transiciones</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px' }}>P(B|A)</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px' }}>P(correcta)</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>Dif.</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>Tema</th>
                  </tr>
                </thead>
                <tbody>
                  {neighborhood.neighbors.map((n, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${c.borderSub}`, color: c.text }}>
                      <td style={{ padding: '6px 12px', color: '#60a5fa', fontWeight: 600 }}>#{n.question_id}</td>
                      <td style={{ textAlign: 'right', padding: '6px 12px' }}>{n.n_transitions}</td>
                      <td style={{ textAlign: 'right', padding: '6px 12px' }}>{(n.p_transition * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: 'right', padding: '6px 12px', color: n.p_correct > 0.6 ? '#34d399' : '#f87171' }}>
                        {(n.p_correct * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <span style={{
                          background: n.dificultad === 1 ? '#166534' : n.dificultad === 2 ? '#1e3a5f' : '#7f1d1d',
                          color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11
                        }}>
                          {n.dificultad === 1 ? 'Fácil' : n.dificultad === 2 ? 'Media' : 'Difícil'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', color: c.textMuted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={n.tema}>{n.tema}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BayesianNetworkTab;
