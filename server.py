import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR / "frontend"

SKELETON_FILE = DATA_DIR / "grammar_skeleton.json"
MAP_FILE = DATA_DIR / "knowledge_map.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"
FLASHCARDS_FILE = DATA_DIR / "flashcards.json"

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def init_data():
    """Initialize data files from skeleton if they don't exist."""
    if not MAP_FILE.exists():
        shutil.copy(SKELETON_FILE, MAP_FILE)
    if not SESSIONS_FILE.exists():
        save_json(SESSIONS_FILE, [])
    if not FLASHCARDS_FILE.exists():
        save_json(FLASHCARDS_FILE, [])


init_data()


def get_node_ids() -> list[str]:
    data = load_json(MAP_FILE, {"nodes": [], "edges": []})
    return [n["id"] for n in data["nodes"]]


SYSTEM_PROMPT = """You are a Dutch language tutor helping a native Chinese speaker with strong English skills learn Dutch using the Delft method.

When answering:
1. Always bridge the Dutch concept to English first, then note Chinese parallels or differences.
2. Be concise but use concrete examples with translations.
3. Structure explanations so they reduce memorization — connect to what the student already knows.

After your answer, you MUST append a knowledge update block in this EXACT format (valid JSON only):
<knowledge_update>
{{
  "nodes_touched": ["node_id_1", "node_id_2"],
  "summary": "One sentence: what was learned and why it matters.",
  "flashcard": {{
    "front": "Short question or prompt testing this concept",
    "back": "Concise answer with example"
  }}
}}
</knowledge_update>

Available node IDs (Dutch grammar taxonomy): {node_ids}

Only reference node IDs from the list above. If a concept doesn't match any node, use the closest parent node."""


class ChatMessage(BaseModel):
    message: str
    history: list[dict] = []
    image: Optional[str] = None        # base64-encoded image
    image_type: Optional[str] = None   # e.g. "image/jpeg"


class FlashcardReview(BaseModel):
    confidence: int  # 1-5


