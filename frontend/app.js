// ─── Dutch Tutor App ───────────────────────────────────────────

const API = "";  // same origin

let chatHistory = [];
let flashcards = [];
let currentCardIndex = 0;
let pendingImage = null;      // { base64, type, dataUrl }


// ─── Init ──────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  await loadMap();
  await loadHistory();
  setupTabs();
  setupChat();
  setupDivider();
});

// ─── Map ───────────────────────────────────────────────────────
async function loadMap() {
  try {
    const res = await fetch(`${API}/api/map`);
    const data = await res.json();
    initGraph(data);
    buildLegend(data);
  } catch (e) {
    console.error("Failed to load map:", e);
  }
}

function buildLegend(data) {
  const categories = [...new Set(data.nodes.map(n => n.category))];
  const legend = document.getElementById("map-legend");
  legend.innerHTML = categories.map(c => `
    <span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:11px;color:#8b949e">
      <span style="width:8px;height:8px;border-radius:50%;background:${CATEGORY_COLORS[c]||'#58a6ff'};display:inline-block"></span>
      ${c}
    </span>`).join("");
}

// ─── History ───────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res = await fetch(`${API}/api/sessions`);
    const sessions = await res.json();
    // Render last 40 messages
    const recent = sessions.slice(-40);
    recent.forEach(msg => {
      if (msg.role === "user") {
        appendMessage("user", msg.content);
        chatHistory.push({ role: "user", content: msg.content });
      } else {
        appendMessage("assistant", msg.content, msg.nodes_updated || []);
        chatHistory.push({ role: "assistant", content: msg.content });
      }
    });
    scrollMessages();
  } catch (e) {
    console.error("Failed to load history:", e);
  }
}

// ─── Chat ──────────────────────────────────────────────────────
function setupChat() {
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("send-btn");
  const imageBtn = document.getElementById("image-btn");
  const imageInput = document.getElementById("image-input");
  const removeImage = document.getElementById("remove-image");

  btn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  imageBtn.addEventListener("click", () => imageInput.click());

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(",")[1];
      pendingImage = { base64, type: file.type, dataUrl };
      document.getElementById("image-preview").src = dataUrl;
      document.getElementById("image-preview-wrap").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
    imageInput.value = "";
  });

  removeImage.addEventListener("click", () => {
    pendingImage = null;
    document.getElementById("image-preview-wrap").classList.add("hidden");
    document.getElementById("image-preview").src = "";
  });
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("send-btn");
  const text = input.value.trim();
  if (!text) return;

  const imageToSend = pendingImage;
  input.value = "";
  btn.disabled = true;

  // Clear pending image
  if (pendingImage) {
    pendingImage = null;
    document.getElementById("image-preview-wrap").classList.add("hidden");
    document.getElementById("image-preview").src = "";
  }

  appendMessage("user", text, [], imageToSend?.dataUrl);
  chatHistory.push({ role: "user", content: text });

  const thinking = appendMessage("thinking", "Thinking...");

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(-20),
        image: imageToSend?.base64 || null,
        image_type: imageToSend?.type || null,
      })
    });

    thinking.remove();

    if (!res.ok) {
      const err = await res.json();
      appendMessage("assistant", `⚠️ ${err.detail || "Error communicating with server."}`);
      btn.disabled = false;
      return;
    }

    const data = await res.json();
    appendMessage("assistant", data.answer, data.nodes_updated || []);
    chatHistory.push({ role: "assistant", content: data.answer });

    if (data.nodes_updated && data.nodes_updated.length > 0) {
      await loadMap();
      highlightNodes(data.nodes_updated);
    }

    if (data.new_flashcard) {
      flashcards.push(data.new_flashcard);
      updateFlashcardBadge();
    }

    refreshCardsIfVisible();

  } catch (e) {
    thinking.remove();
    appendMessage("assistant", "⚠️ Could not reach the server. Is it running?");
  }

  btn.disabled = false;
  scrollMessages();
}

function appendMessage(role, content, nodesUpdated = [], imageDataUrl = null) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `message ${role}`;

  if (imageDataUrl) {
    const img = document.createElement("img");
    img.src = imageDataUrl;
    img.style.cssText = "max-width:100%;max-height:160px;border-radius:8px;display:block;margin-bottom:6px;object-fit:cover;";
    div.appendChild(img);
  }

  if (role === "assistant" && typeof marked !== "undefined") {
    const textDiv = document.createElement("div");
    textDiv.innerHTML = marked.parse(content);
    div.appendChild(textDiv);
  } else if (content) {
    const textNode = document.createElement("span");
    textNode.textContent = content;
    div.appendChild(textNode);
  }

  if (nodesUpdated.length > 0) {
    const badgeWrap = document.createElement("div");
    badgeWrap.style.marginTop = "6px";
    nodesUpdated.forEach(id => {
      const badge = document.createElement("span");
      badge.className = "node-badge";
      badge.textContent = id.replace(/_/g, " ");
      badgeWrap.appendChild(badge);
    });
    div.appendChild(badgeWrap);
  }

  container.appendChild(div);
  scrollMessages();
  return div;
}

