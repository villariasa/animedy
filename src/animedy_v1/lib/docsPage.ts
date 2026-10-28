// Minimal self-hosted API documentation viewer (vanilla HTML/CSS/JS, no
// frontend framework, no extra npm dependency). Served at GET /docs.
// It dynamically lists and renders every Swagger/OpenAPI JSON file from
// src/jsondef/ via the existing POST /docs/index and POST /docs/file
// endpoints. A heavier option (swagger-ui-dist) was considered but skipped
// to avoid adding a new dependency for a single documentation page; this
// page renders the same OpenAPI path/method/schema information needed to
// read and try the API.

export const DOCS_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Animedy API Docs</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f1115;
    color: #e6e6e6;
    display: flex;
    min-height: 100vh;
  }
  #sidebar {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid #2a2d35;
    overflow-y: auto;
    padding: 16px;
  }
  #sidebar h1 { font-size: 18px; margin: 0 0 16px; }
  #sidebar button {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: #9fb4ff;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    margin-bottom: 2px;
  }
  #sidebar button:hover, #sidebar button.active { background: #1c1f27; color: #fff; }
  main { flex: 1; overflow-y: auto; padding: 24px 32px; }
  .method-post {
    display: inline-block;
    background: #2f9e44;
    color: #fff;
    font-weight: 700;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    margin-right: 8px;
  }
  .method-get { background: #1971c2; }
  h2 { font-size: 20px; }
  pre {
    background: #161920;
    border: 1px solid #2a2d35;
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
    font-size: 12.5px;
  }
  .path-block { margin-bottom: 36px; }
  .muted { color: #9099a8; font-size: 13px; }
</style>
</head>
<body>
<div id="sidebar">
  <h1>Animedy API</h1>
  <div class="muted" id="count">Loading...</div>
  <div id="file-list"></div>
</div>
<main id="content">
  <p class="muted">Select an endpoint on the left to view its request/response schema.</p>
</main>
<script>
  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return res.json();
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((key) => {
        if (key === "className") {
          node.className = props[key];
        } else if (key === "textContent") {
          node.textContent = props[key];
        } else {
          node.setAttribute(key, props[key]);
        }
      });
    }
    (children || []).forEach((child) => node.appendChild(child));
    return node;
  }

  function renderDefinition(name, def) {
    const content = document.getElementById("content");
    while (content.firstChild) {
      content.removeChild(content.firstChild);
    }
    const paths = (def && def.paths) || {};
    for (const route of Object.keys(paths)) {
      for (const method of Object.keys(paths[route])) {
        const op = paths[route][method] || {};
        const badgeClass = method.toLowerCase() === "get" ? "method-get" : "method-post";
        const requestSchema =
          (op.requestBody &&
            op.requestBody.content &&
            op.requestBody.content["application/json"] &&
            op.requestBody.content["application/json"].schema) ||
          {};

        const block = el("div", { className: "path-block" }, [
          el("span", { className: badgeClass, textContent: method.toUpperCase() }),
          el("code", { textContent: route }),
          el("h2", { textContent: op.summary || name }),
        ]);
        if (op.description) {
          block.appendChild(el("p", { className: "muted", textContent: op.description }));
        }
        block.appendChild(el("h3", { textContent: "Request body" }));
        block.appendChild(el("pre", { textContent: JSON.stringify(requestSchema, null, 2) }));
        block.appendChild(el("h3", { textContent: "Responses" }));
        block.appendChild(el("pre", { textContent: JSON.stringify(op.responses || {}, null, 2) }));
        content.appendChild(block);
      }
    }
  }

  async function init() {
    const indexResult = await postJson("/docs/index", {});
    const files = (indexResult.data && indexResult.data.files) || [];
    document.getElementById("count").textContent = files.length + " endpoint definitions";
    const list = document.getElementById("file-list");
    files.sort().forEach((name) => {
      const button = document.createElement("button");
      button.textContent = name.replace("POST_", "").replace("_schema.json", "").replace(/_/g, " / ");
      button.addEventListener("click", async () => {
        document.querySelectorAll("#file-list button").forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        const fileResult = await postJson("/docs/file", { name });
        renderDefinition(name, fileResult.data);
      });
      list.appendChild(button);
    });
  }

  init().catch((err) => {
    document.getElementById("content").textContent = "Failed to load API docs: " + err;
  });
</script>
</body>
</html>
`;
