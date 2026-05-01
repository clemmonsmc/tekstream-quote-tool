module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const key = process.env.DROPBOX_SIGN_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing DROPBOX_SIGN_API_KEY' });

  const { pdfBase64, quoteNumber, customerName, customerEmail, signerEmail } = req.body || {};
  if (!pdfBase64) return res.status(400).json({ error: 'Missing PDF' });
  if (!customerEmail) return res.status(400).json({ error: 'Missing customer email' });
  if (!signerEmail) return res.status(400).json({ error: 'Missing TekStream signer email' });

  // Build multipart form data for Dropbox Sign API
  const FormData = (await import('node:stream')).Readable; // fallback — use manual multipart
  const boundary = '----TekStreamBoundary' + Date.now();
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const fileName = (quoteNumber || 'Quote') + ' - ' + (customerName || 'Customer') + '.pdf';
  const title = 'TekStream Quote ' + (quoteNumber || '') + (customerName ? ' \u2014 ' + customerName : '');

  const parts = [];

  function addField(name, value) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );
  }

  addField('test_mode', '0');
  addField('title', title);
  addField('subject', title);
  addField('message', 'Please review and sign the attached quote at your earliest convenience.');
  addField('signers[0][name]', customerName || 'Customer');
  addField('signers[0][email_address]', customerEmail);
  addField('signers[0][order]', '0');
  addField('signers[1][name]', 'TekStream Solutions');
  addField('signers[1][email_address]', signerEmail);
  addField('signers[1][order]', '1');

  const preamble = Buffer.from(parts.join(''));
  const fileHeader = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([preamble, fileHeader, pdfBuffer, epilogue]);

  const auth = Buffer.from(key + ':').toString('base64');
  const response = await fetch('https://api.hellosign.com/v3/signature_request/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString()
    },
    body
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({ error: data.error?.error_msg || 'Dropbox Sign error', detail: data });
  }

  return res.status(200).json({
    success: true,
    signatureRequestId: data.signature_request?.signature_request_id,
    signingUrl: data.signature_request?.signing_url
  });
};
