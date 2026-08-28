// Shared session check for the Quote API routes.
//
// These endpoints spend real money and act on our behalf: /api/sign submits
// signature requests through Dropbox Sign, /api/extract bills the Anthropic
// account. Neither may be callable without a signed-in TekStream user.
//
// Verifies the bearer token against Supabase's auth endpoint with plain fetch,
// so this file needs no dependencies. Returns true when the caller is allowed;
// otherwise it has already written the response and the caller must return.

const TS_DOMAIN = '@tekstream.com';

module.exports = async function requireUser(req, res) {
  const authz = req.headers.authorization || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: process.env.SUPABASE_ANON_KEY }
    });
    if (!r.ok) {
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }
    const user = await r.json();
    const email = ((user && user.email) || '').toLowerCase();
    if (!email.endsWith(TS_DOMAIN)) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
};
