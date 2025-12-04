/*******************************************************
 *  Ecosystème Social – Ethical Survival Game (FIXED VERSION)
 *  Uses: p5.js + Firebase Realtime Database (compat)
 *******************************************************/

// === GAME CONFIGURATION ===
const CONFIG = {
    CANVAS_PADDING: 20,
    ROUND_DURATION: 30000, // 30 seconds
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 20,
    ECOSYSTEM_BOUNDS: { min: 0, max: 20 },
    COLOR_PALETTE: [
        '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
        '#EF476F', '#7B2CBF', '#3A86FF', '#FB5607', '#8338EC'
    ],
    IMPACT_WEIGHTS: {
        eco: 0.3,
        pollution: -0.25,
        inclusivity: 0.2,
        transparency: 0.15,
        innovation: 0.2
    }
};

// === GLOBAL STATE MANAGER ===
class GameState {
    constructor() {
        this.eco = 10;
        this.pollution = 5;
        this.inclusivity = 10;
        this.transparency = 8;
        this.innovation = 6;
        this.players = {};
        this.currentRound = null;
        this.history = [];
    }

    calculateHealth() {
        let health = 0;
        Object.keys(CONFIG.IMPACT_WEIGHTS).forEach(key => {
            health += this[key] * CONFIG.IMPACT_WEIGHTS[key];
        });
        return Math.max(0, Math.min(100, health + 50));
    }

    getEcosystemStatus() {
        const health = this.calculateHealth();
        if (health > 75) return { status: "Thriving", color: "#4CAF50", icon: "🌿" };
        if (health > 50) return { status: "Stable", color: "#FF9800", icon: "⚖️" };
        if (health > 25) return { status: "Stressed", color: "#FF5722", icon: "⚠️" };
        return { status: "Critical", color: "#F44336", icon: "🚨" };
    }

    toObject() {
        return {
            eco: this.eco,
            pollution: this.pollution,
            inclusivity: this.inclusivity,
            transparency: this.transparency,
            innovation: this.innovation,
            lastUpdated: Date.now()
        };
    }
}

// === DILEMMA SYSTEM ===
const DILEMMAS = [
    {
        id: 1,
        text: "A proposed AI feature would boost platform efficiency by 300% but requires extensive user data collection.",
        category: "privacy",
        optionA: {
            text: "Deploy AI for maximum efficiency",
            impact: { eco: -1, pollution: 0, inclusivity: -2, transparency: -3, innovation: 4 },
            consequences: ["Data vulnerability increases", "Short-term profits rise", "Public trust declines"]
        },
        optionB: {
            text: "Prioritize privacy with limited AI",
            impact: { eco: 1, pollution: -1, inclusivity: 2, transparency: 3, innovation: 1 },
            consequences: ["User trust strengthens", "Sustainable growth", "Competitive disadvantage"]
        }
    },
    {
        id: 2,
        text: "A breakthrough renewable energy source is available but would displace a traditional community.",
        category: "social",
        optionA: {
            text: "Adopt new energy immediately",
            impact: { eco: 3, pollution: -2, inclusivity: -3, transparency: 0, innovation: 3 },
            consequences: ["Carbon emissions plummet", "Community disruption", "Economic polarization"]
        },
        optionB: {
            text: "Develop gradual transition plan",
            impact: { eco: 1, pollution: -1, inclusivity: 2, transparency: 2, innovation: 1 },
            consequences: ["Social harmony maintained", "Slower climate progress", "Inclusive development"]
        }
    }
];

// === GLOBAL VARIABLES ===
let canvasW, canvasH;
let localPlayerId;
let playerColor;
let playerName = "Player_" + Math.floor(Math.random() * 1000);
let playerStats = {
    choicesMade: 0,
    totalImpact: { eco: 0, pollution: 0, inclusivity: 0, transparency: 0, innovation: 0 },
    alignment: { environmental: 0, social: 0, economic: 0 },
    lastChoice: null,
    joinedAt: Date.now()
};

let gameState = new GameState();
let firebaseInitialized = false;
let currentDilemma = null;
let playerChoices = {};
let roundStartTime = 0;
let roundEndTime = 0;
let animationTime = 0;
let particles = [];
let choiceEffects = [];
let gameSounds = { enabled: true };

