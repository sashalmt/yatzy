// Yatzy game with Firebase realtime sync + persistent per-player stats

const CATS = [
  'Ones','Twos','Threes','Fours','Fives','Sixes',
  'Three of a Kind','Four of a Kind','Full House','Small Straight','Large Straight','Chance','Yatzy'
];

// ---- Elements ----
const lobbyEl = document.getElementById('lobby');
const tableEl = document.getElementById('table');
const diceTrayEl = document.getElementById('diceTray');
const rollBtn = document.getElementById('rollBtn');
const endTurnBtn = document.getElementById('endTurnBtn');
const rollsLeftEl = document.getElementById('rollsLeft');
const scoreBody = document.getElementById('scoreBody');
const meUpper = document.getElementById('meUpper');
const opUpper = document.getElementById('opUpper');
const meLower = document.getElementById('meLower');
const opLower = document.getElementById('opLower');
const meBonus = document.getElementById('meBonus');
const opBonus = document.getElementById('opBonus');
const meGrand = document.getElementById('meGrand');
const opGrand = document.getElementById('opGrand');
const p1NameEl = document.getElementById('p1Name');
const p2NameEl = document.getElementById('p2Name');
const p1TotalEl = document.getElementById('p1Total');
const p2TotalEl = document.getElementById('p2Total');
const roomCodeLabel = document.getElementById('roomCodeLabel');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const p1StatsEl = document.getElementById('p1Stats');
const p2StatsEl = document.getElementById('p2Stats');

// Lobby controls
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const playerNameInput = document.getElementById('playerName');
const joinCodeInput = document.getElementById('joinCode');

// Overlay
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const newGameBtn = document.getElementById('newGameBtn');
const leaveBtn = document.getElementById('leaveBtn');

// ---- Local State ----
let myId = null;           // 'p1' or 'p2'
let myUid = getOrCreateUid();
let roomCode = null;
let unsub = null;
let localDice = [1,1,1,1,1];
let localHeld = [false,false,false,false,false];

// ---- Utils ----
function uid(){ return Math.random().toString(36).slice(2); }
function getOrCreateUid(){
  const k = 'yatzy_uid';
  let v = localStorage.getItem(k);
  if(!v){ v = 'u_' + uid(); localStorage.setItem(k, v); }
  return v;
}

function scoreCounts(dice){
  const c = {1:0,2:0,3:0,4:0,5:0,6:0};
  dice.forEach(d=>c[d]++);
  return c;
}
function isSmallStraight(dice){
  const s = new Set(dice);
  // any 4-in-a-row: 1-4, 2-5, 3-6
  return [ [1,2,3,4], [2,3,4,5], [3,4,5,6] ].some(seq => seq.every(n => s.has(n)));
}
function isLargeStraight(dice){
  const s = new Set(dice);
  return ([1,2,3,4,5].every(n=>s.has(n)) || [2,3,4,5,6].every(n=>s.has(n)));
}
function scoreCategory(cat, dice){
  const counts = scoreCounts(dice);
  switch(cat){
    case 'Ones': return counts[1]*1;
    case 'Twos': return counts[2]*2;
    case 'Threes': return counts[3]*3;
    case 'Fours': return counts[4]*4;
    case 'Fives': return counts[5]*5;
    case 'Sixes': return counts[6]*6;
    case 'Three of a Kind': {
      const ok = Object.values(counts).some(v=>v>=3);
      return ok ? dice.reduce((a,b)=>a+b,0) : 0;
    }
    case 'Four of a Kind': {
      const ok = Object.values(counts).some(v=>v>=4);
      return ok ? dice.reduce((a,b)=>a+b,0) : 0;
    }
    case 'Full House': {
      const has3 = Object.values(counts).includes(3);
      const has2 = Object.values(counts).includes(2);
      return (has3 && has2) ? 25 : 0;
    }
    case 'Small Straight': return isSmallStraight(dice)?30:0;
    case 'Large Straight': return isLargeStraight(dice)?40:0;
    case 'Chance': return dice.reduce((a,b)=>a+b,0);
    case 'Yatzy': return Object.values(counts).some(v=>v===5)?50:0;
    default: return 0;
  }
}

