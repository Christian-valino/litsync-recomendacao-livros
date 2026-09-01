"""
nlp.py — Funções de pré-processamento de texto (PLN).

Pipeline:
    1. Lowercase
    2. Remove pontuação e números
    3. Tokenização
    4. Remoção de stopwords (PT + EN)
    5. Stemming (RSLP para PT, Snowball para EN)
    6. Remove tokens curtos (< 3 chars)
"""

import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import RSLPStemmer, SnowballStemmer

# Downloads necessários apenas na primeira execução
nltk.download('stopwords',  quiet=True)
nltk.download('punkt',      quiet=True)
nltk.download('punkt_tab',  quiet=True)
nltk.download('rslp',       quiet=True)

# ── Configuração global ────────────────────────────────────
_stop_pt    = set(stopwords.words('portuguese'))
_stop_en    = set(stopwords.words('english'))
STOPWORDS   = _stop_pt | _stop_en

_stemmer_pt = RSLPStemmer()
_stemmer_en = SnowballStemmer('english')

_REGEX_LIMPA = re.compile(r'[^a-záàâãéêíóôõúüçñ ]')


def preprocessar(texto: str) -> str:
    """
    Recebe um texto bruto e retorna uma string de tokens processados,
    separados por espaço, pronta para uso no TF-IDF.

    Args:
        texto: Texto de entrada (sinopse ou descrição musical).

    Returns:
        String com stems separados por espaço. Retorna '' se inválido.
    """
    if not isinstance(texto, str) or not texto.strip():
        return ''

    # 1. Lowercase
    texto = texto.lower()

    # 2. Remove caracteres não-alfabéticos (exceto acentos)
    texto = _REGEX_LIMPA.sub(' ', texto)

    # 3. Tokeniza
    tokens = word_tokenize(texto)

    # 4. Remove stopwords e tokens curtos
    tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 2]

    # 5. Stemming — tenta PT, fallback EN
    stems = []
    for token in tokens:
        try:
            stems.append(_stemmer_pt.stem(token))
        except Exception:
            stems.append(_stemmer_en.stem(token))

    return ' '.join(stems)