// Firebase References
let db, gameRef, globalRef, playersRef, roundsRef;

// === INITIALIZATION ===
function preload() {
    // Any assets to preload
}

function setup() {
    setupCanvas();
    setupEventListeners();
    generatePlayerIdentity();
    setupAudio();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Start animation loop
    requestAnimationFrame(updateAnimations);
    
    // Show welcome
    showNotification("Welcome to Ethical Ecosystem!", "Connect and join the game to start.", "🌍");
}

function setupCanvas() {
    canvasW = window.innerWidth - CONFIG.CANVAS_PADDING * 2;
    canvasH = window.innerHeight - CONFIG.CANVAS_PADDING * 2;
    
    const canvas = createCanvas(canvasW, canvasH);
    canvas.parent("canvasHolder");
    canvas.style('border-radius', '12px');
    canvas.style('box-shadow', '0 10px 30px rgba(0, 0, 0, 0.3)');
    
    pixelDensity(1);
    frameRate(60);
}

function generatePlayerIdentity() {
    localPlayerId = "player_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    playerColor = CONFIG.COLOR_PALETTE[Math.floor(Math.random() * CONFIG.COLOR_PALETTE.length)];
    
    // Generate random player name from list
    const names = ["Guardian", "Visionary", "Steward", "Pioneer", "Harmonist", "Catalyst"];
    playerName = names[Math.floor(Math.random() * names.length)] + "_" + Math.floor(Math.random() * 100);
    
    updatePlayerUI();
}

// === FIREBASE INTEGRATION (FIXED) ===
function initializeFirebase() {
    try {
        if (!FIREBASE_CONFIG) {
            throw new Error("Firebase config not found. Please check firebase-config.js");
        }
        
        // Initialize Firebase
        firebase.initializeApp(FIREBASE_CONFIG);
        
        // Get database instance
        db = firebase.database();
        
        // Set up references
        gameRef = db.ref("game");
        globalRef = db.ref("global");
        playersRef = db.ref("players");
        roundsRef = db.ref("rounds");
        
        // Initialize global state if it doesn't exist
        globalRef.once("value").then(snapshot => {
            if (!snapshot.exists()) {
                globalRef.set(gameState.toObject());
            }
        });
        
        setupFirebaseListeners();
        firebaseInitialized = true;
        
        console.log("✅ Firebase initialized successfully");
        document.getElementById("status").textContent = "Connected";
        document.getElementById("status").style.color = "#4CAF50";
        
    } catch (error) {
        console.error("❌ Firebase initialization failed:", error);
        document.getElementById("status").textContent = "Disconnected";
        document.getElementById("status").style.color = "#F44336";
        showNotification("Connection Error", "Cannot connect to game server.", "❌");
    }
}

function setupFirebaseListeners() {
    // Listen for global state changes
    globalRef.on("value", snapshot => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log("📊 Global state updated:", data);
            
            // Update game state
            gameState.eco = data.eco || 10;
            gameState.pollution = data.pollution || 5;
            gameState.inclusivity = data.inclusivity || 10;
            gameState.transparency = data.transparency || 8;
            gameState.innovation = data.innovation || 6;
            
            updateEcosystemUI();
        }
    }, error => {
        console.error("Global state sync error:", error);
        showNotification("Sync Error", "Reconnecting...", "🔄");
    });
    
    // Listen for players
    playersRef.on("value", snapshot => {
        gameState.players = snapshot.val() || {};
        console.log("👥 Players updated:", Object.keys(gameState.players).length);
        updatePlayersDisplay();
        
        // Check if we should start a round
        if (Object.keys(gameState.players).length >= CONFIG.MIN_PLAYERS) {
            checkAndStartRound();
        }
    });
    
    // Listen for current round
    gameRef.child("currentRound").on("value", snapshot => {
        if (snapshot.exists()) {
            const round = snapshot.val();
            gameState.currentRound = round;
            roundStartTime = round.startedAt || Date.now();
            roundEndTime = round.endsAt || Date.now() + CONFIG.ROUND_DURATION;
            
            console.log("🔄 Round loaded:", round);
            
            if (round.dilemmaIndex !== undefined) {
                loadDilemma(round.dilemmaIndex);
            }
            
            updateRoundTimer();
        }
    });
    
    // Listen for choices
    gameRef.child("currentRound/choices").on("value", snapshot => {
        playerChoices = snapshot.val() || {};
        console.log("🎯 Choices updated:", Object.keys(playerChoices).length);
        updateChoiceDisplay();
    });
}