function scrollMessages() {
  const c = document.getElementById("messages");
  c.scrollTop = c.scrollHeight;
}

// ─── Tabs ──────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => {
        v.classList.remove("active");
        v.classList.add("hidden");
      });
      tab.classList.add("active");
      const viewId = `view-${tab.dataset.tab}`;
      const view = document.getElementById(viewId);
      view.classList.remove("hidden");
      view.classList.add("active");

      if (tab.dataset.tab === "map") {
        renderGraph(graphData);
      } else if (tab.dataset.tab === "flashcards") {
        loadFlashcards();
      } else if (tab.dataset.tab === "cards") {
        loadCards();
      }
    });
  });
}

// ─── Knowledge Cards ───────────────────────────────────────────
async function loadCards() {
  try {
    const res = await fetch(`${API}/api/cards`);
    const data = await res.json();
    renderCards(data.cards || []);
  } catch (e) {
    console.error("Failed to load cards:", e);
  }
}

function renderCards(cards) {
  const grid = document.getElementById("cards-grid");
  const empty = document.getElementById("cards-empty");

  if (cards.length === 0) {
    empty.classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }

  empty.classList.add("hidden");
  grid.innerHTML = cards.map(card => {
    const date = card.date ? new Date(card.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    const nodeColors = { articles:"#7c6af7", nouns:"#4a9eff", verbs:"#f85149", word_order:"#d29922", adjectives:"#3fb950", pronouns:"#e3b341", other:"#58a6ff" };

    const nodeBadges = (card.nodes || []).map(n => {
      // determine category from node id
      const catMap = { articles:"articles", de_het:"articles", indefinite_article:"articles", gender:"articles",
        nouns:"nouns", noun_plurals:"nouns", diminutives:"nouns", compound_nouns:"nouns",
        pronouns:"pronouns", personal_pronouns:"pronouns", object_pronouns:"pronouns", possessive_pronouns:"pronouns",
        verbs:"verbs", infinitive:"verbs", stem_rule:"verbs", present_tense:"verbs", inversion_t_drop:"verbs",
        separable_verbs:"verbs", modal_verbs:"verbs", past_tense_simple:"verbs", past_tense_perfect:"verbs",
        past_participle:"verbs", hebben_vs_zijn:"verbs", zijn_hebben:"verbs",
        word_order:"word_order", v2_rule:"word_order", inversion:"word_order", subordinate_clauses:"word_order", time_manner_place:"word_order",
        adjectives:"adjectives", adjective_inflection:"adjectives", comparative:"adjectives", superlative:"adjectives" };
      const cat = catMap[n] || "other";
      const color = nodeColors[cat] || "#58a6ff";
      return `<span class="kcard-node" style="background:${color}22;color:${color};border:1px solid ${color}44">${n.replace(/_/g," ")}</span>`;
    }).join("");

    return `
      <div class="knowledge-card">
        <div class="kcard-date">${escHtml(date)}</div>
        <div class="kcard-question">${escHtml(card.question)}</div>
        ${card.answer_preview ? `<div class="kcard-preview">${escHtml(card.answer_preview)}</div>` : ""}
        ${nodeBadges ? `<div class="kcard-nodes">${nodeBadges}</div>` : ""}
      </div>`;
  }).join("");
}

// Also refresh cards after each chat message
function refreshCardsIfVisible() {
  const cardsTab = document.getElementById("view-cards");
  if (cardsTab && cardsTab.classList.contains("active")) loadCards();
}

// ─── Flashcards ────────────────────────────────────────────────
async function loadFlashcards() {
  try {
    const res = await fetch(`${API}/api/flashcards`);
    flashcards = await res.json();
    renderFlashcardDeck();
  } catch (e) {
    console.error("Failed to load flashcards:", e);
  }
}

function renderFlashcardDeck() {
  const noCards = document.getElementById("no-flashcards");
  const deck = document.getElementById("flashcard-deck");
  const complete = document.getElementById("deck-complete");

  if (flashcards.length === 0) {
    noCards.classList.remove("hidden");
    deck.classList.add("hidden");
    return;
  }

  noCards.classList.add("hidden");
  deck.classList.remove("hidden");
  complete.classList.add("hidden");
  currentCardIndex = 0;
  showCard(0);
}

function showCard(index) {
  const deck = document.getElementById("deck-complete");
  if (index >= flashcards.length) {
    deck.classList.remove("hidden");
    document.getElementById("flashcard").classList.add("hidden");
    document.getElementById("card-actions").classList.add("hidden");
    return;
  }

  deck.classList.add("hidden");
  const card = flashcards[index];
  document.getElementById("card-front-text").textContent = card.front;
  document.getElementById("card-back-text").textContent = card.back;
  document.getElementById("card-counter").textContent = `${index + 1} / ${flashcards.length}`;

  const pct = ((index) / flashcards.length) * 100;
  document.getElementById("progress-bar").style.width = pct + "%";

  const fc = document.getElementById("flashcard");
  fc.classList.remove("hidden");
  fc.classList.remove("flipped");
  document.getElementById("card-actions").classList.add("hidden");

  // Flip on click
  fc.onclick = () => {
    fc.classList.toggle("flipped");
    if (fc.classList.contains("flipped")) {
      document.getElementById("card-actions").classList.remove("hidden");
    }
  };

  // Confidence buttons
  document.querySelectorAll(".conf-btn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const score = parseInt(btn.dataset.score);
      await reviewCard(card.id, score);
      currentCardIndex++;
      showCard(currentCardIndex);
    };
  });
}

