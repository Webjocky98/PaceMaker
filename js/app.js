async function initialiseAppState(){
  loadAllState();

  try{
    profile = {
      ...DEFAULT_PROFILE,
      ...(await fetchProfileFromApi())
    };
  }catch(err){
    console.error('Failed to load profile from API:', err);
    profile = {...DEFAULT_PROFILE};
  }

  try{
    events = await fetchEventsFromApi();
  }catch(err){
    console.error('Failed to load events from API:', err);
    events = [];
  }

  try{
    sessions = await fetchSessionsFromApi();
  }catch(err){
    console.error('Failed to load sessions from API:', err);
    sessions = [];
  }

  const changed = runAdaptationIfNeeded();
  if(changed){
    try{
      profile = await saveProfileToApi(profile);
    }catch(err){
      console.error('Failed to save adapted profile to API:', err);
    }
  }
}

(async function boot(){
  try{
    await initialiseAppState();
    render();
  }catch(e){
    const app = document.getElementById('app');
    app.innerHTML = `<div class="banner">The app failed to start. Open browser console to inspect the error.<br><br>${escapeHtml(e.message || String(e))}</div>`;
    console.error(e);
  }
})();
