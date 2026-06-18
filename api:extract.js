const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simple file-based storage fallback using global (Vercel KV optional)
let memoryStore = {};

async function saveDataset(id, dataset) {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = require("@vercel/kv");
      await kv.set(`dataset:${id}`, JSON.stringify(dataset), { ex: 60 * 60 * 24 * 30 });
    } else {
      memoryStore[id] = dataset;
    }
  } catch (e) {
    memoryStore[id] = dataset;
  }
}

async function loadDataset(id) {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = require("@vercel/kv");
      const raw = await kv.get(`dataset:${id}`);
      return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
    } else {
      return memoryStore[id] || null;
    }
  } catch (e) {
    return memoryStore[id] || null;
  }
}

async function listDatasets() {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = require("@vercel/kv");
      const keys = await kv.keys("dataset:*");
      const datasets = [];
      for (const key of keys.slice(0, 20)) {
        const d = await kv.get(key);
        if (d) {
          const parsed = typeof d === "string" ? JSON.parse(d) : d;
          datasets.push({ id: key.replace("dataset:", ""), title: parsed.title, createdAt: parsed.createdAt, rowCount: parsed.rows?.length || 0, headers: parsed.headers });
        }
      }
      return datasets.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      return Object.entries(memoryStore).map(([id, d]) => ({
        id, title: d.title, createdAt: d.createdAt, rowCount: d.rows?.length || 0, headers: d.headers
      })).sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch (e) {
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // GET: list or load datasets
  if (req.method === "GET") {
    const { id } = req.query;
    if (id) {
      const dataset = await loadDataset(id);
      if (!dataset) return res.status(404).json({ error: "Dataset not found" });
      return res.json(dataset);
    }
    const list = await listDatasets();
    return res.json({ datasets: list });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { files, extractPrompt, columns, title, mode, id } = req.body;

    // Summary mode
    if (mode === "summary") {
      const d = await loadDataset(id);
      if (!d) return res.status(404).json({ error: "Dataset not found" });
      const sampleData = JSON.stringify({ headers: d.headers, rows: d.rows.slice(0, 20) });
      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Analyze this dataset and return ONLY a JSON object (no markdown) with these keys:
          - "bullets": array of 4-5 insight strings (each starting with an emoji)
          - "highlights": array of 3 objects with { "label": string, "value": string, "color": "purple"|"pink"|"teal"|"amber" }
          - "chartSuggestion": one of "bar"|"pie"|"line"|"none"
          - "chartData": array of { "label": string, "value": number } (max 8 items, for the suggested chart)
          - "chartTitle": short title for the chart
          Dataset (${d.rows.length} rows): ${sampleData}`
        }]
      });
      let raw = resp.content[0].text.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(raw);
        return res.json(parsed);
      } catch(e) {
        const m = raw.match(/\{[\s\S]*\}/);
        return res.json(m ? JSON.parse(m[0]) : { bullets: ["Data extracted successfully"], highlights: [], chartSuggestion: "none", chartData: [] });
      }
    }

    // Extract mode
    if (!files || files.length === 0) return res.status(400).json({ error: "No files provided" });

    const contentBlocks = [];
    for (const file of files) {
      if (file.type === "image") {
        contentBlocks.push({ type: "text", text: `File: ${file.name}` });
        contentBlocks.push({ type: "image", source: { type: "base64", media_type: file.mediaType, data: file.data } });
      } else {
        contentBlocks.push({ type: "text", text: `File: ${file.name}\n---\n${(file.data || "").slice(0, 10000)}` });
      }
    }
    contentBlocks.push({ type: "text", text: "Extract all data. Return only JSON." });

    const systemMsg = `You are a data extraction assistant. Extract all structured data into one unified dataset. Return ONLY a raw JSON object with: "headers" (array of column name strings) and "rows" (array of arrays). Always include "Source File" as first column. ${columns ? "Use these columns: " + columns + "." : "Auto-detect best columns."} ${extractPrompt ? "Focus on: " + extractPrompt : ""}`;

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemMsg,
      messages: [{ role: "user", content: contentBlocks }]
    });

    let raw = resp.content.map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch(e) { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error("AI response was not valid JSON."); }

    if (!parsed?.headers?.length) throw new Error("No structured data could be extracted.");

    const datasetId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const dataset = {
      id: datasetId,
      title: title || `Dataset ${new Date().toLocaleDateString()}`,
      headers: parsed.headers,
      rows: parsed.rows || [],
      createdAt: Date.now(),
      fileCount: files.length
    };

    await saveDataset(datasetId, dataset);
    return res.json({ ...parsed, id: datasetId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Extraction failed" });
  }
};
