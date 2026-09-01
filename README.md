# 📚 LitSync — Recomendação de Livros por Perfil Musical

**Bruno Silva & Christian Valino**  
Projeto PLN — Processamento de Linguagem Natural

---

## Sobre o projeto

O LitSync é um sistema de recomendação de livros baseado em perfil musical.  
Ele usa **TF-IDF** e **Similaridade Cosseno** para encontrar livros cujas sinopses
se assemelham semanticamente às descrições musicais dos usuários.

### Pipeline
```
Perfil Musical → Pré-processamento → Vetorização TF-IDF → Cosine Similarity → Top-10 Livros
```

---

## Estrutura do projeto

```
ProjetoPNL/
├── backend/
│   ├── app.py          # API Flask (rotas REST)
│   ├── nlp.py          # Funções de pré-processamento PLN
│   └── loader.py       # Carregamento dos artefatos
├── frontend/
│   ├── index.html      # Interface principal
│   ├── css/
│   │   └── style.css   # Estilos
│   └── js/
│       └── main.js     # Lógica do frontend
├── dados/              # CSVs e arquivos .pkl gerados nos notebooks
├── requirements.txt
└── README.md
```

---

## Como rodar

### 1. Instalar dependências
```bash
pip install -r requirements.txt
```

### 2. Iniciar a API
```bash
cd backend
python app.py
```
API disponível em: `http://localhost:5000`

### 3. Abrir o frontend
Em outro terminal:
```bash
cd ..
python -m http.server 8080
```
Acesse: `http://localhost:8080/frontend/index.html`

---

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/stats` | Estatísticas gerais |
| GET | `/perfis` | Lista todos os perfis musicais |
| GET | `/recomendar/<usuario>?top=10` | Top-N livros por perfil |
| POST | `/buscar` | Recomendação por texto livre |

### Exemplo POST /buscar
```json
{
  "texto": "Gosto de músicas intensas com guitarras pesadas como Metallica e Tool",
  "top": 10
}
```

---

## Tecnologias

- **Backend:** Python 3.10+, Flask, NLTK, scikit-learn
- **PLN:** TF-IDF (10k features, bigramas), RSLP Stemmer, Snowball Stemmer
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Dataset:** Goodreads (~45k livros)
