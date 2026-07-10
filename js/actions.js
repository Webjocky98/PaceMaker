function openModal(id){
  document.getElementById(id).classList.add('open');
}

function closeModal(id){
  document.getElementById(id).classList.remove('open');
}

function showEffortPicker(){
  const el = document.getElementById('effortPicker');
  if(!el) return;

  const levels = [
    [3,'😌 Easy'],
    [5,'🙂 Moderate'],
    [7,'😤 Hard'],
    [9,'🥵 Very hard'],
    [10,'🔥 Max']
  ];

  el.innerHTML = `<div class="hint" style="margin-top:10px;">How did it feel?</div>
    <div class="effort-row">
      ${levels.map(([v,l])=>`<button class="btn secondary effort-btn" onclick="quickLog('${todayISO()}', true, ${v})">${l}</button>`).join('')}
    </div>`;
}

function quickLog(dateISO, completed, rpe){
  const plan = fullDayPlan(toDate(dateISO));
  const run = plan.run;

  sessions.push({
    date: dateISO,
    role: run.role,
    completed,
    distanceKm: run.km || null,
    durationSec: run.km ? Math.round(run.km * (paceZones().easy || 360)) : null,
    rpe: rpe,
    notes: null
  });

  saveSessions();
  render();
}

function selectRpe(n){
  pendingRpe = n;
  document.querySelectorAll('#rpeRow .rpe-dot').forEach(el=>{
    el.classList.toggle('sel', Number(el.dataset.n)===n);
  });
}

function addExerciseRow(){
  const list = document.getElementById('exerciseList');
  if(!list) return;

  const idx = list.querySelectorAll('.exercise-row').length;
  list.insertAdjacentHTML('beforeend', renderExerciseRow({name:'',sets:'',reps:'',weight:''}, idx));
}

function collectStrengthData(){
  const rows = [...document.querySelectorAll('#exerciseList .exercise-row')];

  const exercises = rows.map(row => ({
    name: (row.querySelector('.ex-name') && row.querySelector('.ex-name').value.trim()) || '',
    sets: (row.querySelector('.ex-sets') && row.querySelector('.ex-sets').value.trim()) || '',
    reps: (row.querySelector('.ex-reps') && row.querySelector('.ex-reps').value.trim()) || '',
    weight: (row.querySelector('.ex-weight') && row.querySelector('.ex-weight').value.trim()) || ''
  })).filter(ex => ex.name || ex.sets || ex.reps || ex.weight);

  return {
    strengthFocusText: (document.getElementById('strengthFocusText') && document.getElementById('strengthFocusText').value.trim()) || null,
    exercises,
    mobility: (document.getElementById('strengthMobility') && document.getElementById('strengthMobility').value.trim()) || null
  };
}

function toggleLogFieldsByRole(){
  const roleEl = document.getElementById('logRole');
  const role = roleEl ? roleEl.value : '';
  const runFields = document.getElementById('runFields');
  const strengthWrap = document.getElementById('strengthOnlyFields');

  if(runFields) runFields.style.display = role==='strength' ? 'none' : '';
  if(strengthWrap) strengthWrap.style.display = role==='strength' ? '' : 'none';
}

