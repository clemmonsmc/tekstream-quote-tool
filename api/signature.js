const fs = require('fs');
const path = require('path');
module.exports = async function(req, res) {
  try {
    var filePath = path.join(process.cwd(), 'signature.png');
    var b = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public,max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(b);
  } catch (e) {
    res.status(500).json({ error: 'signature load failed: ' + e.message });
  }
};
