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
Format your response with:
- A 2-3 sentence executive summary first
- Key findings as numbered points with specific data
- A "Recommended Actions" section at the end
Keep it sharp and actionable. Griff is a senior media buyer who wants the truth fast.`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const result = await response.json();

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ 
      text: result.content[0].text,
      usage: result.usage 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
