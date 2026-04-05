exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers, body:'Method Not Allowed' };

  try {
    const { judgeId, text, genre, constraints, writerName, mode } = JSON.parse(event.body || '{}');

    const PERSONAS = {
      cervantes: 'Eres Miguel de Cervantes. Juzgas con ironía, sabiduría y autoridad. Buscas claridad, ingenio y dominio de la lengua. Eres directo y nunca mientes por cortesía.',
      woolf:     'Eres Virginia Woolf. Buscas la vida interior del texto, la percepción sensorial, la autenticidad emocional. Eres implacable cuando hay vacío detrás de las palabras.',
      chejov:    'Eres Antón Chéjov. Tu criterio es la economía narrativa: lo que no se dice vale más que lo que se dice. Eres preciso, lacónico, y detectas el exceso al instante.',
      borges:    'Eres Jorge Luis Borges. Buscas la palabra inevitable, la imagen exacta, la densidad conceptual. Eres honesto hasta la crueldad cuando el lenguaje es impreciso.',
      kafka:     'Eres Franz Kafka. Te interesan los textos que generan incomodidad. Un texto demasiado tranquilizador no te interesa. Tu voz es inquietante y precisa.',
      quevedo:   'Eres Francisco de Quevedo. Juzgas con el filo de quien domina la lengua como arma. Eres implacable con la banalidad.',
    };

    const GENRES = {
      haiku:        'HAIKU (5-30 palabras). No penalices la brevedad — es la forma.',
      microrrelato: 'MICRORRELATO (30-150 palabras). Historia completa, economía, impacto de la última frase.',
      narrativo:    'NARRATIVO (150-600 palabras). Progresión, tensión, ritmo de la prosa.',
      poetico:      'POÉTICO (30-200 palabras). Musicalidad, densidad de imagen, emoción auténtica.',
      ensayo:       'ENSAYO (200-700 palabras). Solidez del argumento, originalidad, calidad de la prosa.',
      epistolar:    'EPISTOLAR (120-500 palabras). Autenticidad de la voz, tensión entre lo dicho y lo callado.',
      descriptivo:  'DESCRIPTIVO (100-400 palabras). Especificidad sensorial, detalles concretos.',
      minimalista:  'MINIMALISTA (20-120 palabras). Cada palabra justificada, densidad real.',
    };

    const persona   = PERSONAS[judgeId] || PERSONAS.cervantes;
    const genreDesc = GENRES[genre] || GENRES.narrativo;
    const wc        = (text || '').trim().split(/\s+/).filter(Boolean).length;
    const nameStr   = writerName ? `El escritor se llama ${writerName}. Menciónalo por su nombre al menos una vez.` : '';
    const isLibre   = mode === 'libre';

    let prompt;

    if(isLibre) {
      // Modo Libre: richer output with fortalezas/debilidades
      prompt = `${persona}

Género: ${genreDesc}

${nameStr}

TEXTO (${wc} palabras):
${text}

Lee cada palabra. Este es el Modo Libre — el escritor ha elegido escribir sin restricciones para aprender de ti.
Tu misión: ser un maestro honesto. Cita algo concreto del texto.
Si el texto no tiene sentido o es incoherente: puntúa 0-15 con ironía en tu voz.

ESCALA: 0-15=sin sentido, 16-35=muy débil, 36-50=con intención pero débil, 51-65=funcional con potencial, 66-80=sólido, 81-100=notable.

Responde SOLO con JSON válido:
{"score":<0-100>,"veredicto":"<2-3 frases memorables en tu voz, citando algo concreto del texto>","analisis":"<2-3 frases de análisis real sobre este texto específico>","fortalezas":["<punto fuerte concreto>","<punto fuerte concreto>","<punto fuerte concreto>"],"debilidades":["<debilidad concreta>","<debilidad concreta>","<debilidad concreta>"],"consejo":"<1 frase de consejo muy específico y accionable>"}`;

    } else {
      // El Reto: standard output
      prompt = `${persona}

Género: ${genreDesc}

Condiciones del reto: ${constraints}

${nameStr}

TEXTO (${wc} palabras):
${text}

Lee cada palabra. Cita algo concreto del texto en tu veredicto.
Si es incoherente: puntúa 0-10 con ironía.

ESCALA: 0-15=sin sentido, 16-35=muy débil, 36-50=débil, 51-65=funcional, 66-80=sólido, 81-100=notable.
Ajuste: cumple 3/3 condiciones +5pts, cumple 0/3 -8pts.

Responde SOLO con JSON válido:
{"score":<0-100>,"veredicto":"<2-3 frases en tu voz citando algo concreto>","analisis":"<2-3 frases de análisis>","consejo":"<1 frase de consejo específico>"}`;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: isLibre ? 1000 : 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if(!resp.ok) throw new Error('Anthropic ' + resp.status + ': ' + await resp.text());

    const data   = await resp.json();
    const raw    = (data.content?.[0]?.text || '').replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(raw);

    const result = {
      score:     Math.max(0, Math.min(100, Math.round(Number(parsed.score)||0))),
      veredicto: String(parsed.veredicto||'').trim(),
      analisis:  String(parsed.analisis ||'').trim(),
      consejo:   String(parsed.consejo  ||'').trim(),
    };

    if(isLibre) {
      result.fortalezas  = Array.isArray(parsed.fortalezas)  ? parsed.fortalezas.map(String)  : [];
      result.debilidades = Array.isArray(parsed.debilidades) ? parsed.debilidades.map(String) : [];
    }

    return { statusCode:200, headers, body: JSON.stringify(result) };

  } catch(err) {
    console.error('judge error:', err.message);
    return { statusCode:500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
