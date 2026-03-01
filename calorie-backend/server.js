import express from "express";
import cors from "cors";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/calories", async (req, res) => {
  try {
    const { food, amount, unit } = req.body;

    const prompt = `
        Estimate calories for:
        Food: ${food}
        Amount: ${amount}
        Unit: ${unit}

        Return ONLY valid JSON:
        {
        "calories": number,
        "confidence": "low" | "medium" | "high",
        "notes": string
        }
        `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // Gemini sometimes wraps JSON in ```json ``` — remove it
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const data = JSON.parse(text);

    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log("Server running on port 3000");
});