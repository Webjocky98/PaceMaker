function roundKm(x){
  return Math.round(x*10)/10;
}

function riegel(t1,d1,d2,exp){
  exp = exp || 1.06;
  return t1 * Math.pow(d2/d1, exp);
}

function estimate5kSeconds(){
  const trials = sessions
    .filter(s => s.role==='timetrial' && s.completed && s.distanceKm>0 && s.durationSec>0)
    .sort((a,b)=> b.date.localeCompare(a.date));

  if(trials.length){
    const t = trials[0];
    return riegel(t.durationSec, t.distanceKm, KM_5K);
  }

  const buffer = 1.10;
  return riegel(profile.priorMarathonSeconds, KM_MARATHON, KM_5K) * buffer;
}

function getUpcomingEvents(fromDate){
  const from = fromDate || toDate(todayISO());
  return [...events]
    .filter(e => e.status !== 'cancelled' && toDate(e.date) >= from)
    .sort((a,b)=>a.date.localeCompare(b.date));
}

function getPrimaryEvent(fromDate){
  const upcoming = getUpcomingEvents(fromDate);
  if(!upcoming.length) return null;

  const aPriority = upcoming.find(e => e.priority === 'A');
  if(aPriority) return aPriority;

  const bPriority = upcoming.find(e => e.priority === 'B');
  if(bPriority) return bPriority;

  return upcoming[0];
}

function getNextEvent(fromDate){
  const upcoming = getUpcomingEvents(fromDate);
  return upcoming.length ? upcoming[0] : null;
}

function goalSecondsForPrimaryEvent(){
  const primary = getPrimaryEvent();
  if(!primary || !primary.goalSeconds) return 4 * 3600;
  return primary.goalSeconds;
}

function paceZones(){
  const t5k = estimate5kSeconds();
  const p5k = t5k / KM_5K;
  const primary = getPrimaryEvent();
  const primaryDistance = primary ? (eventDistanceKm(primary) || KM_MARATHON) : KM_MARATHON;
  const goalRacePace = goalSecondsForPrimaryEvent() / primaryDistance;

  return {
    easy: p5k * 1.28,
    long: p5k * 1.30,
    steady: (p5k * 1.28 + p5k * 1.07) / 2,
    threshold: p5k * 1.07,
    interval: p5k * 1.00,
    goalRace: goalRacePace
  };
}

function fmtPace(secPerKm){
  secPerKm = Math.max(120, secPerKm);
  const m = Math.floor(secPerKm/60);
  const s = Math.round(secPerKm%60);
  const perMile = secPerKm * 1.60934;
  const mm = Math.floor(perMile/60);
  const ss = Math.round(perMile%60);
  return `${m}:${String(s).padStart(2,'0')}/km · ${mm}:${String(ss).padStart(2,'0')}/mi`;
}