// === GAME LOGIC ===
function joinGame() {
    if (!firebaseInitialized) {
        showNotification("Connection Error", "Cannot connect to game server.", "❌");
        return;
    }
    
    const playerData = {
        id: localPlayerId,
        name: playerName,
        color: playerColor,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        stats: playerStats
    };
    
    playersRef.child(localPlayerId).set(playerData)
        .then(() => {
            console.log("✅ Player joined:", playerName);
            showNotification("Welcome!", `You joined as ${playerName}`, "👋");
            
            const joinBtn = document.getElementById("joinBtn");
            if (joinBtn) {
                joinBtn.disabled = true;
                joinBtn.textContent = "Joined";
            }
            
            // Show dilemma card
            const dilemmaCard = document.getElementById("dilemmaCard");
            if (dilemmaCard) {
                dilemmaCard.classList.remove("hidden");
            }
            
            // Set up disconnect cleanup
            playersRef.child(localPlayerId).onDisconnect().remove();
            
            // Keep player active
            setInterval(() => {
                if (playersRef && localPlayerId) {
                    playersRef.child(localPlayerId).update({
                        lastActive: Date.now()
                    });
                }
            }, 5000);
            
        })
        .catch(error => {
            console.error("❌ Join failed:", error);
            showNotification("Join Failed", "Please try again", "⚠️");
        });
}

function loadDilemma(index) {
    if (index < 0 || index >= DILEMMAS.length) {
        console.error("Invalid dilemma index:", index);
        return;
    }
    
    currentDilemma = DILEMMAS[index];
    console.log("📝 Loading dilemma:", currentDilemma.id);
    
    // Update UI elements
    const dilemmaText = document.getElementById("dilemmaText");
    const choiceA = document.getElementById("choiceA");
    const choiceB = document.getElementById("choiceB");
    
    if (!dilemmaText || !choiceA || !choiceB) {
        console.error("Dilemma UI elements not found");
        return;
    }
    
    const category = getCategoryInfo(currentDilemma.category);
    
    dilemmaText.innerHTML = `
        <div class="dilemma-category" style="color: ${category.color}">
            ${category.icon} ${category.name.toUpperCase()}
        </div>
        <div class="dilemma-question">${currentDilemma.text}</div>
    `;
    
    choiceA.innerHTML = `
        <div class="option-content">
            <div class="option-header">
                <span class="option-label">A</span>
                <span class="option-text">${currentDilemma.optionA.text}</span>
            </div>
            <div class="option-impacts">
                ${renderImpactIcons(currentDilemma.optionA.impact)}
            </div>
            <div class="option-consequences">
                ${currentDilemma.optionA.consequences.map(c => `<div class="consequence">• ${c}</div>`).join('')}
            </div>
        </div>
    `;
    
    choiceB.innerHTML = `
        <div class="option-content">
            <div class="option-header">
                <span class="option-label">B</span>
                <span class="option-text">${currentDilemma.optionB.text}</span>
            </div>
            <div class="option-impacts">
                ${renderImpactIcons(currentDilemma.optionB.impact)}
            </div>
            <div class="option-consequences">
                ${currentDilemma.optionB.consequences.map(c => `<div class="consequence">• ${c}</div>`).join('')}
            </div>
        </div>
    `;
    
    // Set up click handlers
    choiceA.onclick = () => submitChoice('A', currentDilemma.optionA.impact);
    choiceB.onclick = () => submitChoice('B', currentDilemma.optionB.impact);
    
    // Reset styles
    choiceA.classList.remove("selected", "disabled");
    choiceB.classList.remove("selected", "disabled");
}