function openLogModal(dateISO){
  modalDate = dateISO || todayISO();
  pendingRpe = null;

  const d = toDate(modalDate);
  const plan = fullDayPlan(d);
  const run = plan.run;
  const strength = plan.strength;
  const existing = latestSessionForDate(modalDate);
  const dateLabel = d.toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});

  const existingRole = existing ? existing.role : null;
  const existingDistance = existing && existing.role!=='strength' ? (existing.distanceKm ?? run.km ?? '') : '';
  const existingMinutes = existing && existing.role!=='strength' && existing.durationSec ? Math.round(existing.durationSec/60) : '';
  const existingNotes = existing && existing.notes ? existing.notes : '';

  const body = document.getElementById('logModalBody');
  body.innerHTML = `
    <div class="hint" style="margin-bottom:10px;">
      ${escapeHtml(dateLabel)} — ${escapeHtml(run.title)} ${run.km ? '· '+run.km+'km planned' : ''}${strength ? ' · plus gym planned' : ''}
    </div>

    <label>Session type</label>
    <select id="logRole" onchange="toggleLogFieldsByRole()">
      <option value="${escapeHtml(run.role)}" ${(existingRole===run.role || !existing) ? 'selected' : ''}>${escapeHtml(run.role)} (planned run)</option>
      <option value="strength" ${existingRole==='strength' ? 'selected' : ''}>Strength</option>
      <option value="timetrial" ${existingRole==='timetrial' ? 'selected' : ''}>Time trial / race</option>
      <option value="quality" ${existingRole==='quality' ? 'selected' : ''}>Quality</option>
      <option value="steady" ${existingRole==='steady' ? 'selected' : ''}>Steady</option>
      <option value="easy" ${existingRole==='easy' ? 'selected' : ''}>Easy</option>
      <option value="long" ${existingRole==='long' ? 'selected' : ''}>Long run</option>
      <option value="rest" ${existingRole==='rest' ? 'selected' : ''}>Rest</option>
    </select>

    <div id="runFields">
      <div class="grid2">
        <div><label>Distance (km)</label><input id="logKm" type="number" step="0.1" min="0" value="${existingDistance}"></div>
        <div><label>Duration (min)</label><input id="logMin" type="number" step="1" min="0" value="${existingMinutes}"></div>
      </div>
    </div>

    <div id="strengthOnlyFields" style="display:none;">
      ${renderStrengthInputs(existingRole==='strength' ? existing : null)}
    </div>

    <label>How did it feel? (RPE 1–10)</label>
    <div class="rpe-row" id="rpeRow">
      ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<div class="rpe-dot ${existing && existing.rpe===n ? 'sel' : ''}" data-n="${n}" onclick="selectRpe(${n})">${n}</div>`).join('')}
    </div>

    <label>Notes (optional)</label>
    <textarea id="logNotes" rows="2" placeholder="How it went, weather, niggles, gym notes...">${escapeHtml(existingNotes)}</textarea>

    <div class="btn-row">
      <button class="btn" onclick="submitLog(true)">Save as completed</button>
      <button class="btn secondary" onclick="submitLog(false)">Mark as missed</button>
    </div>
  `;

  pendingRpe = existing && existing.rpe ? existing.rpe : null;
  openModal('logOverlay');
  toggleLogFieldsByRole();
}

function submitLog(completed){
  const role = document.getElementById('logRole').value;
  const notes = document.getElementById('logNotes').value.trim();

  const entry = {
    date: modalDate || todayISO(),
    role,
    completed,
    distanceKm: null,
    durationSec: null,
    rpe: pendingRpe,
    notes: notes || null
  };

  if(role === 'strength'){
    const strengthData = collectStrengthData();
    entry.strengthFocusText = strengthData.strengthFocusText;
    entry.exercises = strengthData.exercises;
    entry.mobility = strengthData.mobility;
  } else {
    const km = parseFloat(document.getElementById('logKm').value) || 0;
    const min = parseFloat(document.getElementById('logMin').value) || 0;
    entry.distanceKm = km || null;
    entry.durationSec = min ? min*60 : null;
  }

  sessions.push(entry);
  saveSessions();
  closeModal('logOverlay');
  render();
}

async function deleteSession(i){
  sessions.splice(i,1);
  saveSessions();
  render();
}

function parseHMS(str){
  const parts = str.trim().split(':').map(Number);
  if(parts.some(isNaN)) return null;
  if(parts.length===3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if(parts.length===2) return parts[0]*60 + parts[1];
  return null;
}

function toggleDay(el){
  el.classList.toggle('on');
}

function resetLoad(){
  profile.loadMultiplier = 1.0;
  render();
}

function openSettings(){
  const body = document.getElementById('settingsModalBody');
  const runDays = profile.trainingDays;
  const strengthDays = profile.strengthDays;
  const dayDefs = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[0,'Sun']];

  body.innerHTML = `
    <div class="settings-section">
      <label>Prior marathon time (h:mm:ss)</label>
      <input id="setPrior" value="${fmtHMS(profile.priorMarathonSeconds)}">
      <label>Goal marathon time (h:mm:ss)</label>
      <input id="setGoal" value="${fmtHMS(profile.goalMarathonSeconds)}">
    </div>

    <div class="settings-section">
      <label>Copenhagen Half Marathon date</label>
      <input id="setCph" type="date" value="${profile.copenhagenDate}">
      <label>Copenhagen goal time (h:mm:ss)</label>
      <input id="setCphGoal" value="${fmtHMS(profile.copenhagenGoal)}">
      <label>TCS London Marathon date</label>
      <input id="setLdn" type="date" value="${profile.londonDate}">
      <label>Plan start date</label>
      <input id="setStart" type="date" value="${profile.startDate}">
    </div>

    <div class="settings-section">
      <label>Running days</label>
      <div class="day-toggles" id="runDayToggles">
        ${dayDefs.map(([v,l])=>`<div class="day-toggle ${runDays.includes(v)?'on':''}" data-v="${v}" onclick="toggleDay(this)">${l}</div>`).join('')}
      </div>
      <div class="hint">Sessions are auto-assigned: first selected day = quality, last = long run, others easy/steady.</div>

      <label>Strength days</label>
      <div class="day-toggles" id="strengthDayToggles">
        ${dayDefs.map(([v,l])=>`<div class="day-toggle ${strengthDays.includes(v)?'on':''}" data-v="${v}" onclick="toggleDay(this)">${l}</div>`).join('')}
      </div>
      <div class="hint">Try to avoid placing your heaviest lower-body lifting the day before the long run.</div>
    </div>

    <div class="settings-section">
      <label>Usual training time of day</label>
      <select id="setTod">
        <option value="morning" ${profile.trainingTimeOfDay==='morning'?'selected':''}>Morning</option>
        <option value="lunchtime" ${profile.trainingTimeOfDay==='lunchtime'?'selected':''}>Lunchtime</option>
        <option value="evening" ${profile.trainingTimeOfDay==='evening'?'selected':''}>Evening</option>
      </select>

      <label>Dietary preference</label>
      <select id="setDiet">
        <option value="none" ${profile.dietaryPref==='none'?'selected':''}>No restrictions</option>
        <option value="vegetarian" ${profile.dietaryPref==='vegetarian'?'selected':''}>Vegetarian</option>
        <option value="vegan" ${profile.dietaryPref==='vegan'?'selected':''}>Vegan</option>
      </select>

      <label>Strength focus</label>
      <select id="setStrengthFocus">
        <option value="balanced" ${profile.strengthFocus==='balanced'?'selected':''}>Balanced</option>
        <option value="lower" ${profile.strengthFocus==='lower'?'selected':''}>Lower-body growth</option>
        <option value="performance" ${profile.strengthFocus==='performance'?'selected':''}>Running performance</option>
      </select>
    </div>

    <div class="settings-section">
      <div class="hint">Current load multiplier: ${profile.loadMultiplier}</div>
      <button class="btn secondary" onclick="resetLoad()">Reset to plan defaults</button>
    </div>

    <div class="btn-row">
      <button class="btn" onclick="saveSettings()">Save settings</button>
    </div>
  `;

  openModal('settingsOverlay');
}

function saveSettings(){
  const prior = parseHMS(document.getElementById('setPrior').value);
  const goal = parseHMS(document.getElementById('setGoal').value);
  const cphGoal = parseHMS(document.getElementById('setCphGoal').value);

  if(prior) profile.priorMarathonSeconds = prior;
  if(goal) profile.goalMarathonSeconds = goal;
  if(cphGoal) profile.copenhagenGoal = cphGoal;

  profile.copenhagenDate = document.getElementById('setCph').value || profile.copenhagenDate;
  profile.londonDate = document.getElementById('setLdn').value || profile.londonDate;
  profile.startDate = document.getElementById('setStart').value || profile.startDate;
  profile.trainingTimeOfDay = document.getElementById('setTod').value;
  profile.dietaryPref = document.getElementById('setDiet').value;
  profile.strengthFocus = document.getElementById('setStrengthFocus').value;

  const chosenRun = [...document.querySelectorAll('#runDayToggles .day-toggle.on')].map(el=>Number(el.dataset.v));
  const chosenStrength = [...document.querySelectorAll('#strengthDayToggles .day-toggle.on')].map(el=>Number(el.dataset.v));

  if(chosenRun.length >= 2) profile.trainingDays = chosenRun;
  profile.strengthDays = chosenStrength;

  saveProfile();
  closeModal('settingsOverlay');
  render();
}
