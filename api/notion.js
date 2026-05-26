export const config = { runtime: 'edge' };

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB = '25dc574b-88af-46be-81c4-777739bf44b5';

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!NOTION_TOKEN) return new Response(JSON.stringify({ error: 'NOTION_TOKEN not set' }), { status: 500 });

  try {
    const body = await req.json();
    const { title, findings, sourceFile, type, notes, callsMissed, topSource, date } = body;

    const notionBody = {
      parent: { database_id: NOTION_DB },
      icon: { type: 'emoji', emoji: '📊' },
      properties: {
        'Analysis Title': { title: [{ text: { content: title || 'Untitled Analysis' } }] },
        'Type': { select: { name: type || 'Manual Query' } },
        'Status': { select: { name: 'New' } },
        'Source File': { rich_text: [{ text: { content: sourceFile || '' } }] },
        'Findings': { rich_text: [{ text: { content: (findings || '').slice(0, 2000) } }] },
        'Griff Notes': { rich_text: [{ text: { content: (notes || '').slice(0, 2000) } }] },
        'Top Source': { rich_text: [{ text: { content: topSource || '' } }] },
        'Date': { date: { start: date || new Date().toISOString().split('T')[0] } },
        ...(callsMissed ? { 'Calls Missed': { number: callsMissed } } : {})
      }
    };

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionBody)
    });

    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: data.message }), { status: res.status });

    return new Response(JSON.stringify({ 
      success: true, 
      url: data.url,
      id: data.id 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
