const https = require('https');
const fs = require('fs');
const path = require('path');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Read API key from app-config.json (server-side only)
  let apiKey;
  try {
    const configPath = path.join(__dirname, '..', '..', 'app-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    apiKey = config.apiKey;
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not read app-config.json: ' + e.message }) };
  }

  if (!apiKey || apiKey === 'YOUR-ANTHROPIC-API-KEY-HERE') {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured in app-config.json' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { pdfBase64 } = body;
  if (!pdfBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing pdfBase64' }) };
  }

  const payload = JSON.stringify({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system: 'Extract data from VAD distributor quotes. Return ONLY valid JSON, no markdown, no prose.',
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: `Extract the following from this VAD quote and return as JSON:
{
  "to": { "company": "", "name": "", "email": "" },
  "for": { "company": "", "name": "", "email": "" },
  "lineItems": [{ "sku": "", "description": "", "qty": 1, "unit_price": 0 }]
}
"to" is the reseller/TekStream recipient. "for" is the end customer. Use the distributor quote price (not list price) for unit_price. Numbers only for qty and unit_price.` }
      ]
    }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = (parsed.content || []).map(c => c.text || '').join('');
          const start = text.indexOf('{'), end = text.lastIndexOf('}');
          if (start === -1 || end === -1) throw new Error('No JSON in response');
          const result = JSON.parse(text.slice(start, end + 1));
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(result)
          });
        } catch(e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error: ' + e.message, raw: data.substring(0, 500) }) });
        }
      });
    });

    req.on('error', e => resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) }));
    req.write(payload);
    req.end();
  });
};
