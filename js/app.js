function initialiseAppState(){
  loadAllState();

  if(profile.copenhagenGoal===null){
    profile.copenhagenGoal = Math.round(suggestedHalfGoalSeconds());
  }

  const changed = runAdaptationIfNeeded();
  if(changed) saveProfile();
}

(function boot(){
  try{
    initialiseAppState();
    saveProfile();
    render();
  }catch(e){
    const app = document.getElementById('app');
    app.innerHTML = `<div class="banner">The app failed to start. Open browser console to inspect the error.<br><br>${escapeHtml(e.message || String(e))}</div>`;
    console.error(e);
  }
})();
