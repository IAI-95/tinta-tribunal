const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST'){
    return { statusCode:405, body:'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if(event.httpMethod === 'OPTIONS'){
    return { statusCode:200, headers, body:'' };
  }

  try {
    const { prompt } = JSON.parse(event.body || '{}');
    if(!prompt) return { statusCode:400, headers, body: JSON.stringify({error:'missing prompt'}) };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 900,
      messages:   [{ role:'user', content: prompt }],
    });

    const raw    = (message.content?.[0]?.text || '').replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(raw);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        score:    Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
        veredicto: String(parsed.veredicto || '').trim(),
        analisis:  String(parsed.analisis  || '').trim(),
        consejo:   String(parsed.consejo   || '').trim(),
      }),
    };
  } catch(err) {
    console.error('judge function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
