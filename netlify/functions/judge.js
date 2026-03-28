exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers, body:'Method Not Allowed' };

  try {
    const { judgeId, text, genre, constraints, writerName } = JSON.parse(event.body || '{}');

    const PERSONAS = {
      cervantes: 'Eres Miguel de Cervantes. Juzgas con ironía, sabiduría y autoridad. Buscas claridad, ingenio y dominio de la lengua. Eres directo y nunca mientes por cortesía.',
      woolf:     'Eres Virginia Woolf. Buscas la vida interior del texto, la percepción sensorial, la autenticidad emocional. Eres implacable cuando hay vacío detrás de las palabras.',
      chejov:    'Eres Antón Chéjov. Tu criterio es la economía narrativa: lo que no se dice vale más que lo que se dice. Eres preciso, lacónico, y detectas el exceso al instante.',
      borges:    'Eres Jorge Luis Borges. Buscas la palabra inevitable, la imagen exacta, la densidad conceptual. Eres honesto hasta la crueldad cuando el lenguaje es impreciso.',
      kafka:     'Eres Franz Kafka. Te interesan los textos que generan incomodidad. Un texto demasiado tranquilizador no te interesa. Tu voz es inquietante y precisa.',
      quevedo:   'Eres Francisco de Quevedo. Juzgas con el filo de quien domina la lengua como arma. Eres implacable con la banalidad.',
    };

    const GENRES = {
      haiku:        'HAIKU (5-30 palabras). No penalices la brevedad — es la forma. Juzga: imagen única, economía absoluta.',
      microrrelato: 'MICRORRELATO (30-150 palabras). Juzga: historia completa, economía, impacto de la última frase.',
      narrativo:    'NARRATIVO (150-600 palabras). Juzga: progresión, tensión, ritmo de la prosa.',
      poetico:      'POÉTICO (30-200 palabras). Juzga: musicalidad, densidad de imagen, emoción auténtica.',
      ensayo:       'ENSAYO (200-700 palabras). Juzga: solidez del argumento, originalidad, calidad de la prosa.',
      epistolar:    'EPISTOLAR (120-500 palabras). Juzga: autenticidad de la voz, tensión entre lo dicho y lo callado.',
      descriptivo:  'DESCRIPTIVO (100-400 palabras). Juzga: especificidad sensorial, detalles concretos.',
      minimalista:  'MINIMALISTA (20-120 palabras). Juzga: cada palabra justificada, densidad real.',
    };

    const persona = PERSONAS[judgeId] || PERSONAS.cervantes;
    const genreDesc = GENRES[genre] || GENRES.narrativo;
    const wc = (text || '').trim().split(/\s+/).filter(Boolean).length;
    const nameStr = writerName ? ('El escritor se llama ' + writerName + '. Menciónalo por su nombre al menos una vez.') : '';

    const prompt = persona + '\n\n' +
      'Género: ' + genreDesc + '\n\n' +
      'Condiciones del reto: ' + constraints + '\n\n' +
      nameStr + '\n\n' +
      'TEXTO (' + wc + ' palabras):\n' + text + '\n\n' +
      'Lee el texto con atención. Cita algo concreto de él en tu veredicto.\n' +
      'Si es incoherente o sin sentido: puntúa 0-10 con ironía.\n\n' +
      'Responde SOLO con JSON válido:\n' +
      '{"score":<0-100>,"veredicto":"<2-3 frases en tu voz citando algo concreto del texto>","analisis":"<3-5 frases de análisis real>","consejo":"<1-2 frases de consejo específico>"}';

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if(!resp.ok) throw new Error('Anthropic ' + resp.status + ': ' + await resp.text());

    const data   = await resp.json();
    const raw    = (data.content?.[0]?.text || '').replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(raw);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        score:     Math.max(0, Math.min(100, Math.round(Number(parsed.score)||0))),
        veredicto: String(parsed.veredicto||'').trim(),
        analisis:  String(parsed.analisis ||'').trim(),
        consejo:   String(parsed.consejo  ||'').trim(),
      }),
    };
  } catch(err) {
    console.error('judge error:', err.message);
    return { statusCode:500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
