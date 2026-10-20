/**
 * Inline <head> script: remembers utm_* parameters from the landing URL for
 * this browser tab only (sessionStorage, no cookies), before any other code
 * runs, so a visitor who moves on quickly is still attributed. Read back with
 * readCampaign() (CampaignCapture.tsx).
 */
export const CAMPAIGN_HEAD_SCRIPT = `try{var q=new URLSearchParams(location.search),k=["utm_source","utm_medium","utm_campaign"];if(k.some(function(x){return q.get(x)})){var c={};k.forEach(function(x){c[x]=(q.get(x)||"").slice(0,150)});sessionStorage.setItem("dm_campaign",JSON.stringify(c))}}catch(e){}`;
