"""
app.py — API Flask do LitSync.

Rotas:
    GET  /stats                        → Estatísticas gerais
    GET  /perfis                       → Lista de perfis musicais
    GET  /recomendar/<usuario>?top=10  → Recomendações por perfil
    POST /buscar                       → Recomendações por texto livre

Uso:
    cd backend
    python app.py
"""

import sys
import os

# Garante que imports relativos funcionem ao rodar de qualquer diretório
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

from loader import carregar_tudo
from nlp import preprocessar
from sklearn.metrics.pairwise import cosine_similarity

# ── Inicialização ──────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Permite chamadas do frontend (localhost:8080 → localhost:5000)

artefatos    = carregar_tudo()
df_livros    = artefatos['df_livros']
df_perfis    = artefatos['df_perfis']
vectorizer   = artefatos['vectorizer']
matriz_livros = artefatos['matriz_livros']
matriz_perfis = artefatos['matriz_perfis']


# ── Helpers ────────────────────────────────────────────────

def _serializar_livros(indices, scores) -> list:
    """Converte índices + scores em lista de dicts serializável."""
    resultado = []
    for posicao, (idx, score) in enumerate(zip(indices, scores), start=1):
        row = df_livros.iloc[idx]
        resultado.append({
            'posicao': posicao,
            'titulo':  str(row.get('titulo', '')),
            'autor':   str(row.get('autor',  '')),
            'tema':    str(row.get('tema',   '')),
            'sinopse': str(row.get('sinopse', ''))[:220],
            'score':   round(float(score), 4),
        })
    return resultado


def _top_n(vetor_query, top_n: int) -> tuple:
    """Calcula similaridade cosseno e retorna top-N índices e scores."""
    scores      = cosine_similarity(vetor_query, matriz_livros)[0]
    top_indices = np.argsort(scores)[::-1][:top_n]
    return top_indices, scores[top_indices]


# ── Rotas ──────────────────────────────────────────────────

@app.route('/stats', methods=['GET'])
def stats():
    """Retorna estatísticas gerais do sistema."""
    return jsonify({
        'total_livros':   len(df_livros),
        'total_perfis':   len(df_perfis),
        'vocab_size':     len(vectorizer.vocabulary_),
        'tfidf_features': 10_000,
    })


@app.route('/perfis', methods=['GET'])
def get_perfis():
    """Retorna lista de perfis musicais."""
    perfis = []
    for _, p in df_perfis.iterrows():
        perfis.append({
            'usuario':      p['usuario'],
            'genero':       p['genero_musical'],
            'artistas':     str(p['artistas_favoritos'])[:120],
            'energy':       round(float(p['energy']),       2),
            'valence':      round(float(p['valence']),      2),
            'danceability': round(float(p['danceability']), 2),
        })
    return jsonify(perfis)


@app.route('/recomendar/<usuario>', methods=['GET'])
def recomendar_perfil(usuario: str):
    """Retorna top-N livros para o perfil informado."""
    top_n = min(int(request.args.get('top', 10)), 50)

    idx_list = df_perfis.index[df_perfis['usuario'] == usuario].tolist()
    if not idx_list:
        return jsonify({'erro': f'Usuário "{usuario}" não encontrado.'}), 404

    i = idx_list[0]
    top_indices, top_scores = _top_n(matriz_perfis[i], top_n)

    return jsonify({
        'usuario': usuario,
        'genero':  df_perfis.iloc[i]['genero_musical'],
        'livros':  _serializar_livros(top_indices, top_scores),
    })


@app.route('/buscar', methods=['POST'])
def buscar_livre():
    """Recomendação por descrição textual livre."""
    body  = request.get_json(force=True)
    texto = body.get('texto', '').strip()
    top_n = min(int(body.get('top', 10)), 50)

    if not texto:
        return jsonify({'erro': 'Campo "texto" não pode ser vazio.'}), 400

    processado  = preprocessar(texto)
    vetor       = vectorizer.transform([processado])
    top_indices, top_scores = _top_n(vetor, top_n)

    return jsonify({
        'livros': _serializar_livros(top_indices, top_scores),
    })


# ── Entrypoint ─────────────────────────────────────────────
if __name__ == '__main__':
    print('\n🚀 LitSync API — http://localhost:5000\n')
    app.run(debug=True, port=5000)
