export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','s-maxage=45, stale-while-revalidate=180');
  const headers={accept:'application/json','user-agent':'Coesfeld-Zugradar/1.0 (+https://github.com/jojohio/coesfeld-zugradar)'};
  const get=async(url)=>{
    const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);
    try{const r=await fetch(url,{headers,signal:c.signal});const body=await r.text();if(!r.ok)throw Error('Transitous HTTP '+r.status+': '+body.slice(0,180));return JSON.parse(body)}
    finally{clearTimeout(t)}
  };
  try{
    // Coesfeld (Westf) coordinates. MOTIS v6 explicitly supports center+radius
    // as a robust fallback when stop IDs are unknown or change.
    const q=new URLSearchParams({
      center:'51.9382,7.1628',
      radius:'700',
      exactRadius:'false',
      arriveBy:'true',
      direction:'EARLIER',
      n:'80',
      window:'21600',
      fetchStops:'true',
      realtimeMode:'REALTIME_ANNOTATION_ONLY',
      language:'de',
      withAlerts:'false'
    });
    const data=await get('https://api.transitous.org/api/v6/stoptimes?'+q.toString());
    const arrivals=(data.stopTimes||[]).map(x=>{
      const p=x.place||{};
      const prev=x.previousStops||[];
      const lastPrev=prev.length?prev[prev.length-1]:null;
      return {
        tripId:x.tripId,
        line:{name:x.displayName||x.routeShortName||x.tripShortName||'Zug'},
        plannedWhen:p.scheduledArrival||null,
        when:p.arrival||p.scheduledArrival||null,
        platform:p.track||p.scheduledTrack||null,
        plannedPlatform:p.scheduledTrack||null,
        origin:{name:lastPrev?.name||x.tripFrom?.name||'unbekannt'},
        cancelled:Boolean(x.cancelled||x.tripCancelled),
        realTime:Boolean(x.realTime),
        previousStops:prev
      };
    }).filter(x=>x.plannedWhen);
    return res.status(200).json({updatedAt:new Date().toISOString(),source:'Transitous/MOTIS',station:data.place?.name||'Coesfeld (Westf)',arrivals});
  }catch(e){
    return res.status(200).json({updatedAt:new Date().toISOString(),source:'Transitous/MOTIS',arrivals:[],diagnostic:true,error:e.name==='AbortError'?'Transitous Zeitüberschreitung':e.message});
  }
}
