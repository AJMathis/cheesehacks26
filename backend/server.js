require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/calories', async (req, res) => {
    const { meal } = req.body;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: `Estimate the total calories in this meal: "${meal}". Reply with just a number, nothing else.`
                }
            ]
        });

        const calories = response.choices[0].message.content.trim();
        res.json({ calories });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Couldn't calculate calories" });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));