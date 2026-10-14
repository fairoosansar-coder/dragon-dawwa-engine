(async()=>{
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const results={viewport:{width:innerWidth,height:innerHeight},userAgent:navigator.userAgent,screens:[],controls:[],errors:[]};
 window.addEventListener('error',e=>results.errors.push(e.message));
 const ids=[...Array.from({length:33},(_,i)=>'screen-'+(i+1)),'mosque-current-site','mosque-proposed-design','mosque-construction','mosque-finances','mosque-donations','podcasts'];
 for(const id of ids){
  location.hash='/'+id;await pause(180);
  const h=document.querySelector('.uc-page-heading h1');
  results.screens.push({id,title:h?.textContent,nonempty:!!document.querySelector('main')?.textContent.trim(),overflow:document.documentElement.scrollWidth>results.viewport.width+1,scrollWidth:document.documentElement.scrollWidth});
  for(const btn of document.querySelectorAll('.uc-template button,.uc-template [data-action]')){
   if(!btn.getClientRects().length)continue;
   const before=location.hash;btn.click();await pause(30);
   results.controls.push({id,label:btn.textContent.trim(),responded:location.hash!==before||!!document.querySelector('dialog[open]')||btn.classList.contains('sel')||document.activeElement?.tagName==='INPUT'});
   document.querySelector('dialog[open] button')?.click();
  }
 }
 location.hash='/screen-23';await pause(200);
 const tabs=[];for(const link of document.querySelectorAll('.uc-mosque-tabs a')){const route=link.hash;link.click();await pause(100);tabs.push({route,passed:location.hash===route});}
 results.mosqueTabs=tabs;
 location.hash='/screen-7';await pause(150);
 const search=document.querySelector('input[aria-label="Search all screens"]');if(search){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,'mosque');search.dispatchEvent(new Event('input',{bubbles:true}));await pause(100);results.searchMatches=document.querySelectorAll('.uc-directory-card').length;}
 const menu=document.querySelector('[aria-label="Open all screens"]');menu.click();await pause(50);results.menuExpanded=menu.getAttribute('aria-expanded')==='true';menu.click();
 location.hash='/screen-4';await pause(300);
 const output=document.createElement('script');output.type='application/json';output.id='qa-complete';output.textContent=JSON.stringify(results);document.body.append(output);
})();
