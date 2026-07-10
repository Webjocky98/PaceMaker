async function askCoach(){
  const btn = document.getElementById('coachBtn');
  const out = document.getElementById('coachOut');
  const meta = document.getElementById('coachMeta');

  if(btn) btn.disabled = true;
  if(out) out.innerHTML = '<span class="spinner"></span> Your coach is reviewing your recent training…';

  try{
    const recent = sessions.slice(-14).map(s =>
      `${s.date}: ${s.role}, ${s.completed?'completed':'missed'}, ${s.distanceKm ? s.distanceKm+'km' : ''}${s.rpe ? ', RPE '+s.rpe : ''}${s.notes ? ', notes: '+s.notes : ''}`
    );

    const today = toDate(todayISO());
    const phase = phaseForDate(today);

    const payload = {
      profile: {
        priorMarathonSeconds: profile.priorMarathonSeconds,
        goalMarathonSeconds: profile.goalMarathonSeconds,
        copenhagenDate: profile.copenhagenDate,
        londonDate: profile.londonDate,
        loadMultiplier: profile.loadMultiplier,
        strengthFocus: profile.strengthFocus
      },
      phase: {
        key: phase.key,
        idx: phase.idx,
        name: PHASE_META[phase.key] ? PHASE_META[phase.key].name : phase.key,
        desc: PHASE_META[phase.key] ? PHASE_META[phase.key].desc : ''
      },
      recentSessions: recent
    };

    const response = await fetch('/api/coach', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    if(!response.ok) throw new Error('coach endpoint unavailable');

    const data = await response.json();
    const text = data && data.text ? String(data.text) : 'Coach response received, but no text was returned.';
    const cache = {text, ts: Date.now()};
    saveLocal(KEYS.coach, cache);

    if(out) out.textContent = cache.text;
    if(meta) meta.textContent = 'Last updated ' + new Date(cache.ts).toLocaleString();
  }catch(e){
    const cached = loadLocal(KEYS.coach);

    if(cached && out){
      out.textContent = cached.text;
      if(meta) meta.textContent = 'Showing cached note from ' + new Date(cached.ts).toLocaleString();
    } else if(out){
      out.textContent = 'Coach endpoint not available yet. The rest of the plan still works locally. When hosted, connect this button to your secure /api/coach backend.';
      if(meta) meta.textContent = '';
    }

    console.error(e);
  }finally{
    if(btn) btn.disabled = false;
  }
}

async function requestAdaptivePlan(){
  const btn = document.getElementById('adaptBtn');
  const out = document.getElementById('coachOut');
  const meta = document.getElementById('coachMeta');

  if(btn) btn.disabled = true;
  if(out) out.innerHTML = '<span class="spinner"></span> Reviewing your recent training and adjusting upcoming sessions…';

  try{
    const today = toDate(todayISO());
    const phase = phaseForDate(today);

    const recentSessions = sessions.slice(-21).map(s => ({
      date: s.date,
      role: s.role,
      completed: s.completed,
      distanceKm: s.distanceKm || null,
      durationSec: s.durationSec || null,
      rpe: s.rpe || null,
      notes: s.notes || null,
      exercises: s.exercises || null,
      mobility: s.mobility || null
    }));

    const upcoming = [];
    for(let i=0;i<21;i++){
      const d = addDays(today, i);
      const plan = fullDayPlan(d);
      upcoming.push({
        date: fmtISO(d),
        run: plan.run,
        strength: plan.strength
      });
    }

    const payload = {
      profile: {
        goalMarathonSeconds: profile.goalMarathonSeconds,
        priorMarathonSeconds: profile.priorMarathonSeconds,
        copenhagenDate: profile.copenhagenDate,
        londonDate: profile.londonDate,
        trainingDays: profile.trainingDays,
        strengthDays: profile.strengthDays,
        strengthFocus: profile.strengthFocus,
        loadMultiplier: profile.loadMultiplier
      },
      phase: {
        key: phase.key,
        idx: phase.idx,
        name: PHASE_META[phase.key] ? PHASE_META[phase.key].name : phase.key,
        desc: PHASE_META[phase.key] ? PHASE_META[phase.key].desc : ''
      },
      recentSessions,
      upcomingPlan: upcoming
    };

    const response = await fetch('/api/adapt-plan', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    if(!response.ok) throw new Error('adapt endpoint unavailable');

    const data = await response.json();

    if(!data || !Array.isArray(data.adaptations)){
      throw new Error('invalid adaptation response');
    }

    data.adaptations.forEach(item => {
      if(!item.date) return;
      adaptations[item.date] = {
        ...(adaptations[item.date] || {}),
        ...(item.run ? {run:item.run} : {}),
        ...(item.strength !== undefined ? {strength:item.strength} : {})
      };
    });

    saveAdaptations();

    if(out) out.textContent = data.summary || 'Upcoming plan adapted successfully.';
    if(meta) meta.textContent = 'Plan adapted ' + new Date().toLocaleString();

    render();
  }catch(e){
    if(out) out.textContent = 'Adaptive planning is not available yet. Your base plan still works normally.';
    if(meta) meta.textContent = '';
    console.error(e);
  }finally{
    if(btn) btn.disabled = false;
  }
}

function clearAdaptations(){
  adaptations = {};
  saveAdaptations();
  render();
}

async function sendCoachChat(){
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');

  if(!input) return;

  const message = input.value.trim();
  if(!message) return;

  chatHistory.push({role:'user', text:message, ts:Date.now()});
  saveChatHistory();
  render();

  if(btn) btn.disabled = true;

  try{
    const today = toDate(todayISO());
    const phase = phaseForDate(today);

    const upcoming = [];
    for(let i=0;i<21;i++){
      const d = addDays(today, i);
      const plan = fullDayPlan(d);
      upcoming.push({
        date: fmtISO(d),
        run: plan.run,
        strength: plan.strength
      });
    }

    const payload = {
      message,
      profile: {
        priorMarathonSeconds: profile.priorMarathonSeconds,
        goalMarathonSeconds: profile.goalMarathonSeconds,
        copenhagenDate: profile.copenhagenDate,
        londonDate: profile.londonDate,
        trainingDays: profile.trainingDays,
        strengthDays: profile.strengthDays,
        strengthFocus: profile.strengthFocus,
        loadMultiplier: profile.loadMultiplier
      },
      phase: {
        key: phase.key,
        idx: phase.idx,
        name: PHASE_META[phase.key] ? PHASE_META[phase.key].name : phase.key,
        desc: PHASE_META[phase.key] ? PHASE_META[phase.key].desc : ''
      },
      recentSessions: sessions.slice(-28),
      upcomingPlan: upcoming,
      existingAdaptations: adaptations,
      chatHistory: chatHistory.slice(-12)
    };

    const response = await fetch('/api/coach-chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    if(!response.ok) throw new Error('coach chat endpoint unavailable');

    const data = await response.json();

    const reply = data.reply || 'I reviewed your message, but I do not have a detailed response.';
    chatHistory.push({role:'assistant', text:reply, ts:Date.now()});
    saveChatHistory();

    pendingChatAdaptations = Array.isArray(data.adaptations) ? data.adaptations : [];
    input.value = '';
    render();
  }catch(e){
    chatHistory.push({
      role:'assistant',
      text:'Coach chat is not available right now. Your message was saved locally, but no AI response was returned.',
      ts:Date.now()
    });
    saveChatHistory();
    render();
    console.error(e);
  }finally{
    if(btn) btn.disabled = false;
  }
}

function applyPendingChatAdaptations(){
  if(!pendingChatAdaptations.length) return;

  pendingChatAdaptations.forEach(item => {
    if(!item.date) return;
    adaptations[item.date] = {
      ...(adaptations[item.date] || {}),
      ...(item.run ? {run:item.run} : {}),
      ...(item.strength !== undefined ? {strength:item.strength} : {})
    };
  });

  saveAdaptations();
  pendingChatAdaptations = [];
  render();
}

function discardPendingChatAdaptations(){
  pendingChatAdaptations = [];
  render();
}