async function reviewCard(id, confidence) {
  try {
    await fetch(`${API}/api/flashcards/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidence })
    });
  } catch (e) {
    console.error("Failed to review card:", e);
  }
}

document.getElementById("restart-deck").addEventListener("click", () => {
  currentCardIndex = 0;
  showCard(0);
  document.getElementById("deck-complete").classList.add("hidden");
});

function updateFlashcardBadge() {
  // Visual cue: flash the flashcards tab
  const tab = document.querySelector('[data-tab="flashcards"]');
  tab.style.color = "#7c6af7";
  setTimeout(() => { tab.style.color = ""; }, 1500);
}

// ─── Exercises ────────────────────────────────────────────────
document.getElementById("generate-exercises").addEventListener("click", async () => {
  const btn = document.getElementById("generate-exercises");
  const list = document.getElementById("exercises-list");
  btn.disabled = true;
  btn.textContent = "Generating...";
  list.innerHTML = "";

  try {
    const res = await fetch(`${API}/api/exercises/generate`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      list.innerHTML = `<p style="color:var(--red);text-align:center">${err.detail || "Error generating exercises."}</p>`;
      return;
    }
    const data = await res.json();
    renderExercises(data.exercises || []);
  } catch (e) {
    list.innerHTML = `<p style="color:var(--red);text-align:center">Could not reach server.</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate Exercises";
  }
});

function renderExercises(exercises) {
  const list = document.getElementById("exercises-list");
  if (exercises.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);text-align:center">No exercises available yet. Ask some Dutch questions first!</p>`;
    return;
  }

  list.innerHTML = exercises.map((ex, i) => {
    const parts = ex.sentence.split("___");
    const sentenceHtml = parts.length > 1
      ? `${escHtml(parts[0])}<input class="exercise-input" data-index="${i}" type="text" placeholder="...">${escHtml(parts[1] || "")}`
      : escHtml(ex.sentence);

    return `
      <div class="exercise-item" id="ex-${i}">
        <div class="exercise-sentence">${sentenceHtml}</div>
        <div class="exercise-footer">
          <span class="exercise-hint">${escHtml(ex.hint || "")}</span>
          <button class="check-btn" onclick="checkExercise(${i}, '${escAttr(ex.answer)}')">Check</button>
          <span class="exercise-feedback" id="fb-${i}"></span>
        </div>
      </div>`;
  }).join("");
}

function checkExercise(index, answer) {
  const input = document.querySelector(`.exercise-input[data-index="${index}"]`);
  const feedback = document.getElementById(`fb-${index}`);
  const item = document.getElementById(`ex-${index}`);
  if (!input) return;

  const userAnswer = input.value.trim().toLowerCase();
  const correct = answer.trim().toLowerCase();

  if (userAnswer === correct) {
    feedback.textContent = "✓ Correct!";
    feedback.className = "exercise-feedback correct";
    item.classList.add("correct");
    item.classList.remove("incorrect");
  } else {
    feedback.textContent = `✗ Answer: ${answer}`;
    feedback.className = "exercise-feedback incorrect";
    item.classList.add("incorrect");
    item.classList.remove("correct");
  }
}

// ─── Resizable Divider ─────────────────────────────────────────
function setupDivider() {
  const divider = document.getElementById("divider");
  const chatPanel = document.getElementById("chat-panel");
  let dragging = false;
  let startX = 0;
  let startW = 0;

  divider.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startW = chatPanel.offsetWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW = Math.max(240, Math.min(startW + delta, window.innerWidth * 0.6));
    chatPanel.style.width = newW + "px";
  });

  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (document.getElementById("view-map").classList.contains("active")) {
        renderGraph(graphData);
      }
    }
  });
}

// ─── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escAttr(str) {
  if (!str) return "";
  return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
