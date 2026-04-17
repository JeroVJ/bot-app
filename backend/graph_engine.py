"""
Graph-based question selection engine.

The question graph is built from the QuestionTransition and QuestionOutStats
tables, which store purely statistical transition counts accumulated from
simulated (or real) quiz sessions.

Each directed edge  Y → X  carries:
  - p_transition : P(X | Y)  = total_transiciones(Y→X) / total_salidas(Y)
  - p_correct    : P(correct at X | came from Y)
                             = total_correctas(Y→X)   / total_transiciones(Y→X)
  - n_transitions, n_correct : raw counts

No IRT, no difficulty modelling — all selection is based on these statistics.
"""
import random
import numpy as np
from collections import defaultdict

try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False
    print("WARNING: networkx not installed. pip install networkx numpy")

# Minimum number of observed transitions for an edge to be included in the graph
MIN_TRANSITIONS = 2

# Epsilon-greedy exploration probability
EPSILON = 0.15

# Weight for p_correct when scoring candidate next questions
# score = W_TRANS * p_transition + W_CORR * p_correct
W_TRANS = 0.70
W_CORR  = 0.30


class QuizGraph:
    def __init__(self):
        self.G = None
        self._node_count = 0
        self._edge_count = 0
        self._transition_rows_used = 0

    # ------------------------------------------------------------------
    # Build
    # ------------------------------------------------------------------

    def build(self, db, Question, QuizSession=None, Answer=None):
        """
        Build the question graph from QuestionTransition / QuestionOutStats tables.

        Parameters QuizSession and Answer are kept for API compatibility but
        are no longer needed — the transition tables are the source of truth.
        """
        if not NETWORKX_AVAILABLE:
            print("networkx not available, skipping graph build")
            return False

        from models import QuestionTransition, QuestionOutStats

        transitions = QuestionTransition.query.all()
        if len(transitions) < MIN_TRANSITIONS:
            print(f"Not enough transition data ({len(transitions)} rows, "
                  f"need >= {MIN_TRANSITIONS}). Run seed-simulation first.")
            return False

        # Build a fast lookup: question_id → total_salidas
        out_stats = {
            row.question_id: row.total_salidas
            for row in QuestionOutStats.query.all()
        }

        # Load question metadata for node attributes
        questions = {q.question_id: q for q in Question.query.all()}

        G = nx.DiGraph()
        for qid, q in questions.items():
            G.add_node(qid, tema=q.theme, dificultad=q.difficulty, semana=q.week)

        edges_added = 0
        for t in transitions:
            if t.total_transiciones < MIN_TRANSITIONS:
                continue
            y = t.question_from_id
            x = t.question_to_id
            if y not in G or x not in G:
                continue

            total_salidas = out_stats.get(y, 0)
            p_transition  = (t.total_transiciones / total_salidas
                             if total_salidas > 0 else 0.0)
            p_correct     = (t.total_correctas / t.total_transiciones
                             if t.total_transiciones > 0 else 0.0)

            G.add_edge(
                y, x,
                n_transitions = t.total_transiciones,
                n_correct     = t.total_correctas,
                p_transition  = round(p_transition, 4),
                p_correct     = round(p_correct, 4),
            )
            edges_added += 1

        self.G = G
        self._node_count = G.number_of_nodes()
        self._edge_count = G.number_of_edges()
        self._transition_rows_used = len(transitions)
        print(f"Graph built: {self._node_count} nodes, {self._edge_count} edges "
              f"from {self._transition_rows_used} transition rows.")
        return True

    # ------------------------------------------------------------------
    # Next-question selection (no IRT)
    # ------------------------------------------------------------------

    def get_next_question(self, last_qid, asked_ids, available_qids, performance=0.5):
        """
        Select the next question to present.

        Strategy:
          1. With probability EPSILON  → random choice (exploration)
          2. If last_qid has outgoing edges in the graph:
               score each candidate = W_TRANS * p_transition + W_CORR * p_correct
               return the highest-scored candidate not yet asked
          3. Fallback → random choice from remaining questions
        """
        asked_set = set(asked_ids)
        remaining = [q for q in available_qids if q not in asked_set]
        if not remaining:
            return None

        # Exploration
        if random.random() < EPSILON or self.G is None:
            return random.choice(remaining)

        # Graph-guided selection
        if last_qid and last_qid in self.G:
            successors = [
                (v, data)
                for _, v, data in self.G.out_edges(last_qid, data=True)
                if v in remaining
            ]
            if successors:
                scored = [
                    (qid, W_TRANS * d.get('p_transition', 0.0)
                          + W_CORR  * d.get('p_correct',    0.0))
                    for qid, d in successors
                ]
                scored.sort(key=lambda x: x[1], reverse=True)
                return scored[0][0]

        # Fallback
        return random.choice(remaining)

    # ------------------------------------------------------------------
    # Status / introspection
    # ------------------------------------------------------------------

    def get_status(self):
        return {
            'built':               self.G is not None,
            'nodes':               self._node_count,
            'edges':               self._edge_count,
            'transition_rows_used': self._transition_rows_used,
        }

    # ------------------------------------------------------------------
    # Visualization helpers (unchanged API)
    # ------------------------------------------------------------------

    def get_viz_data(self, max_edges=800):
        if not self.G:
            return {'nodes': [], 'edges': [], 'total_edges': 0}

        nodes = [
            {'id': n, 'tema': d.get('tema', ''),
             'dificultad': d.get('dificultad', 1), 'semana': d.get('semana', 0)}
            for n, d in self.G.nodes(data=True)
        ]
        all_edges = [
            {'source': u, 'target': v,
             'n_transitions': d.get('n_transitions', 0),
             'n_correct':     d.get('n_correct', 0),
             'p_correct':     d.get('p_correct', 0),
             'p_transition':  d.get('p_transition', 0)}
            for u, v, d in self.G.edges(data=True)
        ]
        all_edges.sort(key=lambda e: e['n_transitions'], reverse=True)
        return {'nodes': nodes, 'edges': all_edges[:max_edges], 'total_edges': len(all_edges)}

    def get_topic_graph(self):
        if not self.G:
            return {'nodes': [], 'edges': []}

        topic_agg  = defaultdict(lambda: {'n': 0, 'n_correct': 0})
        topic_sizes = defaultdict(int)

        for n, d in self.G.nodes(data=True):
            t = d.get('tema')
            if t:
                topic_sizes[t] += 1

        for u, v, d in self.G.edges(data=True):
            tu = self.G.nodes[u].get('tema')
            tv = self.G.nodes[v].get('tema')
            if tu and tv:
                topic_agg[(tu, tv)]['n']         += d.get('n_transitions', 0)
                topic_agg[(tu, tv)]['n_correct'] += d.get('n_correct', 0)

        nodes = [{'id': t, 'size': topic_sizes[t]} for t in sorted(topic_sizes)]
        edges = [
            {'source': tu, 'target': tv,
             'n_transitions': agg['n'],
             'p_correct': round(agg['n_correct'] / agg['n'], 3) if agg['n'] > 0 else 0}
            for (tu, tv), agg in topic_agg.items() if agg['n'] > 0
        ]
        return {'nodes': nodes, 'edges': edges}

    def get_transition_matrix(self):
        if not self.G:
            return {'matrix': [], 'labels': []}

        diffs = sorted(set(
            d.get('dificultad') for _, d in self.G.nodes(data=True)
            if d.get('dificultad') is not None
        ))
        counts = defaultdict(lambda: defaultdict(int))
        for u, v, d in self.G.edges(data=True):
            du = self.G.nodes[u].get('dificultad')
            dv = self.G.nodes[v].get('dificultad')
            if du is not None and dv is not None:
                counts[du][dv] += d.get('n_transitions', 0)

        matrix = []
        for d_from in diffs:
            total = sum(counts[d_from].values())
            row = [
                round(counts[d_from][d_to] / total, 3) if total > 0 else 0
                for d_to in diffs
            ]
            matrix.append(row)
        return {'matrix': matrix, 'labels': [str(d) for d in diffs]}

    def get_topic_stats(self):
        if not self.G:
            return []

        topics = defaultdict(list)
        for n, d in self.G.nodes(data=True):
            t = d.get('tema')
            if t:
                topics[t].append(n)

        stats = []
        for tema, nodes in topics.items():
            subG    = self.G.subgraph(nodes)
            n_nodes = subG.number_of_nodes()
            n_edges = subG.number_of_edges()
            density = nx.density(subG) if n_nodes > 1 else 0
            p_corrects = [d.get('p_correct', 0) for _, _, d in subG.edges(data=True)]
            avg_p_correct = round(float(np.mean(p_corrects)), 3) if p_corrects else 0
            stats.append({
                'tema': tema, 'n_nodes': n_nodes, 'n_edges': n_edges,
                'density': round(float(density), 4), 'avg_p_correct': avg_p_correct,
            })
        stats.sort(key=lambda x: x['density'], reverse=True)
        return stats

    def get_node_neighborhood(self, question_id, top_k=10):
        if not self.G or question_id not in self.G:
            return []

        neighbors = [
            {'question_id': v,
             'n_transitions': d.get('n_transitions', 0),
             'n_correct':     d.get('n_correct', 0),
             'p_transition':  d.get('p_transition', 0),
             'p_correct':     d.get('p_correct', 0),
             'dificultad':    self.G.nodes[v].get('dificultad'),
             'tema':          self.G.nodes[v].get('tema')}
            for _, v, d in self.G.out_edges(question_id, data=True)
        ]
        neighbors.sort(key=lambda x: x['p_transition'], reverse=True)
        return neighbors[:top_k]

    def get_question_network(self, week=None, tema=None, difficulty=None, max_edges=2000):
        if not self.G:
            return {'nodes': [], 'edges': [], 'total_nodes': 0, 'total_edges': 0}

        filtered = [
            n for n, d in self.G.nodes(data=True)
            if (week       is None or d.get('semana')     == week)
            and (tema      is None or d.get('tema')       == tema)
            and (difficulty is None or d.get('dificultad') == difficulty)
        ]
        filtered_set = set(filtered)

        nodes = [
            {'id': n,
             'tema':      self.G.nodes[n].get('tema', ''),
             'dificultad': self.G.nodes[n].get('dificultad', 1),
             'semana':    self.G.nodes[n].get('semana', 0),
             'degree':    self.G.degree(n)}
            for n in filtered
        ]
        all_edges = [
            {'source': u, 'target': v,
             'n_transitions': d.get('n_transitions', 0),
             'n_correct':     d.get('n_correct', 0),
             'p_correct':     d.get('p_correct', 0),
             'p_transition':  d.get('p_transition', 0)}
            for u, v, d in self.G.edges(data=True)
            if u in filtered_set and v in filtered_set
        ]
        all_edges.sort(key=lambda e: e['n_transitions'], reverse=True)

        return {
            'nodes':       nodes,
            'edges':       all_edges[:max_edges],
            'total_nodes': len(nodes),
            'total_edges': len(all_edges),
        }


# Module-level singleton used by routes and quiz engine
quiz_graph = QuizGraph()