function submitChoice(choice, impact) {
    if (!currentDilemma || !firebaseInitialized) {
        console.error("Cannot submit choice: No dilemma or Firebase not ready");
        return;
    }
    
    // Check if already submitted
    if (playerChoices[localPlayerId]) {
        showNotification("Already Submitted", "You've already made your choice for this round.", "⏳");
        return;
    }
    
    const choiceData = {
        choice: choice,
        impact: impact,
        playerId: localPlayerId,
        playerName: playerName,
        submittedAt: Date.now(),
        dilemmaId: currentDilemma.id
    };
    
    gameRef.child("currentRound/choices").child(localPlayerId).set(choiceData)
        .then(() => {
            console.log("✅ Choice submitted:", choice);
            
            // Visual feedback
            createChoiceEffect(choice === 'A' ? '✓ A' : '✓ B', playerColor);
            
            // Update UI
            const selectedBtn = document.getElementById(`choice${choice}`);
            const otherBtn = document.getElementById(`choice${choice === 'A' ? 'B' : 'A'}`);
            
            if (selectedBtn) selectedBtn.classList.add("selected");
            if (otherBtn) otherBtn.classList.add("disabled");
            
            // Update player stats
            playerStats.choicesMade++;
            playerStats.lastChoice = { choice, impact, time: Date.now() };
            
            // Update local stats
            updatePlayerStats();
            
            // Play sound
            playSound('choice');
            
            showNotification("Choice Submitted!", "Waiting for other players...", "⏳");
        })
        .catch(error => {
            console.error("❌ Choice submission failed:", error);
            showNotification("Submission Failed", "Please try again", "⚠️");
        });
}

function checkAndStartRound() {
    if (!firebaseInitialized) return;
    
    gameRef.child("currentRound").once("value", snapshot => {
        const currentRound = snapshot.val();
        
        if (!currentRound || !currentRound.active || Date.now() > currentRound.endsAt) {
            startNewRound();
        }
    });
}

function startNewRound() {
    if (!firebaseInitialized) return;
    
    const roundData = {
        dilemmaIndex: Math.floor(Math.random() * DILEMMAS.length),
        startedAt: Date.now(),
        endsAt: Date.now() + CONFIG.ROUND_DURATION,
        active: true,
        choices: {}
    };
    
    gameRef.child("currentRound").set(roundData)
        .then(() => {
            console.log("🎯 New round started");
            showNotification("New Round Started!", "Make your choice!", "🎯");
            playSound('roundStart');
        })
        .catch(error => {
            console.error("❌ Failed to start round:", error);
        });
}

// === UI UPDATES ===
function updatePlayerUI() {
    const nameDisplay = document.getElementById("playerNameDisplay");
    const colorDisplay = document.getElementById("playerColorDisplay");
    const idDisplay = document.getElementById("playerIdDisplay");
    const nameInput = document.getElementById("playerNameInput");
    const avatarInitial = document.getElementById("avatarInitial");
    
    if (nameDisplay) nameDisplay.textContent = playerName;
    if (colorDisplay) colorDisplay.style.backgroundColor = playerColor;
    if (idDisplay) idDisplay.textContent = localPlayerId.substring(0, 8) + "...";
    if (nameInput) nameInput.value = playerName;
    if (avatarInitial) avatarInitial.textContent = playerName.charAt(0);
}

function updatePlayerStats() {
    const roundsPlayed = document.getElementById("roundsPlayed");
    const ecoImpact = document.getElementById("ecoImpact");
    const consistency = document.getElementById("consistency");
    
    if (roundsPlayed) roundsPlayed.textContent = playerStats.choicesMade;
    if (ecoImpact) {
        const total = Object.values(playerStats.totalImpact).reduce((a, b) => a + b, 0);
        ecoImpact.textContent = total;
    }
    if (consistency) {
        // Simple consistency calculation
        consistency.textContent = playerStats.choicesMade > 0 ? "75%" : "0%";
    }
}

