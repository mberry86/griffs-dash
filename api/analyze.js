export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  try {
    const { prompt, data } = await req.json();

    const systemPrompt = `You are Griff's AI analyst for QM media buying at Centerfield Media.
You analyze media performance data and return clear, direct findings.
When you identify issues, be specific with numbers.

IMPORTANT: You must ALWAYS return a JSON response with two fields:
1. "text" - your written analysis with executive summary, numbered findings, and recommended actions
2. "charts" - an array of chart definitions for graphical display (can be empty array if no data warrants charts)

Each chart in the "charts" array must have:
- "type": "bar" | "horizontalBar" | "line" | "donut"
- "title": string
- "labels": array of strings
- "datasets": array of objects with "label", "data" (numbers), and optional "color" ("red"|"amber"|"blue"|"green"|"multi")

Example response format:
{
  "text": "EXECUTIVE SUMMARY\\n...\\n\\nKEY FINDINGS\\n1. ...\\n\\nRECOMMENDED ACTIONS\\n...",
  "charts": [
    {
      "type": "horizontalBar",
      "title": "Calls Missed by Source",
      "labels": ["RATEQ", "WISDO", "ADLNT"],
      "datasets": [{"label": "Calls Missed", "data": [420969, 245510, 174760], "color": "red"}]
    },
    {
      "type": "bar",
      "title": "BF Setting vs Actual Rate",
      "labels": ["RATEQ", "WISDO", "ADLNT"],
      "datasets": [
        {"label": "BF Setting %", "data": [46, 51, 78], "color": "blue"},
        {"label": "Actual Rate %", "data": [6, 6.8, 8.6], "color": "red"}
      ]
    }
  ]
}

Always generate charts when the analysis involves:
- Comparisons across sources, states, or channels (use bar/horizontalBar)
- Performance gaps or compliance rates (use bar with multiple datasets)
- Trends over time (use line)
- Distribution of missed calls, spend, or leads (use bar or donut)
- State-level breakdowns (use horizontalBar sorted by the key metric)

Return ONLY valid JSON. No markdown, no backticks, no preamble.`;

    const userMessage = data
      ? `Here is the media data to analyze:\n\n${data}\n\nInstructions: ${prompt}`
      : prompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const result = await response.json();
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500 });
    }

    let rawText = result.content[0].text.trim();
    // Strip any accidental markdown fences
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch(e) {
      // Fallback: treat entire response as text with no charts
      parsed = { text: rawText, charts: [] };
    }

    return new Response(JSON.stringify({
      text: parsed.text || rawText,
      charts: parsed.charts || [],
      usage: result.usage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
