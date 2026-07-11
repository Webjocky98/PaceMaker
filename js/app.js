async function initialiseAppState(){
  loadAllState();

  try{
    events = await fetchEventsFromApi();
  }catch(err){
    console.error('Failed to load events from API:', err);
    events = [];
  }

  const changed = runAdaptationIfNeeded();
  if(changed) saveProfile();
}

(async function boot(){
  try{
    await initialiseAppState();
    saveProfile();
    render();
  }catch(e){
    const app = document.getElementById('app');
    app.innerHTML = `<div class="banner">The app failed to start. Open browser console to inspect the error.<br><br>${escapeHtml(e.message || String(e))}</div>`;
    console.error(e);
  }
})();
