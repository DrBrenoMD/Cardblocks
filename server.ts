import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-study-material", async (req, res) => {
    try {
      const { text, explanation, alternatives, type } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
      }

      const ai = new GoogleGenAI({ apiKey });

      let prompt = `You are a medical student assistant and study material generator. 
I have a question, its alternatives, and its explanation. 
`;
      if (type === 'flashcards') {
        prompt += `Your task is to synthesize this knowledge into 5 distinct Flashcards.
Please return ONLY a valid JSON object matching this structure exactly (no markdown formatting):
{
  "flashcards": [
    {
      "front": "string (synthesized question)",
      "back": "string (synthesized answer + key explanation)"
    }
  ]
}
`;
      } else {
        prompt += `Your task is to synthesize this knowledge into a Note containing the core concepts extracted from the explanation, strictly up to 1000 characters.
Please return ONLY a valid JSON object matching this structure exactly (no markdown formatting):
{
  "note": "string (up to 1000 chars, synthesizing the core knowledge formatted as HTML)"
}
`;
      }

      prompt += `
Input data:
Question: ${text}
Explanation: ${explanation}
Alternatives: ${alternatives ? JSON.stringify(alternatives) : ''}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      let responseText = response.text || "{}";
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

      const result = JSON.parse(responseText);
      res.json(result);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
