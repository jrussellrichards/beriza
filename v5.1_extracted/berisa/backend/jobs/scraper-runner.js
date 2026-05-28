'use strict';
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const{runScraper,SOURCES}=require('../services/scraper');
const target=process.argv[2];
const toRun=target?[target]:Object.keys(SOURCES);
(async()=>{
  for(const src of toRun){
    console.log(`\n── ${src.toUpperCase()} ──`);
    try{console.log(JSON.stringify(await runScraper(src),null,2));}
    catch(e){console.error('FAILED:',e.message);}
  }
  process.exit(0);
})();