function updateEcosystemUI() {
    const health = gameState.calculateHealth();
    const status = gameState.getEcosystemStatus();
    
    // Update health bar
    const healthVal = document.getElementById("healthVal");
    const healthFill = document.getElementById("healthFill");
    const healthStatus = document.getElementById("healthStatus");
    const healthIcon = document.getElementById("healthIcon");
    
    if (healthVal) {
        healthVal.textContent = Math.round(health) + "%";
        healthVal.style.color = status.color;
    }
    
    if (healthFill) {
        healthFill.style.width = health + "%";
        healthFill.style.background = `linear-gradient(90deg, ${status.color}, ${status.color}99)`;
    }
    
    if (healthStatus) {
        healthStatus.textContent = status.status;
        healthStatus.style.color = status.color;
    }
    
    if (healthIcon) {
        healthIcon.textContent = status.icon;
    }
    
    // Update metric values
    const metrics = ['eco', 'pollution', 'inclusivity', 'transparency', 'innovation'];
    metrics.forEach(metric => {
        const valElement = document.getElementById(`${metric}Val`);
        const barElement = document.getElementById(`${metric}Bar`);
        
        if (valElement) {
            valElement.textContent = gameState[metric];
            valElement.style.color = getValueColor(gameState[metric]);
        }
        
        if (barElement) {
            const percentage = (gameState[metric] / CONFIG.ECOSYSTEM_BOUNDS.max) * 100;
            barElement.style.width = percentage + "%";
        }
    });
}

function updatePlayersDisplay() {
    const playerCount = Object.keys(gameState.players).length;
    
    // Update player count display if it exists
    const playersCount = document.getElementById("playersCount");
    if (playersCount) {
        playersCount.textContent = `${playerCount} Player${playerCount !== 1 ? 's' : ''}`;
    }
}

function updateChoiceDisplay() {
    const choiceCount = Object.keys(playerChoices).length;
    const playerCount = Object.keys(gameState.players).length;
    
    const choicesCount = document.getElementById("choicesCount");
    const choicesProgress = document.getElementById("choicesProgress");
    
    if (choicesCount) {
        choicesCount.textContent = `${choiceCount}/${playerCount}`;
    }
    
    if (choicesProgress) {
        const percentage = playerCount > 0 ? (choiceCount / playerCount) * 100 : 0;
        choicesProgress.style.width = `${percentage}%`;
    }
}

function updateRoundTimer() {
    if (!roundEndTime) return;
    
    const timer = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, roundEndTime - now);
        const seconds = Math.ceil(timeLeft / 1000);
        
        const timeLeftElement = document.getElementById("timeLeft");
        const timerFill = document.getElementById("timerFill");
        
        if (timeLeftElement) {
            timeLeftElement.textContent = seconds;
            
            if (seconds <= 10) {
                timeLeftElement.style.color = "#F44336";
                timeLeftElement.style.fontWeight = "bold";
            } else {
                timeLeftElement.style.color = "#FFFFFF";
            }
        }
        
        if (timerFill) {
            const percentage = (timeLeft / CONFIG.ROUND_DURATION) * 100;
            timerFill.style.width = `${percentage}%`;
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            console.log("⏰ Round time expired");
        }
    }, 1000);
}

// === HELPER FUNCTIONS ===
function getCategoryInfo(category) {
    const categories = {
        privacy: { name: "Privacy", color: "#2196F3", icon: "🔒" },
        social: { name: "Social", color: "#4CAF50", icon: "🤝" },
        ethics: { name: "Ethics", color: "#9C27B0", icon: "⚖️" },
        transparency: { name: "Transparency", color: "#FF9800", icon: "🔍" }
    };
    
    return categories[category] || { name: "General", color: "#607D8B", icon: "❓" };
}

function getValueColor(value) {
    if (value >= 15) return "#4CAF50";
    if (value >= 10) return "#FF9800";
    if (value >= 5) return "#FF5722";
    return "#F44336";
}

function renderImpactIcons(impact) {
    const icons = {
        eco: "🌱",
        pollution: "☁️",
        inclusivity: "🤝",
        transparency: "🔍",
        innovation: "💡"
    };
    
    return Object.entries(impact)
        .map(([key, value]) => {
            const color = value > 0 ? "#4CAF50" : value < 0 ? "#F44336" : "#9E9E9E";
            const sign = value > 0 ? "+" : "";
            return `<span class="impact-tag" style="color: ${color}">${icons[key]} ${sign}${value}</span>`;
        })
        .join("");
}

function createChoiceEffect(text, color) {
    choiceEffects.push({
        text: text,
        color: color,
        x: width / 2,
        y: height / 2,
        life: 1.0
    });
}

