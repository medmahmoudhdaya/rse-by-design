/*******************************************************
 *  Ecosystème Social – Ethical Survival Game (MVP)
 *  Uses: p5.js + Firebase Realtime Database (compat)
 *******************************************************/

// === GLOBAL VARIABLES ===
let canvasW = window.innerWidth;
let canvasH = window.innerHeight;

let localPlayerId = "p_" + Math.floor(Math.random() * 1000000);
let playerColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

let dbRef = firebase.database().ref();
let gameRef = dbRef.child("game");
let globalRef = dbRef.child("global");
let playersRef = dbRef.child("players");

let currentDilemmaIndex = 0;
let globalState = { eco: 5, pollution: 5, inclusivity: 5, transparency: 5, innovation: 5 };
let globalPlayers = {};
let playersCount = 0;

// Timer
let roundTimer = 20;
let timerInterval;

// === DILEMMAS (ADD MORE IF YOU WANT) ===
let dilemmas = [
  {
    text: "A feature boosts performance but consumes 5× more energy.",
    A: { text: "Prioritize performance", impact: { eco: -1, pollution: +2, inclusivity: 0, transparency: 0, innovation: +2 } },
    B: { text: "Prioritize sustainability", impact: { eco: +3, pollution: -2, inclusivity: 0, transparency: 0, innovation: 0 } }
  },
  {
    text: "Personalization requires more data; privacy reduces convenience.",
    A: { text: "More personalization", impact: { eco: 0, pollution: 0, inclusivity: +1, transparency: -1, innovation: +2 } },
    B: { text: "Stronger privacy", impact: { eco: +1, pollution: 0, inclusivity: 0, transparency: +2, innovation: -1 } }
  },
  {
    text: "Dark mode saves energy but delays accessibility updates.",
    A: { text: "Ship dark mode first", impact: { eco: +1, pollution: -1, inclusivity: -1, transparency: 0, innovation: +1 } },
    B: { text: "Accessibility first", impact: { eco: 0, pollution: 0, inclusivity: +3, transparency: +1, innovation: 0 } }
  }
];


// ======================================================
//  P5.JS SKETCH – ECOSYSTEM VISUALS
// ======================================================
let sketch = function(p) {
  p.setup = () => {
    p.createCanvas(canvasW, canvasH).parent("canvasHolder");
    p.noStroke();
    initFirebaseListeners();
    setupUI();
  };

  p.draw = () => {
    p.background(10); // Night base

    renderSky(p);
    renderForest(p);
    renderRiver(p);
    renderPlayers(p);

    updateLegend();
  };

  // === SKY ===
  function renderSky(p) {
    let brightness = Math.min(255, (globalState.transparency + globalState.innovation) * 10);
    p.fill(20 + brightness / 3, 40 + brightness / 4, 80 + brightness / 6);
    p.rect(0, 0, p.width, p.height * 0.45);

    // Stars if transparency is low
    if (globalState.transparency < 6) {
      p.fill(255, 255, 255, 150 - globalState.transparency * 10);
      for (let i = 0; i < 40; i++) {
        p.circle(
          (i * 97) % p.width,
          (i * 53) % (p.height * 0.45),
          Math.max(1, (6 - globalState.transparency) / 2)
        );
      }
    }
  }

  // === FOREST ===
  function renderForest(p) {
    let density = Math.max(0, globalState.eco + globalState.inclusivity - globalState.pollution);
    let count = Math.max(5, Math.min(80, density * 2));

    for (let i = 0; i < count; i++) {
      let x = (i * 37) % p.width;
      let y = p.height * 0.55 + (Math.sin(i) * 10);
      let h = 25 + (density % 10) * 4;

      p.fill(20 + i % 20, 120 + (i % 3) * 20, 40 + i % 15);
      p.triangle(x, y, x + 10, y - h, x + 20, y);
    }
  }

  // === RIVER ===
  function renderRiver(p) {
    let pollutionFactor = Math.max(0.1, 1 - globalState.pollution / 15);
    let y = p.height * 0.65;

    p.fill(20, 100 * pollutionFactor, 180 * pollutionFactor, 200);
    p.rect(0, y, p.width, p.height * 0.12);
  }

  // === PLAYER AVATARS ===
  function renderPlayers(p) {
    let baseY = p.height - 40;
    let keys = Object.keys(globalPlayers);

    keys.forEach((id, idx) => {
      let x = 30 + idx * 35;
      p.fill(globalPlayers[id].color || "#fff");
      p.circle(x, baseY, 20);
    });
  }
};

new p5(sketch);


