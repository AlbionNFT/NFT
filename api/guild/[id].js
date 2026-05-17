// This file should be placed in the `api/guild/` directory of your Vercel/GitHub project.
// The file must be named `[id].js` to handle dynamic guild IDs.

export default async function handler(req, res) {
  // 1. Enable CORS so your frontend can call this backend endpoint safely
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight request (standard CORS behavior)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Ensure it's a GET request
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Extract the Guild ID from the URL path
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Guild ID is required' });
  }

  try {
    // Servers are not subject to browser CORS policies, so this request will succeed.
    const albionApiUrl = `https://gameinfo.albiononline.com/api/gameinfo/guilds/${id}`;
    
    const response = await fetch(albionApiUrl, {
      headers: {
        // Some APIs block default server requests; adding a common browser User-Agent ensures compatibility
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Albion API responded with status ${response.status}` 
      });
    }

    const data = await response.json();
    
    // 3. Return the fresh data to the client with CORS allowed
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Proxy Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
}
