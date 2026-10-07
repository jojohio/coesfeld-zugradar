export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=180');

  const now = new Date();
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const datum = p.year+'-'+p.month+'-'+p.day;
  const zeit = p.hour+':'+p.minute+':'+p.second;

  const q = new URLSearchParams({
    datum, zeit, ortExtId:'8000066', mitVias:'true', maxVias:'8'
  });
  ['ICE','EC_IC','IR','REGIONAL','SBAHN'].forEach(v=>q.append('verkehrsmittel[]',v));
  const url='https://www.bahn.de/web/api/reiseloesung/ankuenfte?'+q.toString();

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try {
    const upstream=await fetch(url,{
      signal:controller.signal,
      headers:{
        'accept':'application/json, text/plain, */*',
        'accept-language':'de-DE,de;q=0.9',
        'referer':'https://www.bahn.de/buchung/abfahrten-ankuenfte',
        'user-agent':'Mozilla/5.0'
      }
    });
    if(!upstream.ok) throw new Error('bahn.de HTTP '+upstream.status);
    const data=await upstream.json();
    const entries=Array.isArray(data)?data:(data.entries||[]);
    const arrivals=entries.map(x=>({
      tripId:x.journeyId||x.journeyID,
      line:{name:x.verkehrmittel?.mittelText||x.verkehrmittel?.kurzText||x.verkehrsmittel?.mittelText||x.verkehrsmittel?.kurzText||x.zugName||'Zug'},
      plannedWhen:x.zeit||null,
      when:x.ezZeit||x.zeit||null,
      platform:x.ezGleis||x.gleis||null,
      plannedPlatform:x.gleis||null,
      origin:{name:(Array.isArray(x.ueber)&&x.ueber.length?x.ueber[0]:(x.origin||x.start||'unbekannt'))},
      cancelled:Boolean(x.cancelled||x.canceled||(x.meldungen||[]).some(m=>m.type==='HALT_AUSFALL'))
    }));
    return res.status(200).json({updatedAt:new Date().toISOString(),source:'bahn.de',arrivals});
  } catch(e) {
    return res.status(e.name==='AbortError'?504:502).json({updatedAt:new Date().toISOString(),arrivals:[],error:e.name==='AbortError'?'bahn.de Zeitüberschreitung':e.message});
  } finally { clearTimeout(timer); }
}