function showNotification(title, message, icon) {
    const notifications = document.getElementById("notifications");
    if (!notifications) return;
    
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <div class="notification-close">&times;</div>
    `;
    
    notification.querySelector(".notification-close").onclick = () => {
        notification.remove();
    };
    
    notifications.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function setupAudio() {
    // Simple Web Audio API tones
    gameSounds = {
        choice: () => playTone(523.25, 0.2),
        roundStart: () => playTone(659.25, 0.3),
        positive: () => playTone(392, 0.2),
        negative: () => playTone(311.13, 0.2)
    };
}

function playTone(frequency, duration) {
    if (!gameSounds.enabled) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.warn("Audio not available:", error);
    }
}

function playSound(soundName) {
    if (gameSounds[soundName]) {
        gameSounds[soundName]();
    }
}

function setupEventListeners() {
    // Join game button
    const joinBtn = document.getElementById("joinBtn");
    if (joinBtn) {
        joinBtn.addEventListener("click", joinGame);
    }
    
    // Player name input
    const nameInput = document.getElementById("playerNameInput");
    if (nameInput) {
        nameInput.value = playerName;
        nameInput.addEventListener("input", (e) => {
            playerName = e.target.value || playerName;
            updatePlayerUI();
            
            // Update in Firebase if joined
            if (firebaseInitialized && localPlayerId) {
                playersRef.child(localPlayerId).update({
                    name: playerName
                });
            }
        });
    }
    
    // Sound toggle
    const soundToggle = document.getElementById("soundToggle");
    if (soundToggle) {
        soundToggle.addEventListener("click", () => {
            gameSounds.enabled = !gameSounds.enabled;
            soundToggle.textContent = gameSounds.enabled ? "🔊" : "🔇";
            localStorage.setItem("soundEnabled", gameSounds.enabled);
        });
        soundToggle.textContent = gameSounds.enabled ? "🔊" : "🔇";
    }
}

function updateAnimations() {
    animationTime += 0.016;
    requestAnimationFrame(updateAnimations);
}

// === P5.JS DRAW FUNCTIONS (SIMPLIFIED) ===
function draw() {
    // Clear canvas
    clear();
    
    // Draw background
    drawBackground();
    
    // Draw ecosystem visualization
    drawEcosystem();
    
    // Draw players
    drawPlayers();
}

function drawBackground() {
    // Gradient background
    for (let i = 0; i < height; i++) {
        const inter = map(i, 0, height, 0, 1);
        const c = lerpColor(color(10, 25, 47), color(17, 34, 64), inter);
        stroke(c);
        line(0, i, width, i);
    }
}

function drawEcosystem() {
    // Simple ecosystem representation
    const health = gameState.calculateHealth();
    
    // Draw trees based on eco score
    const treeCount = map(gameState.eco, 0, 20, 5, 50);
    for (let i = 0; i < treeCount; i++) {
        const x = (i * 100) % (width - 50) + 25;
        const y = height * 0.7 + sin(animationTime + i) * 10;
        
        // Tree trunk
        fill(101, 67, 33);
        rect(x - 5, y, 10, 40);
        
        // Leaves
        fill(34, 139, 34, 150);
        ellipse(x, y - 10, 40, 40);
    }
}

function drawPlayers() {
    const players = Object.values(gameState.players);
    if (players.length === 0) return;
    
    const spacing = Math.min(60, (width - 100) / players.length);
    const startX = (width - (players.length * spacing)) / 2;
    const baseY = height - 50;
    
    players.forEach((player, index) => {
        const x = startX + index * spacing;
        const y = baseY + sin(animationTime + index) * 10;
        
        // Player circle
        fill(player.color || "#FFFFFF");
        ellipse(x, y, 30, 30);
        
        // Player initial
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(14);
        text(player.name ? player.name.charAt(0) : "?", x, y);
    });
}

// === ERROR HANDLING ===
window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    showNotification("Game Error", "Please refresh the page.", "⚠️");
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("Promise rejection:", event.reason);
});

// Start the game
window.addEventListener("DOMContentLoaded", () => {
    // Check if p5 is loaded
    if (typeof createCanvas === 'undefined') {
        console.error("p5.js not loaded!");
        showNotification("Error", "p5.js library failed to load.", "❌");
        return;
    }
    
    // Initialize
    setTimeout(setup, 100);
});