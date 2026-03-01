const express = require('express');
const fetch = require('node-fetch');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');

const app = express();
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

function safeNumber(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Simple fallback calorie lookup per 100g or per item
const FALLBACK = {
  "apple": { per100g: 52 },
  "banana": { per100g: 96 },
  "egg": { perItem: 78 },
  "rice": { per100g: 130 },
  "chicken breast": { per100g: 165 },
  "bread": { per100g: 265 }
};

function fallbackEstimate(item){
  const name = (item.name || '').toLowerCase();
  const info = FALLBACK[name];
  const quantity = safeNumber(item.quantity);
  const measurement = (item.measurement || '').toLowerCase();

  if(!info) return null;

  if(info.perItem && (measurement === 'item' || measurement === 'whole')){
    return { calories: info.perItem * quantity, per_unit: info.perItem };
  }
  // support grams
  if(info.per100g && (measurement === 'g' || measurement === 'gram' || measurement === 'grams' || measurement === '100g')){
    const perG = info.per100g / 100;
    return { calories: perG * quantity, per_unit: perG };
  }
  // try to interpret common measures
  if(info.per100g && (measurement === 'cup' || measurement === 'cups')){
    // very rough: assume 1 cup = 240g
    const perG = info.per100g / 100;
    return { calories: perG * (240 * quantity), per_unit: perG * 240 };
  }
  return null;
}

app.post('/calculate', async (req, res) => {
  const { items } = req.body;
  if(!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey){
    // fallback local estimates
    const results = items.map(it => {
      const est = fallbackEstimate(it);
      return {
        name: it.name,
        measurement: it.measurement,
        quantity: it.quantity,
        calories: est ? Math.round(est.calories) : null,
        per_unit: est ? est.per_unit : null
      };
    });
    const totalCalories = results.reduce((s,r)=>s+(r.calories||0),0);
    return res.json({ items: results, totalCalories, model: 'fallback' });
  }

  // Build a deterministic prompt asking for JSON-only response
  const system = `You are a nutrition assistant. For each food item provided, return a JSON array with: name, measurement, quantity, calories (total, integer), per_unit (calories per single unit in the same measurement). Only respond with valid JSON. Do not add any extra text.`;
  const user = `Items: ${JSON.stringify(items)}\nReturn JSON: {"items": [{"name":"...","measurement":"...","quantity":...,"calories":...,"per_unit":...}], "totalCalories": ...}`;

  try{
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        max_tokens: 800
      })
    });

    if(!resp.ok){
      const txt = await resp.text();
      return res.status(502).json({ error: 'OpenAI API error', detail: txt });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    // try parse JSON from the model output
    let parsed;
    try{
      parsed = JSON.parse(content);
    }catch(e){
      // attempt to extract JSON substring
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if(start!==-1 && end!==-1){
        try{ parsed = JSON.parse(content.slice(start, end+1)); }catch(e2){}
      }
    }
    if(!parsed) return res.status(502).json({ error: 'Failed to parse model response', raw: content });
    return res.json({ ...parsed, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' });
  }catch(err){
    return res.status(500).json({ error: 'server error', detail: err.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, ()=> console.log(`AI backend listening on ${port}`));
