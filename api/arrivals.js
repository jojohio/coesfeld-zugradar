export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  const base = 'https://v6.db.transport.rest/stops/8000066/arrivals';
  // Keep the upstream request small: the provider documents low rate limits,
  // and large 6-hour/100-result requests can time out on serverless runtimes.
  const urls = [
    base + '?duration=120&results=40&remarks=false&stopovers=false&language=de&profile=dbnav',
    base + '?duration=120&results=40&remarks=false&stopovers=false&language=de&profile=dbweb',
    base + '?duration=60&results=30&remarks=false&stopovers=false&language=de'
  ];
  let lastError = 'unbekannter Fehler';
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const upstream = await fetch(url, { signal: controller.signal, headers: { 'accept': 'application/json' } });
      if (!upstream.ok) { lastError = 'Bahn-API HTTP ' + upstream.status; continue; }
      const data = await upstream.json();
      const arrivals = Array.isArray(data) ? data : (data.arrivals || []);
      return res.status(200).json({ updatedAt: new Date().toISOString(), arrivals });
    } catch (e) {
      lastError = e.name === 'AbortError' ? 'Zeitüberschreitung der Bahn-API' : e.message;
    } finally {
      clearTimeout(timer);
    }
  }
  return res.status(502).json({ updatedAt: new Date().toISOString(), arrivals: [], error: lastError });
}
