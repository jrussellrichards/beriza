'use strict';
const axios=require('axios');
const cache=new Map();
async function geocode(address){
  if(!address)return null;
  const k=address.toLowerCase().trim();
  if(cache.has(k))return cache.get(k);
  try{
    const r=await axios.get('https://maps.googleapis.com/maps/api/geocode/json',{params:{address,key:process.env.GEOCODER_API_KEY,language:'es',region:'CL'},timeout:5000});
    const loc=r.data?.results?.[0]?.geometry?.location;
    if(!loc)return null;
    const res={lat:parseFloat(loc.lat.toFixed(7)),lon:parseFloat(loc.lng.toFixed(7))};
    cache.set(k,res);if(cache.size>5000)cache.delete(cache.keys().next().value);
    return res;
  }catch{return null;}
}
module.exports={geocode};
