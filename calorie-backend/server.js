import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    const text = response.choices[0].message.content;
    const data = JSON.parse(text);

    res.json(data);

  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(process.env.PORT, () => {
  console.log("Server running on port 3000");
});