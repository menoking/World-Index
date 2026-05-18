const VALIDMARK = 'aKVEnBbJF9Nip2Wjf4de/fSvA8W3X3iB4L6vT0Y5cxvZbEfEm17udZKUD2qy37dLRY3bzzHLDv+up/Yn3OTo5Q==';
const BASE_URL = 'https://fundmobapi.eastmoney.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { endpoint, ...params } = req.query;
  const query = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const targetUrl = `${BASE_URL}/${endpoint}${query ? '?' + query : ''}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        validmark: VALIDMARK,
        'User-Agent': 'EFund/6.5.5 (iPhone; iOS 15.5; Scale/3.00)',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Upstream returned ${response.status}` });
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch {
      return res.status(502).json({ error: 'Invalid JSON response', raw: text.slice(0, 200) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