function totalsFor(score){
  const upperCats = ['Ones','Twos','Threes','Fours','Fives','Sixes'];
  const lowerCats = ['Three of a Kind','Four of a Kind','Full House','Small Straight','Large Straight','Chance','Yatzy'];
  let upper = 0, lower = 0;
  for(const c of upperCats){ if(score[c]!=null) upper += score[c]; }
  for(const c of lowerCats){ if(score[c]!=null) lower += score[c]; }
  const bonus = upper >= 63 ? 35 : 0;
  return { upper, lower, bonus, grand: upper+lower+bonus };
}

function renderDice(){
  diceTrayEl.innerHTML = '';
  localDice.forEach((n, i)=>{
    const d = document.createElement('div');
    d.className = 'die';
    d.dataset.held = localHeld[i] ? "true" : "false";
    d.addEventListener('click', ()=> toggleHold(i));
    const face = drawPips(n);
    d.appendChild(face);
    diceTrayEl.appendChild(d);
  });
}

function drawPips(n){
  const c = document.createElement('div');
  c.className = 'face';
  const pip = ()=>{const p=document.createElement('div');p.className='pip';return p;};
  const map = {1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
  c.style.display='grid';
  c.style.gridTemplateColumns='repeat(3, 1fr)';
  c.style.gridTemplateRows='repeat(3, 1fr)';
  c.style.width='100%'; c.style.height='100%';
  for(let i=1;i<=9;i++){
    const cell = document.createElement('div');
    cell.style.display='grid'; cell.style.placeItems='center';
    if(map[n].includes(i)) cell.appendChild(pip());
    c.appendChild(cell);
  }
  return c;
}

function animateRoll(){
  document.querySelectorAll('.die').forEach(d=>{
    d.classList.remove('roll');
    void d.offsetWidth;
    d.classList.add('roll');
  });
}

// ---- Firebase Room Model ----
function defaultRoom(state={}){
  return {
    createdAt: Date.now(),
    players: {
      p1: { name: state.p1Name||'Player 1', uid: state.p1Uid||null },
      p2: { name: state.p2Name||'Player 2', uid: state.p2Uid||null }
    },
    turn: 'p1',
    rollsLeft: 3,
    dice: [1,1,1,1,1],
    held: [false,false,false,false,false],
    scores: { p1: {}, p2: {} },
    finished: false,
    winner: null
  };
}

function startListeners(){
  if(unsub) unsub();
  const ref = roomRef(roomCode);
  const cb = ref.on('value', snap=>{
    const room = snap.val();
    if(!room) return;
    applyRoom(room);
  });
  unsub = ()=> roomRef(roomCode).off('value', cb);
}

let p1ProfileUnsub, p2ProfileUnsub;
function listenProfile(uid, targetEl){
  if(!uid){ targetEl.textContent = 'Wins: — • Avg: —'; return; }
  const ref = profileRef(uid);
  const cb = ref.on('value', snap=>{
    const p = snap.val() || {};
    const games = p.games||0, wins = p.wins||0, total = p.totalScore||0;
    const avg = games? Math.round((total/games)*10)/10 : 0;
    targetEl.textContent = Wins: ${wins} • Avg: ${avg};
  });
  return ()=> ref.off('value', cb);
}

function applyRoom(room){
  p1NameEl.textContent = room.players.p1.name;
  p2NameEl.textContent = room.players.p2.name;

  // Stats listeners
  if(p1ProfileUnsub) p1ProfileUnsub();
  if(p2ProfileUnsub) p2ProfileUnsub();
  p1ProfileUnsub = listenProfile(room.players.p1.uid, p1StatsEl);
  p2ProfileUnsub = listenProfile(room.players.p2.uid, p2StatsEl);

  localDice = room.dice;
  localHeld = room.held;
  renderDice();
  rollsLeftEl.textContent = room.rollsLeft;

  const myTurn = room.turn === myId && !room.finished;
  rollBtn.disabled = !myTurn || room.rollsLeft<=0;
  endTurnBtn.disabled = !myTurn;

  drawScoreTable(room);
  const t1 = totalsFor(room.scores.p1);
  const t2 = totalsFor(room.scores.p2);
  p1TotalEl.textContent = t1.grand;
  p2TotalEl.textContent = t2.grand;

  meUpper.textContent = (myId==='p1'?t1.upper:t2.upper);
  opUpper.textContent = (myId==='p1'?t2.upper:t1.upper);
  meLower.textContent = (myId==='p1'?t1.lower:t2.lower);
  opLower.textContent = (myId==='p1'?t2.lower:t1.lower);
  meBonus.textContent = (myId==='p1'?t1.bonus:t2.bonus);
  opBonus.textContent = (myId==='p1'?t2.bonus:t1.bonus);
  meGrand.textContent = (myId==='p1'?t1.grand:t2.grand);
  opGrand.textContent = (myId==='p1'?t2.grand:t1.grand);

  if(room.finished){
    overlay.classList.remove('hidden');
    overlayTitle.textContent = "Game Over";
    const who = room.winner;
    overlayText.textContent = (who === 'draw')
      ? "It's a draw!"
      : ${room.players[who].name} wins!;
  }else{
    overlay.classList.add('hidden');
  }
}

function drawScoreTable(room){
  scoreBody.innerHTML = '';
  const myScore = room.scores[myId];
  const opId = myId === 'p1' ? 'p2' : 'p1';
  const opScore = room.scores[opId];

  CATS.forEach(cat=>{
    const tr = document.createElement('tr');

    const tdCat = document.createElement('td');
    tdCat.textContent = cat;
    tr.appendChild(tdCat);

    const tdMe = document.createElement('td');
    const tdOp = document.createElement('td');
    tdMe.className = 'choice';
    tdOp.className = 'locked';

    tdOp.textContent = (opScore[cat] != null) ? opScore[cat] : '—';

    const isMyTurn = room.turn === myId && !room.finished;
    const already = myScore[cat] != null;

    if(already){
      tdMe.textContent = myScore[cat];
      tdMe.classList.add('locked');
    }else if(isMyTurn){
      const preview = scoreCategory(cat, room.dice);
      tdMe.textContent = preview + ' • score';
      tdMe.addEventListener('click', ()=> chooseCategory(cat, preview));
      tdMe.title = "Click to score this category";
    }else{
      tdMe.textContent = '—';
      tdMe.classList.add('locked');
    }

    tr.appendChild(tdMe);
    tr.appendChild(tdOp);
    scoreBody.appendChild(tr);
  });
}

// ---- Actions ----
async function toggleHold(i){
  const snap = await roomRef(roomCode).get();
  const room = snap.val();
  if(!room || room.finished) return;
  if(room.turn !== myId) return;
  const held = room.held.slice();
  held[i] = !held[i];
  await roomRef(roomCode).update({ held });
  localHeld = held;
  renderDice();
}

function randomDie(){ return 1 + Math.floor(Math.random()*6); }

async function rollDice(){
  const snap = await roomRef(roomCode).get();
  const room = snap.val();
  if(!room || room.finished) return;
  if(room.turn !== myId) return;
  if(room.rollsLeft <= 0) return;

  animateRoll();

  const dice = room.dice.slice();
  for(let i=0;i<5;i++){
    if(!room.held[i]) dice[i] = randomDie();
  }
  const rollsLeft = room.rollsLeft - 1;
  await roomRef(roomCode).update({ dice, rollsLeft });
}

async function chooseCategory(cat, value){
  const ref = roomRef(roomCode);
  const snap = await ref.get();
  const room = snap.val();
  if(!room || room.finished) return;
  if(room.turn !== myId) return;
  if(room.scores[myId][cat] != null) return;

  const scores = {...room.scores};
  scores[myId] = {...scores[myId], [cat]: value};

  const nextTurn = myId === 'p1' ? 'p2' : 'p1';
  const held = [false,false,false,false,false];
  const rollsLeft = 3;
  const dice = [1,1,1,1,1];

  const allMine = CATS.every(c => scores[myId][c]!=null);
  const allOpp  = CATS.every(c => scores[nextTurn][c]!=null);
  let finished = false, winner = null;
  if(allMine && allOpp){
    finished = true;
    const t1 = totalsFor(scores.p1).grand;
    const t2 = totalsFor(scores.p2).grand;
    winner = (t1===t2)?'draw':(t1>t2?'p1':'p2');
  }

  await ref.update({ scores, held, rollsLeft, dice, turn: finished?room.turn:nextTurn, finished, winner });

  if(finished){
    await commitStatsIfNeeded({ ...room, scores, finished, winner });
  }
}

async function endTurn(){
  const snap = await roomRef(roomCode).get();
  const room = snap.val();
  if(!room || room.finished) return;
  if(room.turn !== myId) return;
  await roomRef(roomCode).update({ turn: myId==='p1'?'p2':'p1' });
}

// ---- Stats (Profiles) ----
function localCommitKey(code, uid){
  return statsCommitted:${code}:${uid};
}

async function commitStatsIfNeeded(room){
  if(!room.finished) return;
  const key = localCommitKey(roomCode, myUid);
  if(localStorage.getItem(key)) return;

  const myScore = totalsFor(room.scores[myId]).grand;
  const iWon = room.winner === myId ? 1 : 0;

  await profileRef(myUid).transaction((curr)=>{
    const p = curr || { name: '', games:0, wins:0, totalScore:0 };
    return {
      name: (myId==='p1'?room.players.p1.name:room.players.p2.name) || p.name || 'Player',
      games: (p.games||0) + 1,
      wins:  (p.wins||0) + iWon,
      totalScore: (p.totalScore||0) + myScore,
      lastUpdated: Date.now()
    };
  });

  localStorage.setItem(key, '1');
}

async function ensureMyProfile(name){
  await profileRef(myUid).update({ name, lastSeen: Date.now() });
}

// ---- Lobby / Rooms ----
function showGameUI(){
  lobbyEl.classList.add('hidden');
  tableEl.classList.remove('hidden');
  roomCodeLabel.textContent = roomCode ? Room: ${roomCode} : '';
}

async function createRoom(){
  const name = playerNameInput.value.trim() || "Player";
  await ensureMyProfile(name);
  const code = genCode();
  const room = defaultRoom({ p1Name: name, p1Uid: myUid, p2Name: "Waiting…", p2Uid: null });
  await roomRef(code).set(room);
  myId = 'p1';
  roomCode = code;
  showGameUI();
  startListeners();
  history.replaceState(null, '', #${code});
}

async function joinRoom(){
  const code = (joinCodeInput.value || location.hash.replace('#','')).trim().toUpperCase();
  if(!code) return alert('Enter a room code.');
  const snap = await roomRef(code).get();
  if(!snap.exists()) return alert('Room not found.');
  const room = snap.val();
  if(room.players.p2.uid){
    return alert('Room full. Create a new one.');
  }
  const name = playerNameInput.value.trim() || "Guest";
  await ensureMyProfile(name);
  await roomRef(code).update({
    "players/p2/name": name,
    "players/p2/uid": myUid
  });
  myId = 'p2';
  roomCode = code;
  showGameUI();
  startListeners();
  history.replaceState(null, '', #${code});
}

async function newGame(){
  if(!roomCode) return;
  const snap = await roomRef(roomCode).get();
  if(!snap.exists()) return;
  const room = snap.val();
  const p1 = room.players.p1.name;
  const p2 = room.players.p2.name;
  const u1 = room.players.p1.uid;
  const u2 = room.players.p2.uid;
  await roomRef(roomCode).set(defaultRoom({ p1Name: p1, p2Name: p2, p1Uid: u1, p2Uid: u2 }));
  localStorage.removeItem(localCommitKey(roomCode, myUid));
}

async function leaveRoom(){
  if(!roomCode) return location.reload();
  const ref = roomRef(roomCode);
  const snap = await ref.get();
  const room = snap.val();
  if(!room) return location.reload();
  if(myId==='p2'){
    await ref.update({ "players/p2/name": "Waiting…", "players/p2/uid": null });
  }else{
    await ref.remove();
  }
  location.href = location.pathname;
  location.reload();
}

// ---- Wire events ----
rollBtn.addEventListener('click', rollDice);
endTurnBtn.addEventListener('click', endTurn);
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
newGameBtn.addEventListener('click', newGame);
leaveBtn.addEventListener('click', leaveRoom);
copyRoomBtn.addEventListener('click', async ()=>{
  if(!roomCode) return;
  const url = location.origin + location.pathname + '#' + roomCode;
  try{
    await navigator.clipboard.writeText(url);
    copyRoomBtn.textContent = "Copied!";
    setTimeout(()=>copyRoomBtn.textContent="Copy Room Link", 1200);
  }catch(err){
    alert(url);
  }
});

window.addEventListener('load', ()=>{
  renderDice();
  const code = location.hash.replace('#','').trim();
  if(code){
    joinCodeInput.value = code.toUpperCase();
  }
});
