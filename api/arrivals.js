export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=180');
  const headers = { accept:'application/json', 'user-agent':'Coesfeld-Zugradar/1.0 (open-source school project)' };
  const get = async (url) => {
    const c=new AbortController(), t=setTimeout(()=>c.abort(),8000);
    try {
      const r=await fetch(url,{headers,signal:c.signal});
      const body=await r.text();
      if(!r.ok) throw new Error('Transitous HTTP '+r.status+': '+body.slice(0,180));
      return JSON.parse(body);
    } finally { clearTimeout(t); }
  };
  try {
    // Resolve the stop dynamically, so the app does not depend on DB EVA/HAFAS IDs.
    const geo=await get('https://api.transitous.org/api/v1/geocode?text='+encodeURIComponent('Coesfeld Westf')+'&type=STOP');
    const features=geo.features||[];
    const feature=features.find(x=>/coesfeld/i.test(x.properties?.name||x.properties?.label||''))||features[0];
    const stopId=feature?.properties?.id||feature?.properties?.stopId||feature?.id;
    if(!stopId) throw new Error('Coesfeld (Westf) wurde bei Transitous nicht gefunden');
    const q=new URLSearchParams({stopId,n:'60',arriveBy:'true',direction:'EARLIER',fetchStops:'true',realtimeMode:'REALTIME',language:'de',withAlerts:'false'});
    const data=await get('https://api.transitous.org/api/v6/stoptimes?'+q);
    const arrivals=(data.stopTimes||[]).map(x=>({
      tripId:x.tripId,
      line:{name:x.displayName||x.routeShortName||x.tripShortName||'Zug'},
      plannedWhen:x.place?.scheduledArrival||x.scheduledArrival||null,
      when:x.place?.arrival||x.arrival||x.place?.scheduledArrival||x.scheduledArrival||null,
      platform:x.place?.track||null,
      plannedPlatform:x.place?.scheduledTrack||null,
      origin:{name:x.tripFrom?.name||'unbekannt'},
      cancelled:Boolean(x.cancelled||x.tripCancelled),
      realTime:Boolean(x.realTime),
      previousStops:x.previousStops||x.stops||[]
    }));
    return res.status(200).json({updatedAt:new Date().toISOString(),source:'Transitous/MOTIS',stopId,arrivals});
  } catch(e) {
    return res.status(200).json({updatedAt:new Date().toISOString(),source:'Transitous/MOTIS',arrivals:[],diagnostic:true,error:e.name==='AbortError'?'Transitous Zeitüberschreitung':e.message});
  }
}
