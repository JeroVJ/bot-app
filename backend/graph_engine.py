"""
Graph-based adaptive question selection engine.
Builds a directed transition graph from quiz session history,
then uses it to select the optimal next question for each student.
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

EPSILON = 0.15
ALPHA = 1.5
MIN_TRANSITIONS = 2
DELTA_MAP = {1: -0.7, 2: 0.0, 3: 0.7}


class QuizGraph:
    def __init__(self):
        self.G = None
        self._node_count = 0
        self._edge_count = 0
        self._built_from_n_answers = 0

    def build(self, db, Question, QuizSession, Answer):
        """Build transition graph from all completed sessions in DB."""
        if not NETWORKX_AVAILABLE:
            print("networkx not available, skipping graph build")
            return False

        answers = (
            db.session.query(Answer)
            .join(QuizSession)
            .filter(QuizSession.status == 'completed')
            .order_by(Answer.session_id, Answer.answered_at, Answer.id)
            .all()
        )

        if len(answers) < 20:
            print(f"Not enough data to build graph ({len(answers)} answers, need >= 20)")
            return False

        transitions = defaultdict(lambda: {'n': 0, 'n_correct': 0})
        sessions_map = defaultdict(list)
        for a in answers:
            sessions_map[a.session_id].append(a)

        for session_answers in sessions_map.values():
            for i in range(len(session_answers) - 1):
                a = session_answers[i]
                b = session_answers[i + 1]
                key = (a.question_id, b.question_id)
                transitions[key]['n'] += 1
                if b.is_correct:
                    transitions[key]['n_correct'] += 1

        questions = {q.question_id: q for q in Question.query.all()}
        G = nx.DiGraph()

        for qid, q in questions.items():
            G.add_node(qid, tema=q.theme, dificultad=q.difficulty, semana=q.week)

        out_totals = defaultdict(int)
        for (a, b), data in transitions.items():
            if data['n'] >= MIN_TRANSITIONS:
                out_totals[a] += data['n']

        for (a, b), data in transitions.items():
            if data['n'] < MIN_TRANSITIONS:
                continue
            if a not in G or b not in G:
                continue
            p_correct = data['n_correct'] / data['n']
            p_transition = data['n'] / out_totals[a] if out_totals[a] > 0 else 0
            G.add_edge(a, b,
                       n_transitions=data['n'],
                       n_correct=data['n_correct'],
                       p_correct=round(p_correct, 4),
                       p_transition=round(p_transition, 4))

        self.G = G
        self._node_count = G.number_of_nodes()
        self._edge_count = G.number_of_edges()
        self._built_from_n_answers = len(answers)
        print(f"Graph built: {self._node_count} nodes, {self._edge_count} edges from {len(answers)} answers")
        return True

    def get_next_question(self, last_qid, asked_ids, available_qids, performance=0.5):
        asked_set = set(asked_ids)
        remaining = [q for q in available_qids if q not in asked_set]
        if not remaining:
            return None

        p = max(0.05, min(0.95, performance))
        theta = float(np.clip(np.log(p / (1 - p)), -2.5, 2.5))

        if random.random() < EPSILON or self.G is None:
            return self._pick_by_difficulty(remaining, theta)

        if last_qid and last_qid in self.G:
            successors = [
                (v, data)
                for _, v, data in self.G.out_edges(last_qid, data=True)
                if v in remaining
            ]
            if successors:
                scored = []
                for qid, edge_data in successors:
                    d = self.G.nodes[qid].get('dificultad', 2)
                    delta = DELTA_MAP.get(d, 0.0)
                    p_can_solve = 1.0 / (1.0 + np.exp(-ALPHA * (theta - delta)))
                    p_trans = edge_data.get('p_transition', 0.0)
                    scored.append((qid, p_trans * p_can_solve))
                scored.sort(key=lambda x: x[1], reverse=True)
                return scored[0][0]

        return self._pick_by_difficulty(remaining, theta)

    def _pick_by_difficulty(self, candidates, theta):
        if not candidates:
            return None
        if self.G is None:
            return random.choice(candidates)
        target_diff = 1 if theta < -0.5 else (3 if theta > 0.5 else 2)
        for diff in [target_diff, target_diff - 1, target_diff + 1, 1, 2, 3]:
            matching = [q for q in candidates if self.G.nodes.get(q, {}).get('dificultad') == diff]
            if matching:
                return random.choice(matching)
        return random.choice(candidates)

    def get_status(self):
        return {
            'built': self.G is not None,
            'nodes': self._node_count,
            'edges': self._edge_count,
            'answers_used': self._built_from_n_answers,
        }

    def get_viz_data(self, max_edges=800):
        if not self.G:
            return {'nodes': [], 'edges': [], 'total_edges': 0}
        nodes = [
            {'id': n, 'tema': data.get('tema', ''), 'dificultad': data.get('dificultad', 1), 'semana': data.get('semana', 0)}
            for n, data in self.G.nodes(data=True)
        ]
        all_edges = [
            {'source': u, 'target': v, 'n_transitions': data.get('n_transitions', 0),
             'p_correct': data.get('p_correct', 0), 'p_transition': data.get('p_transition', 0)}
            for u, v, data in self.G.edges(data=True)
        ]
        all_edges.sort(key=lambda e: e['n_transitions'], reverse=True)
        return {'nodes': nodes, 'edges': all_edges[:max_edges], 'total_edges': len(all_edges)}

    def get_topic_graph(self):
        if not self.G:
            return {'nodes': [], 'edges': []}
        topic_transitions = defaultdict(lambda: {'n': 0, 'n_correct': 0})
        topic_sizes = defaultdict(int)
        for n, data in self.G.nodes(data=True):
            t = data.get('tema')
            if t:
                topic_sizes[t] += 1
        for u, v, data in self.G.edges(data=True):
            tu = self.G.nodes[u].get('tema')
            tv = self.G.nodes[v].get('tema')
            if tu and tv:
                topic_transitions[(tu, tv)]['n'] += data.get('n_transitions', 0)
                topic_transitions[(tu, tv)]['n_correct'] += data.get('n_correct', 0)
        nodes = [{'id': t, 'size': topic_sizes[t]} for t in sorted(topic_sizes)]
        edges = [
            {'source': tu, 'target': tv, 'n_transitions': d['n'],
             'p_correct': round(d['n_correct'] / d['n'], 3) if d['n'] > 0 else 0}
            for (tu, tv), d in topic_transitions.items() if d['n'] > 0
        ]
        return {'nodes': nodes, 'edges': edges}

    def get_transition_matrix(self):
        if not self.G:
            return {'matrix': [], 'labels': []}
        diffs = sorted(set(
            data.get('dificultad') for _, data in self.G.nodes(data=True)
            if data.get('dificultad') is not None
        ))
        counts = defaultdict(lambda: defaultdict(int))
        for u, v, data in self.G.edges(data=True):
            du = self.G.nodes[u].get('dificultad')
            dv = self.G.nodes[v].get('dificultad')
            if du is not None and dv is not None:
                counts[du][dv] += data.get('n_transitions', 0)
        matrix = []
        for d_from in diffs:
            total = sum(counts[d_from].values())
            row = [round(counts[d_from][d_to] / total, 3) if total > 0 else 0 for d_to in diffs]
            matrix.append(row)
        return {'matrix': matrix, 'labels': [str(d) for d in diffs]}

    def get_topic_stats(self):
        if not self.G:
            return []
        topics = defaultdict(list)
        for n, data in self.G.nodes(data=True):
            t = data.get('tema')
            if t:
                topics[t].append(n)
        stats = []
        for tema, nodes in topics.items():
            subG = self.G.subgraph(nodes)
            n_nodes = subG.number_of_nodes()
            n_edges = subG.number_of_edges()
            density = nx.density(subG) if n_nodes > 1 else 0
            p_corrects = [d.get('p_correct', 0) for _, _, d in subG.edges(data=True)]
            avg_p_correct = round(float(np.mean(p_corrects)), 3) if p_corrects else 0
            stats.append({'tema': tema, 'n_nodes': n_nodes, 'n_edges': n_edges,
                          'density': round(float(density), 4), 'avg_p_correct': avg_p_correct})
        stats.sort(key=lambda x: x['density'], reverse=True)
        return stats

    def get_node_neighborhood(self, question_id, top_k=10):
        if not self.G or question_id not in self.G:
            return []
        neighbors = [
            {'question_id': v, 'n_transitions': data.get('n_transitions', 0),
             'p_transition': data.get('p_transition', 0), 'p_correct': data.get('p_correct', 0),
             'dificultad': self.G.nodes[v].get('dificultad'), 'tema': self.G.nodes[v].get('tema')}
            for _, v, data in self.G.out_edges(question_id, data=True)
        ]
        neighbors.sort(key=lambda x: x['p_transition'], reverse=True)
        return neighbors[:top_k]


quiz_graph = QuizGraph()
