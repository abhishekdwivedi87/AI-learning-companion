import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import {
  extractPdfText,
  summarizeText,
  summarizeImage,
  generateImage,
  chatWithAssistant,
  generateConceptMap,
  ragAssistant,
  embeddingModelName,
  textModelName,
} from "./utils/ai.js";

console.log("Gemini Key:", process.env.GEMINI_API_KEY ? "Loaded" : "Missing");
console.log("Gemini text model:", textModelName);
console.log("Gemini embedding model:", embeddingModelName);
console.log("Mongo URI:", process.env.MONGO_URI ? "Loaded" : "Missing");

function normalizeSourceName(value, fallback) {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || fallback;
}

function getPdfSourceName(req, fallback) {
  const encodedName = req.get("x-source-name");
  if (!encodedName) return fallback;
  try {
    return normalizeSourceName(decodeURIComponent(encodedName), fallback);
  } catch {
    return normalizeSourceName(encodedName, fallback);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.text({
  type: ["text/plain", "text/csv", "text/markdown", "text/html"],
  limit: "50mb",
}));
app.use(express.raw({ type: "application/pdf", limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend is running successfully." });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", textModel: textModelName, embeddingModel: embeddingModelName });
});

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

app.post("/api/summarize", async (req, res) => {
  try {
    let text = "";
    const promptValue = req.is("application/pdf")
      ? req.get("x-summary-prompt")
      : req.body?.prompt;
    const sourceNameValue = req.is("application/pdf")
      ? getPdfSourceName(req, "Uploaded notes")
      : req.body?.sourceName;
    const customPrompt = typeof promptValue === "string" ? promptValue.trim().slice(0, 1000) : "";
    const sourceName = normalizeSourceName(sourceNameValue, "Uploaded notes");

    if (req.is("application/pdf")) {
      text = await extractPdfText(req.body);
    } else if (typeof req.body === "string") {
      text = req.body;
    } else if (req.body && typeof req.body === "object") {
      text = req.body.text || "";
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text was provided to summarize." });
    }

    const result = await summarizeText(text, customPrompt, sourceName);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Something went wrong" });
  }
});

app.post("/api/summarize-image", async (req, res) => {
  try {
    const { mimeType, data, prompt, sourceName } = req.body || {};
    if (!/^image\/(png|jpeg|webp)$/.test(mimeType || "") || typeof data !== "string" || !data) {
      return res.status(400).json({ error: "Upload a PNG, JPEG, or WebP image." });
    }

    const customPrompt = typeof prompt === "string" ? prompt.trim().slice(0, 1000) : "";
    const safeSourceName = normalizeSourceName(sourceName, "Uploaded image");
    const result = await summarizeImage(mimeType, data, customPrompt, safeSourceName);
    res.json(result);
  } catch (error) {
    console.error("Image summary error:", error?.message || error);
    res.status(500).json({ error: error.message || "Image summarization failed." });
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    let text = "";
    let prompt = "";
    let mimeType = "";
    let data = "";
    let sourceName = "Uploaded material";

    if (req.is("application/pdf")) {
      text = await extractPdfText(req.body);
      prompt = req.get("x-image-prompt") || "";
      sourceName = getPdfSourceName(req, sourceName);
    } else {
      ({ text = "", prompt = "", mimeType = "", data = "", sourceName = "Uploaded material" } = req.body || {});
    }

    if (typeof prompt !== "string" || typeof text !== "string" || typeof data !== "string" || typeof sourceName !== "string") {
      return res.status(400).json({ error: "Provide a text prompt and a supported source file." });
    }
    if (!prompt.trim() && !text.trim() && !data) {
      return res.status(400).json({ error: "Add a prompt or upload source material first." });
    }
    if (data && !/^image\/(png|jpeg|webp)$/.test(mimeType)) {
      return res.status(400).json({ error: "Use a PNG, JPEG, or WebP image as visual reference." });
    }

    const result = await generateImage({
      prompt: prompt.slice(0, 1000),
      text,
      mimeType,
      data,
      sourceName: normalizeSourceName(sourceName, "Uploaded material"),
    });
    res.json(result);
  } catch (error) {
    const quotaUnavailable = /\[429 Too Many Requests\]|Quota exceeded/i.test(error?.message || "");
    console.error("Image generation error:", quotaUnavailable ? "Image model quota unavailable." : error?.message || error);
    res.status(quotaUnavailable ? 503 : 500).json({
      error: quotaUnavailable
        ? "Image generation is not enabled for this Gemini project's current quota. Enable image-model access or use an API key with image-generation quota."
        : error.message || "The image could not be generated.",
    });
  }
});

app.get("/api/notes", async (req, res) => {
  try {
    const notes = await mongoose.model("Notes").find({ isChunk: { $ne: true } }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

app.post("/api/assistant", async (req, res) => {
  try {
    const { message, history, noteId, useNotes } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "No message provided." });
    }

    const reply = await chatWithAssistant(message, history || [], noteId, useNotes !== false);
    res.json({ reply });
  } catch (error) {
    console.error("Assistant error:", error);
    res.status(500).json({ error: error.message || "Assistant failed to respond." });
  }
});

app.post("/api/concept-map", async (req, res) => {
  try {
    const conceptMap = await generateConceptMap(req.body?.noteId || null);
    res.json({ conceptMap });
  } catch (error) {
    console.error("Concept map error:", error?.message || error);
    res.status(error.status || 500).json({ error: error.message || "The concept map could not be generated." });
  }
});

app.post("/api/rag-assistant", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "No message provided." });
    }

    const result = await ragAssistant(message, Array.isArray(history) ? history : []);
    res.json(result);
  } catch (error) {
    console.error("RAG Assistant error:", error);
    res.status(500).json({ error: error.message || "RAG Assistant failed to respond." });
  }
});

const port = Number(process.env.PORT) || 5000;
const server = app.listen(port, () => console.log(`✅ Backend running on port ${port}`));

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${port} is already in use. Stop the existing backend process, then restart this server to load code or configuration changes.`);
    process.exit(1);
  }

  console.error("❌ Backend failed to start:", error);
  process.exit(1);
});