// ======================================================
//  FIREBASE LISTENERS
// ======================================================
function initFirebaseListeners() {
  // Players count
  playersRef.on("value", snap => {
    globalPlayers = snap.val() || {};
    playersCount = Object.keys(globalPlayers).length;
    document.getElementById("playersCount").innerText = "Players: " + playersCount;
  });

  // Global ecosystem state
  globalRef.on("value", snap => {
    let v = snap.val();
    if (v) globalState = v;
    else globalRef.set(globalState);
  });

  // Start game if needed
  gameRef.child("currentRound").once("value", snap => {
    if (!snap.exists()) {
      startRound(0);
    } else {
      let cur = snap.val();
      currentDilemmaIndex = cur.dilemmaIndex || 0;
      startTimerCountdown(cur.endsAt);
      displayDilemma(currentDilemmaIndex);
    }
  });
}


// ======================================================
//  JOIN GAME
// ======================================================
function setupUI() {
  document.getElementById("joinBtn").onclick = () => {
    joinGame();
    document.getElementById("joinBtn").disabled = true;
    document.getElementById("dilemmaCard").classList.remove("hidden");
  };
}

function joinGame() {
  playersRef.child(localPlayerId).set({
    id: localPlayerId,
    color: playerColor,
    joinedAt: Date.now()
  });

  playersRef.child(localPlayerId).onDisconnect().remove();
}


// ======================================================
// ROUND SYSTEM
// ======================================================
function startRound(index) {
  let endsAt = Date.now() + 20000; // 20 seconds
  gameRef.child("currentRound").set({
    dilemmaIndex: index,
    endsAt
  });

  currentDilemmaIndex = index;
  displayDilemma(index);
  startTimer(20, () => finishRound(index));
}

function finishRound(index) {
  tallyChoices(index);
  startRound((index + 1) % dilemmas.length);
}


// ======================================================
// TIMER
// ======================================================
function startTimer(seconds, callback) {
  clearInterval(timerInterval);
  let timeLeft = seconds;

  document.getElementById("timeLeft").innerText = timeLeft;

  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("timeLeft").innerText = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      callback();
    }
  }, 1000);
}

function startTimerCountdown(endsAt) {
  let remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
  startTimer(remaining, () => finishRound(currentDilemmaIndex));
}


// ======================================================
// CHOICES + IMPACT CALCULATION
// ======================================================
function displayDilemma(index) {
  let d = dilemmas[index];
  document.getElementById("dilemmaText").innerText = d.text;

  document.getElementById("choiceA").innerText = "A: " + d.A.text;
  document.getElementById("choiceB").innerText = "B: " + d.B.text;

  document.getElementById("choiceA").onclick = () => submitChoice(d.A.impact);
  document.getElementById("choiceB").onclick = () => submitChoice(d.B.impact);
}

function submitChoice(impact) {
  let cur = gameRef.child("currentRound");
  cur.child("choices").child(localPlayerId).set(impact);
}


// ======================================================
// TALLY CHOICES + UPDATE ECOSYSTEM STATE
// ======================================================
function tallyChoices(roundIndex) {
  let choicesRef = gameRef.child("currentRound/choices");

  choicesRef.once("value").then(snap => {
    let choices = snap.val() || {};

    let totals = { eco: 0, pollution: 0, inclusivity: 0, transparency: 0, innovation: 0 };
    let list = Object.values(choices);

    list.forEach(imp => {
      totals.eco += imp.eco || 0;
      totals.pollution += imp.pollution || 0;
      totals.inclusivity += imp.inclusivity || 0;
      totals.transparency += imp.transparency || 0;
      totals.innovation += imp.innovation || 0;
    });

    let count = Math.max(1, list.length);

    globalRef.transaction(cur => {
      if (!cur) cur = globalState;

      cur.eco = Math.max(0, cur.eco + Math.round(totals.eco / count));
      cur.pollution = Math.max(0, cur.pollution + Math.round(totals.pollution / count));
      cur.inclusivity = Math.max(0, cur.inclusivity + Math.round(totals.inclusivity / count));
      cur.transparency = Math.max(0, cur.transparency + Math.round(totals.transparency / count));
      cur.innovation = Math.max(0, cur.innovation + Math.round(totals.innovation / count));

      return cur;
    });

    choicesRef.remove();
  });
}


// ======================================================
// UI UPDATES
// ======================================================
function updateLegend() {
  let health =
    globalState.eco +
    globalState.inclusivity +
    globalState.transparency +
    globalState.innovation -
    globalState.pollution;

  document.getElementById("healthVal").innerText = health;
}
