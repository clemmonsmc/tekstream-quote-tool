module.exports = async function (req, res) {
  // Returns the publishable Supabase config for the browser. The anon key is
  // safe to expose; RLS plus the user session are the guard. Values come from
  // Vercel env vars so nothing is committed to the repo.
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  });
};
