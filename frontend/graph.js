// ─── Obsidian-style D3 Force Graph ────────────────────────────

const CATEGORY_COLORS = {
  articles:    "#7c6af7",
  nouns:       "#4a9eff",
  verbs:       "#f85149",
  word_order:  "#d29922",
  adjectives:  "#3fb950",
  pronouns:    "#e3b341",
  other:       "#58a6ff",
};

let graphSimulation = null;
let graphData = { nodes: [], edges: [] };

function initGraph(data) {
  graphData = data;
  renderGraph(data);
}

function renderGraph(data) {
  const container = document.getElementById("view-map");
  const svg = d3.select("#graph-svg");
  svg.selectAll("*").remove();

  const width = container.clientWidth;
  const height = container.clientHeight;

  svg.attr("width", width).attr("height", height);

  // Background
  svg.append("rect")
    .attr("width", width).attr("height", height)
    .attr("fill", "#0d1117");

  const g = svg.append("g").attr("class", "graph-root");

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 8])
    .on("zoom", (event) => g.attr("transform", event.transform));
  svg.call(zoom);

  // Reset zoom button
  document.getElementById("reset-zoom").onclick = () => {
    svg.transition().duration(500).call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
        .translate(-width / 2, -height / 2)
    );
  };

  // Build adjacency for sizing nodes
  const degree = {};
  data.nodes.forEach(n => { degree[n.id] = 0; });
  data.edges.forEach(e => {
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  });

  const nodeRadius = (d) => {
    const base = 6;
    const deg = degree[d.id] || 0;
    const visited = (d.questions_asked || []).length > 0 ? 3 : 0;
    return base + Math.sqrt(deg) * 3 + visited;
  };

  // Clone nodes/edges for simulation (d3 mutates them)
  const nodes = data.nodes.map(n => ({ ...n }));
  const edges = data.edges.map(e => ({ ...e }));

  // Links
  const link = g.append("g").attr("class", "links")
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("stroke", "#2a2f3a")
    .attr("stroke-width", 1.2)
    .attr("stroke-opacity", 0.7);

  // Node groups
  const node = g.append("g").attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node-group")
    .style("cursor", "pointer")
    .call(d3.drag()
      .on("start", dragStarted)
      .on("drag", dragged)
      .on("end", dragEnded)
    );

  // Node circles
  node.append("circle")
    .attr("r", d => nodeRadius(d))
    .attr("fill", d => {
      const visited = (d.questions_asked || []).length > 0;
      return visited ? CATEGORY_COLORS[d.category] || "#58a6ff" : "transparent";
    })
    .attr("stroke", d => CATEGORY_COLORS[d.category] || "#58a6ff")
    .attr("stroke-width", 1.5)
    .attr("stroke-opacity", 0.8);

  // Node labels
  node.append("text")
    .attr("dy", d => nodeRadius(d) + 12)
    .attr("text-anchor", "middle")
    .attr("fill", d => {
      const visited = (d.questions_asked || []).length > 0;
      return visited ? "#c9d1d9" : "#6e7681";
    })
    .attr("font-size", d => {
      const deg = degree[d.id] || 0;
      return deg > 4 ? "12px" : "10px";
    })
    .attr("font-family", "-apple-system, BlinkMacSystemFont, sans-serif")
    .text(d => d.label)
    .style("pointer-events", "none")
    .style("user-select", "none");

  // Hover behavior
  const tooltip = document.getElementById("node-tooltip");

  node.on("mouseover", function(event, d) {
    const nodeEl = d3.select(this);
    const color = CATEGORY_COLORS[d.category] || "#58a6ff";

    // Highlight this node
    nodeEl.select("circle")
      .transition().duration(150)
      .attr("r", nodeRadius(d) + 3)
      .attr("stroke-width", 2.5);

    // Highlight connected links and nodes
    const connectedIds = new Set();
    link.each(function(l) {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      if (srcId === d.id || tgtId === d.id) {
        connectedIds.add(srcId);
        connectedIds.add(tgtId);
        d3.select(this)
          .transition().duration(150)
          .attr("stroke", color)
          .attr("stroke-opacity", 1)
          .attr("stroke-width", 2);
      }
    });

    node.each(function(n) {
      if (connectedIds.has(n.id) && n.id !== d.id) {
        d3.select(this).select("circle")
          .transition().duration(150)
          .attr("stroke", color)
          .attr("stroke-width", 2);
      }
    });

    // Show tooltip
    showTooltip(event, d);
  })
  .on("mousemove", (event) => {
    positionTooltip(event);
  })
  .on("mouseout", function(event, d) {
    const nodeEl = d3.select(this);
    const visited = (d.questions_asked || []).length > 0;
    const color = CATEGORY_COLORS[d.category] || "#58a6ff";

    nodeEl.select("circle")
      .transition().duration(150)
      .attr("r", nodeRadius(d))
      .attr("stroke-width", 1.5);

    link.transition().duration(150)
      .attr("stroke", "#2a2f3a")
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.2);

    node.select("circle")
      .transition().duration(150)
      .attr("stroke", n => CATEGORY_COLORS[n.category] || "#58a6ff")
      .attr("stroke-width", 1.5);

    tooltip.classList.add("hidden");
  });

  // Force simulation
  graphSimulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id).distance(110).strength(0.5))
    .force("charge", d3.forceManyBody().strength(-280))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
    .force("collision", d3.forceCollide(d => nodeRadius(d) + 18))
    .on("tick", ticked);

  function ticked() {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  }

  function dragStarted(event, d) {
    if (!event.active) graphSimulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragEnded(event, d) {
    if (!event.active) graphSimulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Initial zoom to fit
  svg.call(zoom.transform,
    d3.zoomIdentity.translate(width / 2, height / 2).scale(0.75)
      .translate(-width / 2, -height / 2)
  );
}

function showTooltip(event, d) {
  const tooltip = document.getElementById("node-tooltip");
  const color = CATEGORY_COLORS[d.category] || "#58a6ff";

  const questions = (d.questions_asked || []);
  const questionsHtml = questions.length > 0
    ? `<div class="tooltip-questions">
        ${questions.slice(-3).reverse().map(q => `
          <div class="tooltip-q-item">
            <span class="q-text">"${escHtml(q.question)}"</span>
            <span class="q-date">${formatDate(q.date)}</span>
            ${q.summary ? `<br><span style="font-size:10px;color:#8b949e">${escHtml(q.summary)}</span>` : ""}
          </div>`).join("")}
       </div>`
    : `<div style="font-size:11px;color:#6e7681;margin-top:6px">Not yet explored</div>`;

  tooltip.innerHTML = `
    <div class="tooltip-label" style="color:${color}">${escHtml(d.label)}</div>
    <div class="tooltip-desc">${escHtml(d.description)}</div>
    <div class="tooltip-bridges">
      <span class="bridge-tag bridge-en">EN: ${escHtml(d.english_bridge || "")}</span>
      <span class="bridge-tag bridge-zh">ZH: ${escHtml(d.chinese_bridge || "")}</span>
    </div>
    ${questionsHtml}
  `;

  tooltip.classList.remove("hidden");
  positionTooltip(event);
}

function positionTooltip(event) {
  const tooltip = document.getElementById("node-tooltip");
  const margin = 16;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let x = event.clientX + 16;
  let y = event.clientY + 16;
  if (x + tw + margin > window.innerWidth) x = event.clientX - tw - 16;
  if (y + th + margin > window.innerHeight) y = event.clientY - th - 16;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}

function highlightNodes(nodeIds) {
  // Pulse newly updated nodes
  d3.selectAll(".node-group").each(function(d) {
    if (nodeIds.includes(d.id)) {
      const circle = d3.select(this).select("circle");
      const color = CATEGORY_COLORS[d.category] || "#58a6ff";
      circle
        .transition().duration(200)
        .attr("r", parseFloat(circle.attr("r")) + 6)
        .attr("fill", color)
        .attr("stroke-width", 3)
        .transition().duration(600)
        .attr("r", parseFloat(circle.attr("r")))
        .attr("stroke-width", 1.5);
    }
  });
}

function refreshGraph() {
  fetch("/api/map")
    .then(r => r.json())
    .then(data => {
      graphData = data;
      renderGraph(data);
    });
}

function escHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Handle resize
window.addEventListener("resize", () => {
  if (document.getElementById("view-map").classList.contains("active")) {
    renderGraph(graphData);
  }
});
