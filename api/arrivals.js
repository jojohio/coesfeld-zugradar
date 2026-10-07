export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=180');
  const url = 'https://www.bahnhof.de/api/boards/arrivals?evaNumbers=8000066&duration=360&locale=de';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { 'accept': 'application/json', 'user-agent': 'Coesfeld-Zugradar/1.0' }
    });
    if (!upstream.ok) throw new Error('DB Bahnhof API HTTP ' + upstream.status);
    const data = await upstream.json();
    // Return raw data too; frontend normalizes the official board schema.
    res.status(200).json({ updatedAt: new Date().toISOString(), source: 'bahnhof.de', data });
  } catch (e) {
    res.status(e.name === 'AbortError' ? 504 : 502).json({ updatedAt:new Date().toISOString(), error:e.name === 'AbortError'?'DB-Anfrage dauerte zu lange':e.message });
  } finally { clearTimeout(timer); }
}