@app.get("/")
def index():
    return FileResponse(
        FRONTEND_DIR / "index.html",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/map")
def get_map():
    return load_json(MAP_FILE, {"nodes": [], "edges": []})


@app.get("/api/sessions")
def get_sessions():
    return load_json(SESSIONS_FILE, [])


@app.get("/api/cards")
def get_cards():
    """Knowledge cards: one per user question, paired with answer + nodes."""
    sessions = load_json(SESSIONS_FILE, [])
    cards = []
    for i, msg in enumerate(sessions):
        if msg.get("role") != "user":
            continue
        answer_preview = ""
        nodes = []
        if i + 1 < len(sessions) and sessions[i + 1].get("role") == "assistant":
            nxt = sessions[i + 1]
            raw = nxt.get("content", "")
            # Strip markdown for preview
            import re
            plain = re.sub(r"[#*`_\[\]()]", "", raw)
            answer_preview = plain.strip()[:180]
            nodes = nxt.get("nodes_updated", [])
        cards.append({
            "question": msg.get("content", ""),
            "answer_preview": answer_preview,
            "nodes": nodes,
            "date": msg.get("timestamp", ""),
        })
    return {"cards": list(reversed(cards))}  # newest first


@app.get("/api/flashcards")
def get_flashcards():
    return load_json(FLASHCARDS_FILE, [])


@app.post("/api/chat")
def chat(body: ChatMessage):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_api_key_here":
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY not configured. Please set it in your .env file.")

    node_ids = get_node_ids()
    system = SYSTEM_PROMPT.format(node_ids=", ".join(node_ids))

    messages = []
    for msg in body.history[-20:]:  # keep last 20 messages for context
        messages.append({"role": msg["role"], "content": msg["content"]})
    # Build user content — text only, or text + image
    if body.image:
        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": body.image_type or "image/jpeg",
                    "data": body.image,
                },
            },
            {"type": "text", "text": body.message or "What does this say? Help me understand the Dutch."},
        ]
    else:
        user_content = body.message
    messages.append({"role": "user", "content": user_content})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system,
        messages=messages,
    )

    full_text = response.content[0].text

    # Parse knowledge_update block
    answer = full_text
    nodes_updated = []
    new_flashcard = None

    if "<knowledge_update>" in full_text and "</knowledge_update>" in full_text:
        start = full_text.index("<knowledge_update>") + len("<knowledge_update>")
        end = full_text.index("</knowledge_update>")
        update_json = full_text[start:end].strip()
        answer = full_text[:full_text.index("<knowledge_update>")].strip()

        try:
            update = json.loads(update_json)
            nodes_touched = update.get("nodes_touched", [])
            summary = update.get("summary", "")
            fc_data = update.get("flashcard")

            # Update knowledge map
            kmap = load_json(MAP_FILE, {"nodes": [], "edges": []})
            now = datetime.now().isoformat()

            for node in kmap["nodes"]:
                if node["id"] in nodes_touched:
                    node["last_visited"] = now
                    node["questions_asked"].append({
                        "question": body.message,
                        "summary": summary,
                        "date": now
                    })
                    nodes_updated.append(node["id"])

            save_json(MAP_FILE, kmap)

            # Save flashcard
            if fc_data and fc_data.get("front") and fc_data.get("back"):
                flashcards = load_json(FLASHCARDS_FILE, [])
                fc_id = f"fc_{len(flashcards)+1}_{int(datetime.now().timestamp())}"
                new_card = {
                    "id": fc_id,
                    "front": fc_data["front"],
                    "back": fc_data["back"],
                    "category": nodes_touched[0] if nodes_touched else "other",
                    "created": now,
                    "confidence": 0,
                    "review_count": 0
                }
                flashcards.append(new_card)
                save_json(FLASHCARDS_FILE, flashcards)
                new_flashcard = new_card

        except (json.JSONDecodeError, ValueError):
            pass  # knowledge update parsing failed, still return the answer

    # Save session
    sessions = load_json(SESSIONS_FILE, [])
    sessions.append({
        "role": "user",
        "content": body.message,
        "timestamp": datetime.now().isoformat()
    })
    sessions.append({
        "role": "assistant",
        "content": answer,
        "timestamp": datetime.now().isoformat(),
        "nodes_updated": nodes_updated
    })
    save_json(SESSIONS_FILE, sessions)

    return {
        "answer": answer,
        "nodes_updated": nodes_updated,
        "new_flashcard": new_flashcard
    }


@app.post("/api/flashcards/{fc_id}/review")
def review_flashcard(fc_id: str, body: FlashcardReview):
    flashcards = load_json(FLASHCARDS_FILE, [])
    for fc in flashcards:
        if fc["id"] == fc_id:
            fc["confidence"] = body.confidence
            fc["review_count"] = fc.get("review_count", 0) + 1
            fc["last_reviewed"] = datetime.now().isoformat()
            save_json(FLASHCARDS_FILE, flashcards)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Flashcard not found")


@app.post("/api/exercises/generate")
def generate_exercises():
    """Generate fill-in-blank exercises from visited nodes."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_api_key_here":
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY not configured.")

    kmap = load_json(MAP_FILE, {"nodes": [], "edges": []})
    visited_nodes = [n for n in kmap["nodes"] if n.get("questions_asked")]

    if not visited_nodes:
        return {"exercises": []}

    topics = [f"{n['label']}: {n['description'][:80]}" for n in visited_nodes[:10]]
    topics_text = "\n".join(topics)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        messages=[{
            "role": "user",
            "content": f"""Generate 5 fill-in-the-blank Dutch exercises based on these grammar topics the student has studied:

{topics_text}

Return ONLY valid JSON in this format:
{{
  "exercises": [
    {{
      "sentence": "Dutch sentence with ___ for the blank",
      "answer": "the missing word(s)",
      "hint": "brief hint in English",
      "topic": "node_id"
    }}
  ]
}}"""
        }]
    )

    try:
        text = response.content[0].text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return {"exercises": []}


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