function fmtHMS(totalSec){
  totalSec = Math.round(totalSec);
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

function suggestedHalfGoalSeconds(){
  return riegel(profile.priorMarathonSeconds, KM_MARATHON, KM_HALF) * 1.05;
}

function primaryEventDistanceKm(){
  const primary = getPrimaryEvent();
  return primary ? (eventDistanceKm(primary) || KM_MARATHON) : KM_MARATHON;
}

function phaseBoundaries(){
  const start = mondayOf(toDate(profile.startDate));
  const primary = getPrimaryEvent(start);

  if(!primary){
    const fallback = addWeeks(start, 24);
    return {
      start,
      primaryEvent: null,
      targetDate: fallback,
      distanceKm: KM_MARATHON,
      baseStart: start,
      buildStart: addWeeks(fallback, -13),
      taperStart: addWeeks(fallback, -3),
      recoveryStart: addDays(fallback, 1)
    };
  }

  const targetDate = toDate(primary.date);
  const distanceKm = eventDistanceKm(primary) || KM_MARATHON;

  let baseStart;
  let buildStart;
  let taperStart;

  if(distanceKm <= 10){
    baseStart = mondayOf(addWeeks(targetDate, -8));
    buildStart = baseStart;
    taperStart = mondayOf(addWeeks(targetDate, -1));
  } else if(distanceKm <= KM_HALF){
    baseStart = mondayOf(addWeeks(targetDate, -10));
    buildStart = mondayOf(addWeeks(targetDate, -8));
    taperStart = mondayOf(addWeeks(targetDate, -2));
  } else {
    baseStart = mondayOf(addWeeks(targetDate, -20));
    buildStart = mondayOf(addWeeks(targetDate, -13));
    taperStart = mondayOf(addWeeks(targetDate, -3));
  }

  const recoveryStart = mondayOf(addDays(targetDate, 1));

  return {
    start,
    primaryEvent: primary,
    targetDate,
    distanceKm,
    baseStart,
    buildStart,
    taperStart,
    recoveryStart
  };
}

function phaseForDate(d){
  const b = phaseBoundaries();

  if(d > b.targetDate) return {key:'done', idx:0, b};

  if(d < b.baseStart){
    return {key:'base', idx:Math.floor(daysBetween(b.start,d)/7)+1, b};
  }

  if(d < b.buildStart){
    return {key:'base', idx:Math.floor(daysBetween(b.baseStart,d)/7)+1, b};
  }

  if(d < b.taperStart){
    return {key:'build', idx:Math.floor(daysBetween(b.buildStart,d)/7)+1, b};
  }

  if(d <= b.targetDate){
    return {key:'taper', idx:Math.floor(daysBetween(b.taperStart,d)/7)+1, b};
  }

  return {key:'done', idx:0, b};
}

function sortedTrainingDays(){
  return [...profile.trainingDays].sort((a,b)=>((a+6)%7)-((b+6)%7));
}

function roleForWeekday(wd){
  const days = sortedTrainingDays();
  const pos = days.indexOf(wd===7 ? 0 : wd);

  if(pos===-1) return 'rest';

  const n = days.length;
  const templates = {
    2:['quality','long'],
    3:['quality','easy','long'],
    4:['quality','easy','steady','long'],
    5:['quality','easy','steady','easy','long'],
    6:['quality','easy','steady','easy','steady','long'],
    7:['quality','easy','steady','easy','steady','easy','long']
  };

  const t = templates[n] || templates[4];
  return t[pos];
}

function hasStrengthDay(date){
  return profile.strengthDays.includes(date.getDay());
}

function baseWeekSession(role, idx, targetDistanceKm){
  const lm = profile.loadMultiplier;
  const cutback = idx>1 && idx%4===0;
  const cb = cutback ? 0.82 : 1;

  const isMarathon = targetDistanceKm >= KM_MARATHON - 1;
  const easyCap = isMarathon ? 9 : 8;
  const steadyCap = isMarathon ? 11 : 9;
  const longCap = targetDistanceKm <= 10 ? 12 : targetDistanceKm <= KM_HALF ? 18 : 24;

  const easyKm = roundKm(Math.min(4 + (idx-1)*0.8, easyCap) * lm * cb);
  const steadyKm = roundKm(Math.min(5 + (idx-1)*0.8, steadyCap) * lm * cb);
  const longKm = roundKm(Math.min(6 + (idx-1)*1.5, longCap) * lm * cb);

  if(role==='quality') return {
    title: cutback ? 'Easy run + strides (cutback)' : 'Easy run + strides',
    km: easyKm,
    detail:'Run easy throughout, then finish with 5–6 x 20 sec relaxed strides with full walk/jog recovery.'
  };

  if(role==='long') return {
    title: cutback ? 'Long run (cutback week)' : 'Long run',
    km: longKm,
    detail:'Conversational effort throughout. The goal is gentle aerobic development, not speed.'
  };

  if(role==='steady') return {
    title:'Steady run',
    km: steadyKm,
    detail:'Controlled steady effort — comfortably harder than easy, but nowhere near race effort.'
  };

  return {
    title:'Easy run',
    km: easyKm,
    detail:'Easy, relaxed effort. You should be able to speak in full sentences.'
  };
}

const HALF_WEEKS = [
  {long:8,  quality:'6 x 2 min @ threshold effort, 2 min jog recovery', qualityKm:6, easy:5, steady:6},
  {long:9,  quality:'20 min continuous tempo', qualityKm:6.5, easy:5, steady:6},
  {long:11, quality:'5 x 3 min @ threshold, 90 sec jog recovery', qualityKm:7, easy:6, steady:7},
  {long:8,  quality:'Easy run + 6 x 20 sec strides', qualityKm:5, easy:5, steady:5},
  {long:13, quality:'25 min continuous tempo', qualityKm:8, easy:6, steady:8},
  {long:15, quality:'6 x 4 min @ threshold, 2 min jog recovery', qualityKm:8, easy:6, steady:8},
  {long:10, quality:'4 x 3 min @ half marathon goal pace, full recovery', qualityKm:6, easy:5, steady:5},
  {long:5,  quality:'20 min easy + 4 strides, then rest', qualityKm:4, easy:4, steady:0}
];

function halfBuildSession(role, idx){
  const w = HALF_WEEKS[Math.min(idx,8)-1];
  const lm = profile.loadMultiplier;

  if(role==='long') return {
    title:'Long run',
    km:roundKm(w.long*lm),
    detail:'Easy effort, with good control. In later weeks, finish a little stronger if specified.'
  };

  if(role==='quality') return {
    title:'Quality session',
    km:roundKm(w.qualityKm*lm),
    detail:w.quality
  };

  if(role==='steady') return {
    title:'Steady run',
    km:roundKm(w.steady*lm),
    detail:'Steady, comfortably hard effort.'
  };

  return {
    title:'Easy run',
    km:roundKm(w.easy*lm),
    detail:'Easy, relaxed effort. Recovery from the last harder session.'
  };
}

function tenKBuildSession(role, idx){
  const lm = profile.loadMultiplier;
  const cutback = idx>1 && idx%4===0;
  const cb = cutback ? 0.82 : 1;

  const easyKm = roundKm(Math.min(5 + (idx-1)*0.7, 8) * lm * cb);
  const steadyKm = roundKm(Math.min(6 + (idx-1)*0.7, 10) * lm * cb);
  const longKm = roundKm(Math.min(8 + (idx-1)*1.2, 16) * lm * cb);

  if(role==='quality'){
    const sessions10k = [
      '8 x 400m @ 5K effort, 200m jog recovery',
      '5 x 800m @ 10K effort, 2 min jog recovery',
      '20 min tempo',
      '6 x 3 min @ threshold, 90 sec jog recovery'
    ];
    return {
      title:'Quality session',
      km:roundKm((6 + idx*0.4) * lm * cb),
      detail:sessions10k[(idx-1) % sessions10k.length]
    };
  }

  if(role==='long') return {
    title: cutback ? 'Long run (cutback week)' : 'Long run',
    km: longKm,
    detail:'Easy conversational effort. Keep this controlled.'
  };

  if(role==='steady') return {
    title:'Steady run',
    km: steadyKm,
    detail:'Steady, controlled effort with good rhythm.'
  };

  return {
    title:'Easy run',
    km: easyKm,
    detail:'Easy, relaxed effort.'
  };
}

function marathonBuildSession(role, idx){
  const lm = profile.loadMultiplier;
  const BUILD_WEEKS = [
    {long:18, q:'4 x 1.6km @ threshold, 2 min jog recovery', qkm:10},
    {long:20, q:'3 x 3km @ marathon pace, 2 min jog recovery', qkm:12},
    {long:16, q:'Easy run + 6 x 20 sec strides', qkm:7, cutback:true},
    {long:22, q:'6 x 1km @ threshold, 90 sec jog recovery', qkm:11},
    {long:24, q:'4 x 3km @ marathon pace, 2 min jog recovery', qkm:14},
    {long:17, q:'30 min continuous tempo', qkm:9, cutback:true},
    {long:26, q:'8 x 800m @ 10K effort, 90 sec jog recovery', qkm:11},
    {long:29, q:'5 x 3km @ marathon pace, 90 sec jog recovery', qkm:16, mpLong:true},
    {long:18, q:'Easy run + strides', qkm:7, cutback:true},
    {long:31, q:'35 min continuous tempo', qkm:10, mpLong:true},
    {long:20, q:'6 x 1km @ threshold, 90 sec jog recovery', qkm:11},
    {long:24, q:'3 x 5km @ marathon pace, 3 min jog recovery', qkm:18, mpLong:true},
    {long:16, q:'Easy run + strides — legs should feel fresh', qkm:6, cutback:true}
  ];

  const w = BUILD_WEEKS[Math.min(idx,13)-1];

  if(role==='long'){
    const km = roundKm(w.long * lm);
    const detail = w.mpLong
      ? 'Easy effort early, then run the final 8–10km at goal race pace.'
      : (w.cutback ? 'Easy, relaxed effort — cutback week.' : 'Easy, conversational effort throughout.');
    return {title: w.cutback ? 'Long run (cutback week)' : 'Long run', km, detail};
  }

  if(role==='quality') return {
    title:'Quality session',
    detail:w.q,
    km:roundKm(w.qkm*lm)
  };

  if(role==='steady') return {
    title:'Steady run',
    km:roundKm(10*lm),
    detail:'A notch quicker than easy.'
  };

  return {
    title:'Easy run',
    km:roundKm(8*lm),
    detail:'Easy, relaxed effort.'
  };
}

function recoverySession(role, idx, targetDistanceKm){
  const lm = Math.min(profile.loadMultiplier, 1.0);
  const easyKm = roundKm((4 + Math.min(idx,2)) * lm);

  if(role==='long') return {
    title:'Gentle longer run',
    km:roundKm((targetDistanceKm <= KM_HALF ? 6 + idx : 8 + idx) * lm),
    detail:'Keep this properly easy. The goal is freshening up after the event.'
  };

  if(role==='quality') return {
    title:'Easy run + strides',
    km:easyKm,
    detail:'No real quality this phase — just easy running and 4–5 relaxed strides.'
  };

  if(role==='steady') return {
    title:'Easy steady run',
    km:roundKm((5 + idx) * lm),
    detail:'Stay controlled. This should feel smooth, not taxing.'
  };

  return {
    title:'Recovery jog',
    km:easyKm,
    detail:'Very easy. Finish feeling better than when you started.'
  };
}

function taperSession(role, idx, targetDistanceKm){
  const isMarathon = targetDistanceKm >= KM_MARATHON - 1;
  const isHalf = targetDistanceKm > 10 && targetDistanceKm < KM_MARATHON - 1;

  let TAPER_WEEKS;

  if(isMarathon){
    TAPER_WEEKS = [
      {long:14, q:'4 x 1km @ goal pace, full recovery', qkm:8, easy:6, steady:7},
      {long:9,  q:'20 min easy with 4 x 2 min @ goal pace', qkm:6, easy:5, steady:5},
      {long:5,  q:'20–30 min easy + 4 strides, then rest up', qkm:4, easy:4, steady:0}
    ];
  } else if(isHalf){
    TAPER_WEEKS = [
      {long:10, q:'3 x 1km @ half marathon pace, full recovery', qkm:6, easy:5, steady:5},
      {long:6,  q:'20 min easy + 4 strides', qkm:4, easy:4, steady:0}
    ];
  } else {
    TAPER_WEEKS = [
      {long:8, q:'6 x 400m @ 5K pace, full recovery', qkm:5, easy:4, steady:4},
      {long:5, q:'20 min easy + 4 strides', qkm:4, easy:3, steady:0}
    ];
  }

  const w = TAPER_WEEKS[Math.min(idx, TAPER_WEEKS.length)-1];

  if(role==='long') return {
    title:'Long run (tapering)',
    km:roundKm(w.long),
    detail:'Easy effort — stay loose, don’t go hunting fitness now.'
  };

  if(role==='quality') return {
    title:'Sharpener',
    detail:w.q,
    km:roundKm(w.qkm)
  };

  if(role==='steady') return {
    title:'Steady run',
    km:roundKm(w.steady),
    detail:'Easy-moderate, short and controlled.'
  };

  return {
    title:'Easy run',
    km:roundKm(w.easy),
    detail:'Easy, relaxed effort. Rest is part of training now.'
  };
}

function eventRaceDaySession(event){
  const dist = eventDistanceKm(event);
  const pace = event.goalSeconds && dist ? fmtPace(event.goalSeconds / dist) : null;

  return {
    title:`EVENT DAY — ${event.name} 🏁`,
    detail:event.goalSeconds
      ? `Target time ${fmtHMS(event.goalSeconds)} over ${dist}km.${pace ? ` Aim for ${pace}.` : ''}`
      : `Event day for ${event.name}.`,
    race:true,
    role:'race',
    km:dist,
    eventId:event.id
  };
}

function strengthSessionFor(date){
  if(!hasStrengthDay(date)) return null;

  const ph = phaseForDate(date);
  const nearLongRun =
    roleForWeekday(weekdayIdx(addDays(date,1))) === 'long' ||
    roleForWeekday(weekdayIdx(addDays(date,2))) === 'long';

  const focus = profile.strengthFocus;

  if(ph.key==='taper'){
    return {
      role:'strength',
      title:'Strength maintenance',
      detail:'Keep this short and crisp: 2–3 sets each of split squats, calf raises, hamstring curls, rows, and core. Stop well short of fatigue.',
      load:'Light'
    };
  }

  if(ph.key==='recovery'){
    return {
      role:'strength',
      title:'Recovery strength',
      detail:'Use light loads and controlled reps: goblet squat, Romanian deadlift, step-ups, calf raises, and trunk work. Focus on movement quality.',
      load:'Light'
    };
  }

  if(nearLongRun){
    return {
      role:'strength',
      title:'Upper + posterior chain maintenance',
      detail:'Bias upper body and posterior chain without trashing the legs: pressing, rows, light hip hinge, hamstring curl, calf raises, and core.',
      load:'Moderate'
    };
  }

  return {
    role:'strength',
    title: focus==='lower' ? 'Lower-body strength' : 'Strength for runners',
    detail:'Main lifts: squat or hack squat, Romanian deadlift, Bulgarian split squat, calf raises, hamstring curl, and core. Keep 1–3 reps in reserve.',
    load: focus==='balanced' ? 'Moderate' : 'Moderate-heavy'
  };
}

function buildSessionForTarget(role, idx, targetDistanceKm){
  if(targetDistanceKm <= 10){
    return tenKBuildSession(role, idx);
  }

  if(targetDistanceKm <= KM_HALF){
    return halfBuildSession(role, idx);
  }

  return marathonBuildSession(role, idx);
}

function generateDaySession(date){
  const dayEvent = events.find(e => e.status !== 'cancelled' && sameDay(date, toDate(e.date)));
  if(dayEvent){
    return eventRaceDaySession(dayEvent);
  }

  const wd = weekdayIdx(date);
  const role = roleForWeekday(wd);

  if(role==='rest'){
    return {
      title:'Rest day',
      detail:'Full rest, or gentle mobility/stretching. Sleep and nutrition are doing the training work today.',
      role:'rest'
    };
  }

  const ph = phaseForDate(date);
  const targetDistanceKm = ph.b && ph.b.distanceKm ? ph.b.distanceKm : primaryEventDistanceKm();
  let content;

  if(ph.key==='base'){
    content = baseWeekSession(role, ph.idx, targetDistanceKm);
  } else if(ph.key==='build'){
    content = buildSessionForTarget(role, ph.idx, targetDistanceKm);
  } else if(ph.key==='recovery'){
    content = recoverySession(role, ph.idx, targetDistanceKm);
  } else if(ph.key==='taper'){
    content = taperSession(role, ph.idx, targetDistanceKm);
  } else {
    content = {title:'Easy run', km:5, detail:'Easy effort.'};
  }

  return {...content, role, phaseKey:ph.key, phaseIdx:ph.idx};
}

function fullDayPlan(date){
  const iso = fmtISO(date);
  const baseRun = generateDaySession(date);
  const baseStrength = strengthSessionFor(date);
  const ad = adaptations[iso] || {};

  return {
    run: ad.run ? {...baseRun, ...ad.run} : baseRun,
    strength: ad.strength===null ? null : (ad.strength ? {...(baseStrength || {}), ...ad.strength} : baseStrength)
  };
}

function paceLabelForRole(role){
  const z = paceZones();

  if(role==='quality') return `${fmtPace(z.threshold)} (threshold) or ${fmtPace(z.interval)} (intervals) — see session detail`;
  if(role==='steady') return fmtPace(z.steady);
  if(role==='long') return fmtPace(z.long);
  if(role==='easy') return fmtPace(z.easy);
  if(role==='race') return `Goal event pace: ${fmtPace(z.goalRace)}`;

  return null;
}

function runAdaptationIfNeeded(){
  const lastWeekMonday = mondayOf(addWeeks(mondayOf(toDate(todayISO())), -1));
  const key = fmtISO(lastWeekMonday);

  if(profile.lastAdaptedWeekKey === key) return false;

  const weekSessions = sessions.filter(s=>{
    const d = toDate(s.date);
    return d >= lastWeekMonday &&
      d < addWeeks(lastWeekMonday,1) &&
      ['quality','easy','steady','long','race'].includes(s.role);
  });

  if(weekSessions.length===0){
    profile.lastAdaptedWeekKey = key;
    return true;
  }

  const logged = weekSessions.filter(s=>s.completed);
  const avgRpe = logged.length ? logged.reduce((a,s)=>a+(s.rpe||6),0)/logged.length : 6;
  const completionRate = weekSessions.length ? logged.length/weekSessions.length : 1;
  let lm = profile.loadMultiplier;

  if(avgRpe>7.5 || completionRate<0.5) lm = Math.max(0.7, lm*0.9);
  else if(avgRpe<5 && completionRate>=0.99) lm = Math.min(1.15, lm*1.05);

  profile.loadMultiplier = Math.round(lm*100)/100;
  profile.lastAdaptedWeekKey = key;
  return true;
}

function mealPlanFor(date, runRole, hasStrength){
  const key = runRole==='rest' && hasStrength ? 'strength'
    : runRole==='rest' ? 'rest'
    : runRole==='race' ? 'race'
    : runRole;

  const pool = MEAL_POOLS[key] || MEAL_POOLS.rest;
  const pick = pool[dayOfYear(date)%pool.length];
  const tod = profile.trainingTimeOfDay;

  let timing;
  if(tod==='morning') timing = 'Training first thing — keep breakfast small pre-session, have your bigger meal after.';
  else if(tod==='lunchtime') timing = 'Training around midday — use a light pre-session top-up and make lunch your main recovery meal.';
  else timing = 'Training in the evening — eat normally through the day, use a light carb snack 1–2 hrs before, then recover at dinner.';

  return {...pick, timing};
}

function dayOutline(runRole, hasStrength){
  const tod = profile.trainingTimeOfDay;
  const rows = [];

  if(tod==='morning'){
    rows.push(['06:30','Small carb snack (if needed)']);
    rows.push(['07:00', runRole==='rest' ? 'Rest / mobility' : 'Run session']);
    if(hasStrength) rows.push(['12:30','Strength session or gym']);
    rows.push(['08:00','Breakfast / recovery meal']);
    rows.push(['19:00','Dinner']);
  } else if(tod==='lunchtime'){
    rows.push(['07:30','Breakfast']);
    rows.push(['11:30','Small top-up snack']);
    rows.push(['12:15', runRole==='rest' ? 'Rest / mobility' : 'Run session']);
    rows.push(['13:15','Lunch / recovery meal']);
    if(hasStrength) rows.push(['18:00','Strength session or gym']);
    rows.push(['19:00','Dinner']);
  } else {
    rows.push(['07:30','Breakfast']);
    rows.push(['12:30','Lunch']);
    if(hasStrength) rows.push(['16:30','Strength session or gym']);
    rows.push(['17:15','Light carb snack']);
    rows.push(['18:00', runRole==='rest' ? 'Rest / mobility' : 'Run session']);
    rows.push(['19:30','Dinner / recovery meal']);
  }

  return rows;
}

function defaultStrengthExercises(){
  return [
    {name:'Squat', sets:'3', reps:'5', weight:''},
    {name:'Romanian deadlift', sets:'3', reps:'8', weight:''},
    {name:'Bulgarian split squat', sets:'3', reps:'8', weight:''},
    {name:'Calf raise', sets:'3', reps:'12', weight:''},
    {name:'Core', sets:'3', reps:'30s', weight:''}
  ];
}
