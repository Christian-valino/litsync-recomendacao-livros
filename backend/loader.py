"""
loader.py — Carrega os artefatos de ML (CSVs + pickles) uma única vez na inicialização.
"""

import os
import pickle
import pandas as pd

# Caminho base para a pasta dados (relativo ao backend/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS_DIR = os.path.join(BASE_DIR, 'dados')


def _pkl(nome: str):
    path = os.path.join(DADOS_DIR, nome)
    with open(path, 'rb') as f:
        return pickle.load(f)


def _csv(nome: str) -> pd.DataFrame:
    return pd.read_csv(os.path.join(DADOS_DIR, nome))


def carregar_tudo():
    """
    Retorna um dict com todos os artefatos carregados.
    Levanta FileNotFoundError se algum arquivo estiver faltando.
    """
    print("🔄 Carregando artefatos...")

    artefatos = {
        'df_livros':     _csv('livros_processados.csv'),
        'df_perfis':     _csv('perfis_musicais.csv'),
        'vectorizer':    _pkl('vectorizer.pkl'),
        'matriz_livros': _pkl('matriz_livros.pkl'),
        'matriz_perfis': _pkl('matriz_perfis.pkl'),
    }

    n_livros = len(artefatos['df_livros'])
    n_perfis = len(artefatos['df_perfis'])
    vocab    = len(artefatos['vectorizer'].vocabulary_)

    print(f"✅ {n_livros:,} livros | {n_perfis} perfis | {vocab:,} termos no vocabulário")
    return artefatos
