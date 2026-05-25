# Dutch Tutor 🇳🇱

A personal Dutch-learning companion that lives in your macOS menu bar. Ask grammar questions in plain English, get explanations bridged through English (with Chinese parallels where helpful), and watch a knowledge graph of what you've learned grow as you study.

Powered by Claude via the Anthropic API.

## Features

- **Menu bar app** — click the 🇳🇱 icon to open or minimize the tutor window. No Dock icon, no clutter.
- **Conversational Q&A** — ask anything about Dutch grammar, vocabulary, or usage. Supports image input (e.g. snap a photo of a textbook page).
- **Knowledge map** — an interactive D3 graph of Dutch grammar topics. Nodes light up as you explore them.
- **Cards view** — a scrollable history of every question you've asked, with the answer preview and tagged topics.
- **Flashcards** — every answer automatically generates a flashcard. Review with confidence-based feedback (Again / Hard / Good / Easy).
- **Fill-in-blank exercises** — generate practice exercises from topics you've studied.

## Stack

- **`app.py`** — PyObjC menu bar shell + WKWebView window
- **`server.py`** — FastAPI backend, calls the Anthropic API, persists state as JSON
- **`frontend/`** — vanilla JS + D3 single-page UI
- **`data/grammar_skeleton.json`** — Dutch grammar taxonomy (the starting point; your personal `knowledge_map.json`, `sessions.json`, and `flashcards.json` are created locally on first run and are gitignored)

## Prerequisites

- **macOS** — the menu bar shell uses PyObjC and WKWebView. The FastAPI server alone runs anywhere (see "Cross-platform" below), but the menu bar app does not.
- **Python 3.10+**
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

## Quick start

```bash
git clone https://github.com/yong-mahalo/dutch-learning.git
cd dutch-learning
./setup.sh
```

`setup.sh` creates a virtualenv, installs dependencies, and prompts for your API key (saved to `.env`). Then:

```bash
source .venv/bin/activate
python app.py
```

The 🇳🇱 icon appears in your menu bar — click to toggle the window.

## Manual setup

If you'd rather not run the script:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your ANTHROPIC_API_KEY
python app.py
```

## Cross-platform (server only)

On Linux or Windows, the macOS shell won't install, but the FastAPI backend works on its own. Skip pyobjc and run the server directly:

```bash
python3 -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install fastapi uvicorn anthropic python-dotenv
cp .env.example .env       # add your key
uvicorn server:app --host 127.0.0.1 --port 8765
```

Then open <http://127.0.0.1:8765> in any browser — you get the same UI without the menu bar wrapper.

## How your data is stored

The first time you run the server, it creates these in `data/` (all gitignored):
- `knowledge_map.json` — copied from `grammar_skeleton.json`, then updated as you study
- `sessions.json` — full chat history with timestamps
- `flashcards.json` — auto-generated cards from each answer

To reset progress, delete those three files and restart the server.

## Customizing the tutor

The system prompt in `server.py` is tuned for a native Chinese speaker with strong English. If your background differs, edit the `SYSTEM_PROMPT` constant — the "English bridge first, Chinese parallels second" wording is the part to change.
