exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if(event.httpMethod === 'OPTIONS'){
    return { statusCode: 200, headers, body: '' };
  }

  if(event.httpMethod !== 'POST'){
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { prompt } = JSON.parse(event.body || '{}');
    if(!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing prompt' }) };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if(!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'no API key' }) };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if(!response.ok){
      const err = await response.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: err }) };
    }

    const data   = await response.json();
    const raw    = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        score:     Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
        veredicto: String(parsed.veredicto || '').trim(),
        analisis:  String(parsed.analisis  || '').trim(),
        consejo:   String(parsed.consejo   || '').trim(),
      }),
    };
  } catch(err) {
    console.error('judge error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
