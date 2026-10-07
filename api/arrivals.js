export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  try {
    const upstream = await fetch('https://v6.db.transport.rest/stops/8000066/arrivals?duration=360&results=100');
    if (!upstream.ok) throw new Error('Bahn-API HTTP ' + upstream.status);
    const data = await upstream.json();
    const arrivals = Array.isArray(data) ? data : (data.arrivals || []);
    res.status(200).json({ updatedAt: new Date().toISOString(), arrivals });
  } catch (error) {
    res.status(502).json({ updatedAt: new Date().toISOString(), arrivals: [], error: error.message });
  }
}
