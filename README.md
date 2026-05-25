# Dutch Tutor 🇳🇱

A personal Dutch-learning companion that lives in your macOS menu bar. Ask grammar questions in plain English, get explanations bridged through English (with Chinese parallels where helpful), and watch a knowledge graph of what you've learned grow as you study.

Powered by Claude via the Anthropic API.

## Features

- **Menu bar app** — click the 🇳🇱 icon to open or minimize the tutor window. No Dock icon, no clutter.
- **Conversational Q&A** — ask anything about Dutch grammar, vocabulary, or usage. Supports image input (e.g. snap a photo of a textbook page).
- **Knowledge map** — an interactive D3 graph of Dutch grammar topics. Nodes light up as you explore them.
- **Cards view** — a scrollable history of every question you've asked, with the answer preview and tagged topics.
- **Flashcards** — every answer automatically generates a flashcard. Review them with confidence-based feedback (Again / Hard / Good / Easy).
- **Fill-in-blank exercises** — generate practice exercises from topics you've studied.

## Stack

- **`app.py`** — PyObjC menu bar shell + WKWebView window
- **`server.py`** — FastAPI backend, calls the Anthropic API, persists state as JSON
- **`frontend/`** — vanilla JS + D3 single-page UI
- **`data/`** — grammar taxonomy (`grammar_skeleton.json`) and your evolving knowledge map

## Setup

Requires Python 3 and macOS.

```bash
./setup.sh
```

The script creates a virtualenv, installs dependencies, and prompts for your Anthropic API key (saved to `.env`). Get a key at [console.anthropic.com](https://console.anthropic.com).

## Run

```bash
source .venv/bin/activate && python app.py
```

The 🇳🇱 icon appears in your menu bar — click to toggle the window.

## Notes

The tutor's system prompt is tuned for a native Chinese speaker with strong English. You can adjust it in `server.py` if your background is different.
