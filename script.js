// --- Global Constants & Configuration ---
const GAME_BOARD_SIZE = 3; // Fixed to 3x3 for optimal AI
const WIN_CONDITION = 3;   // Fixed to 3 in a row

const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

const DEFAULT_SETTINGS = {
    difficulty: 'strategist', // 'zen', 'strategist', 'punisher'
    gameMode: 'standard',     // 'standard', 'suddenDeath', 'blindPlay', 'dailyChallenge'
    autoPlayNextRound: true,
    animationSpeed: 300,      // ms
    soundEnabled: true,
    theme: 'dark'             // 'dark', 'light', 'matrix'
};

const DAILY_CHALLENGE_BOARDS = [
    // Example daily challenges (player starts with X)
    // Board states are 1D arrays
    // A. Player X must win in 2 moves (center + corner)
    ['', '', '', '', 'X', '', '', '', 'O'], // Player has center
    ['O', '', '', '', 'X', '', '', '', ''], // Player has center
    ['', '', 'O', '', 'X', '', '', '', ''],
    // B. Player X must prevent AI from winning
    ['X', '', 'O', '', '', '', 'O', '', ''], // X must block a win
    ['', 'O', '', 'X', '', '', '', 'O', ''], // X must block a win
    ['O', '', '', '', '', '', '', '', 'X'],
    // Add more complex daily challenges here.
    // For a real daily challenge, you'd pick one board per day based on date.
    // Here, we'll cycle through them for demonstration.
];

// --- Game State Variables ---
let board = Array(GAME_BOARD_SIZE * GAME_BOARD_SIZE).fill('');
let currentPlayer = 'X'; // X for player, O for AI
let isGameActive = false;
let gameSettings = { ...DEFAULT_SETTINGS }; // Clone default settings
let flawlessVictoryPossible = true; // For 'Flawless Victory' achievement
let gameHistory = []; // Stores board states for replay
let replayCurrentStep = 0;
let replayInterval = null;
let currentTurnStartTime = 0; // For Sudden Death mode
let suddenDeathInterval = null;
let blindCellsInterval = null;
let blindCells = [];
let dailyChallengeIndex = 0; // Index for current daily challenge board

// --- Game Statistics (Persisted in Local Storage) ---
let gameStats = {
    totalGames: 0,
    playerWins: 0,
    aiWins: 0,
    draws: 0,
    consecutivePlayerLosses: 0,
    consecutivePlayerWins: 0,
    fastestSuddenDeathWinTime: Infinity, // in seconds
    playerWinsByDifficulty: { zen: 0, strategist: 0, punisher: 0 },
    playerWinsByMode: { standard: 0, suddenDeath: 0, blindPlay: 0, dailyChallenge: 0 },
    lastDailyChallengeDate: null
};

// --- Achievement Data (Expanded) ---
const ACHIEVEMENTS_DATA = [
    // Core Achievements
    { id: 'firstWin', name: 'First Blood', description: 'Win your very first game.', unlocked: false, icon: '🏆' },
    { id: 'masterOfDespairBronze', name: 'Apprentice of Despair', description: 'Win 1 game against The Strategist or Punisher.', unlocked: false, threshold: 1, difficulty: ['strategist', 'punisher'], icon: '🥉' },
    { id: 'masterOfDespairSilver', name: 'Master of Despair', description: 'Win 5 games against The Strategist or Punisher.', unlocked: false, threshold: 5, difficulty: ['strategist', 'punisher'], icon: '🥈' },
    { id: 'masterOfDespairGold', name: 'Grandmaster of Despair', description: 'Win 10 games against The Strategist or Punisher.', unlocked: false, threshold: 10, difficulty: ['strategist', 'punisher'], icon: '🥇' },
    { id: 'masterOfDespairPlatinum', name: 'Lord of Despair', description: 'Win 25 games against The Strategist or Punisher.', unlocked: false, threshold: 25, difficulty: ['strategist', 'punisher'], icon: '👑' },
    { id: 'unstoppableForce', name: 'Unstoppable Force', description: 'Win 3 games in a row.', unlocked: false, threshold: 3, icon: '⚡' },
    { id: 'perfectGame', name: 'Flawless Victory', description: 'Win without the AI placing a single mark.', unlocked: false, icon: '✨' },
    { id: 'breakingFlow', name: 'Breaking the Flow', description: 'Defeat the AI when it has won 2+ games in a row.', unlocked: false, icon: '🌪️' },
    { id: 'drawSpecialist', name: 'Draw Specialist', description: 'Achieve 3 draws.', unlocked: false, threshold: 3, icon: '🤝' },
    { id: 'neverGiveUp', name: 'Never Give Up', description: 'Play 10 games without a win.', unlocked: false, icon: '💪' },

    // Mode-Specific Achievements
    { id: 'suddenDeathSurvivor', name: 'Sudden Death Survivor', description: 'Win 1 game in Sudden Death mode.', unlocked: false, mode: 'suddenDeath', threshold: 1, icon: '⏱️' },
    { id: 'suddenDeathChampion', name: 'Sudden Death Champion', description: 'Win 5 games in Sudden Death mode.', unlocked: false, mode: 'suddenDeath', threshold: 5, icon: '🏁' },
    { id: 'blindPlayInitiate', name: 'Blind Sense', description: 'Win 1 game in Blind Play mode.', unlocked: false, mode: 'blindPlay', threshold: 1, icon: '🕶️' },
    { id: 'dailyChallengeConqueror', name: 'Daily Champion', description: 'Win 1 Daily Challenge.', unlocked: false, mode: 'dailyChallenge', threshold: 1, icon: '🗓️' },

    // Special & Secret Achievements
    { id: 'tacticalGenius', name: 'Tactical Genius', description: 'Win by creating an unblockable fork (two simultaneous winning lines).', unlocked: false, icon: '🧠', secret: true },
    { id: 'luckyStrike', name: 'Lucky Strike', description: 'Win with a critical last-second move in Sudden Death.', unlocked: false, secret: true, icon: '🍀' },
    { id: 'themesUnlocked', name: 'Fashionista', description: 'Unlock all themes.', unlocked: false, icon: '🎨', secret: true },
    // Add more...
];
let achievements = []; // This will be initialized with a deep copy of ACHIEVEMENTS_DATA

// --- Sound Effects ---
const SOUNDS = {
    placeMark: new Audio('assets/sounds/place_mark.mp3'),
    win: new Audio('assets/sounds/win.mp3'),
    lose: new Audio('assets/sounds/lose.mp3'),
    draw: new Audio('assets/sounds/draw.mp3'),
    buttonClick: new Audio('assets/sounds/button_click.mp3'),
    timerTick: new Audio('assets/sounds/timer_tick.mp3'),
    timeout: new Audio('assets/sounds/timeout.mp3'),
};

// Preload sounds and set volume
for (let key in SOUNDS) {
    if (SOUNDS[key]) {
        SOUNDS[key].volume = 0.5;
        SOUNDS[key].load(); // Attempt to load them
    }
}

// --- DOM Elements ---
const mainMenu = document.getElementById('mainMenu');
const gameScreen = document.getElementById('gameScreen');

// Main Menu Buttons
const playGameBtn = document.getElementById('playGameBtn');
const achievementsBtn = document.getElementById('achievementsBtn');
const statsBtn = document.getElementById('statsBtn');
const howToPlayBtn = document.getElementById('howToPlayBtn');
const settingsBtn = document.getElementById('settingsBtn');

// Game Screen Elements
const gameStatus = document.getElementById('gameStatus');
const gameBoardContainer = document.getElementById('gameBoard');
const playerXScore = document.getElementById('playerXScore');
const playerOScore = document.getElementById('playerOScore');
const drawScore = document.getElementById('drawScore');
const twistInfo = document.getElementById('twistInfo');
const resetButton = document.getElementById('resetButton');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const gameTimerContainer = document.getElementById('gameTimerContainer');
const gameTimerDisplay = document.getElementById('gameTimer');

// Modals
const gameSetupModal = document.getElementById('gameSetupModal');
const achievementsModal = document.getElementById('achievementsModal');
const statsModal = document.getElementById('statsModal');
const howToPlayModal = document.getElementById('howToPlayModal');
const settingsModal = document.getElementById('settingsModal');
const replayModal = document.getElementById('replayModal');
const confirmationModal = document.getElementById('confirmationModal');

const modalCloseButtons = document.querySelectorAll('[data-modal-close]');
const notificationElement = document.getElementById('notification');

// Game Setup Modal elements
const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
const gameModeRadios = document.querySelectorAll('input[name="gameMode"]');
const autoPlayNextRoundCheckbox = document.getElementById('autoPlayNextRound');
const startGameFromSetupBtn = document.getElementById('startGameFromSetup');

// Achievements Modal elements
const achievementList = document.getElementById('achievementList');

// Stats Modal elements
const statTotalGames = document.getElementById('statTotalGames');
const statPlayerWins = document.getElementById('statPlayerWins');
const statAIWins = document.getElementById('statAIWins');
const statDraws = document.getElementById('statDraws');
const statWinRate = document.getElementById('statWinRate');
const statFastestSDWin = document.getElementById('statFastestSDWin');
const resetStatsBtn = document.getElementById('resetStatsBtn');

// General Settings Modal elements
const animationSpeedSlider = document.getElementById('animationSpeed');
const animationSpeedValue = document.getElementById('animationSpeedValue');
const soundToggleCheckbox = document.getElementById('soundToggle');
const themeRadios = document.querySelectorAll('input[name="theme"]');

// Replay Modal elements
const replayBoardContainer = document.getElementById('replayBoard');
const replayPrevBtn = document.getElementById('replayPrevBtn');
const replayPlayPauseBtn = document.getElementById('replayPlayPauseBtn');
const replayNextBtn = document.getElementById('replayNextBtn');
const replayStatusDisplay = document.getElementById('replayStatus');

// Confirmation Modal elements
const confirmationModalMessage = document.getElementById('confirmationModalMessage');
const confirmYesBtn = document.getElementById('confirmYesBtn');
const confirmNoBtn = document.getElementById('confirmNoBtn');

// --- Utility Functions ---
function playSound(soundKey) {
    if (gameSettings.soundEnabled && SOUNDS[soundKey]) {
        SOUNDS[soundKey].currentTime = 0; // Reset to start for quick repeated plays
        SOUNDS[soundKey].play().catch(e => console.warn("Sound playback failed:", e)); // Catch Promise error
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
    document.getElementById(viewId).classList.add('active');
    playSound('buttonClick');
}

function openModal(modalElement) {
    modalElement.classList.add('active');
    modalElement.querySelector('.modal-content').focus(); // Focus modal for accessibility
    document.body.style.overflow = 'hidden'; // Prevent body scroll
    playSound('buttonClick');
}

function closeModal(modalElement) {
    modalElement.classList.remove('active');
    document.body.style.overflow = ''; // Restore body scroll
}

let confirmActionCallback = null;
function showConfirmation(message, callback) {
    confirmationModalMessage.textContent = message;
    confirmActionCallback = callback;
    openModal(confirmationModal);
}

// --- Persistence (Local Storage) ---
function loadGameData() {
    Object.assign(gameSettings, JSON.parse(localStorage.getItem('ticTacToeSettings') || '{}'));
    Object.assign(gameStats, JSON.parse(localStorage.getItem('ticTacToeStats') || '{}'));

    // Initialize achievements array from data and saved unlocked states
    achievements = JSON.parse(JSON.stringify(ACHIEVEMENTS_DATA)); // Deep copy
    const savedAchievements = JSON.parse(localStorage.getItem('ticTacToeAchievements') || '[]');
    achievements.forEach(achDef => {
        const loadedAch = savedAchievements.find(sa => sa.id === achDef.id);
        if (loadedAch) {
            achDef.unlocked = loadedAch.unlocked;
        }
    });

    // Handle potential new keys in gameStats (e.g., fastestSuddenDeathWinTime)
    if (gameStats.fastestSuddenDeathWinTime === undefined) gameStats.fastestSuddenDeathWinTime = Infinity;
    if (gameStats.playerWinsByDifficulty === undefined) gameStats.playerWinsByDifficulty = { zen: 0, strategist: 0, punisher: 0 };
    if (gameStats.playerWinsByMode === undefined) gameStats.playerWinsByMode = { standard: 0, suddenDeath: 0, blindPlay: 0, dailyChallenge: 0 };
    if (gameStats.lastDailyChallengeDate === undefined) gameStats.lastDailyChallengeDate = null;

    applySettingsToUI();
    applyTheme(gameSettings.theme);
}

function saveGameData() {
    localStorage.setItem('ticTacToeSettings', JSON.stringify(gameSettings));
    localStorage.setItem('ticTacToeStats', JSON.stringify(gameStats));
    localStorage.setItem('ticTacToeAchievements', JSON.stringify(achievements.map(a => ({ id: a.id, unlocked: a.unlocked }))));
}

function applySettingsToUI() {
    autoPlayNextRoundCheckbox.checked = gameSettings.autoPlayNextRound;
    animationSpeedSlider.value = gameSettings.animationSpeed;
    animationSpeedValue.textContent = `${gameSettings.animationSpeed}ms`;
    soundToggleCheckbox.checked = gameSettings.soundEnabled;

    document.documentElement.style.setProperty('--animation-speed', `${gameSettings.animationSpeed}ms`);

    // Set difficulty radio button
    document.querySelector(`input[name="difficulty"][value="${gameSettings.difficulty}"]`).checked = true;
    // Set game mode radio button
    document.querySelector(`input[name="gameMode"][value="${gameSettings.gameMode}"]`).checked = true;
    // Set theme radio button
    document.querySelector(`input[name="theme"][value="${gameSettings.theme}"]`).checked = true;
}

function applyTheme(themeName) {
    document.body.className = ''; // Remove existing theme classes
    document.body.classList.add(`theme-${themeName}`);
    gameSettings.theme = themeName; // Update setting
    saveGameData();
}

// --- UI Updates ---
function updateScoreDisplay() {
    playerXScore.textContent = `Player X: ${gameStats.playerWins}`;
    playerOScore.textContent = `AI O: ${gameStats.aiWins}`;
    drawScore.textContent = `Draws: ${gameStats.draws}`;

    // Highlight current player
    if (currentPlayer === 'X') {
        playerXScore.classList.add('x-active');
        playerOScore.classList.remove('o-active');
    } else {
        playerXScore.classList.remove('x-active');
        playerOScore.classList.add('o-active');
    }
}

function updateTwistInfo() {
    let message = "The AI adapts, evolves, and *remembers*. Play wisely, or face its true despair!";
    if (gameSettings.gameMode === 'suddenDeath') {
        message = "Sudden Death! Every move counts, and time is your enemy.";
    } else if (gameSettings.gameMode === 'blindPlay') {
        message = "Blind Play! Can you remember what was hidden?";
    } else if (gameSettings.gameMode === 'dailyChallenge') {
        message = "Daily Challenge! Can you solve today's puzzle?";
    } else { // Standard mode messages
        if (gameStats.consecutivePlayerLosses >= 2) {
            message = "The AI senses your repeated losses. It's getting relentless.";
        } else if (gameStats.consecutivePlayerWins >= 1) {
            message = "You're on a winning streak! The AI is calculating your demise.";
        } else if (gameStats.aiWins > gameStats.playerWins + 2) {
            message = "The AI is dominating. Can you even make it draw?";
        } else if (gameStats.playerWins > gameStats.aiWins + 2) {
            message = "You're outsmarting the AI! Don't let your guard down.";
        }
    }
    twistInfo.textContent = message;
}


// --- Game Initialization & Reset ---
function createBoard(container, isReplay = false) {
    container.innerHTML = '';
    for (let i = 0; i < GAME_BOARD_SIZE * GAME_BOARD_SIZE; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        if (!isReplay) { // Only add interactive listeners for the actual game board
            cell.dataset.cellIndex = i;
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `Cell ${i + 1}`);
            cell.addEventListener('click', handleCellClick);
            cell.addEventListener('keydown', handleCellKeyDown);
        }
        container.appendChild(cell);
    }
}

function initializeGame(startNew = false) {
    if (startNew) {
        gameStats.totalGames++; // Increment game count for new game
    }

    board = Array(GAME_BOARD_SIZE * GAME_BOARD_SIZE).fill('');
    isGameActive = true;
    flawlessVictoryPossible = true;
    gameHistory = []; // Reset replay history
    currentTurnStartTime = Date.now(); // Reset timer for Sudden Death

    // Clear board and reset styles
    document.querySelectorAll('#gameBoard .cell').forEach((cell, index) => {
        cell.innerHTML = ''; // Clear content
        cell.classList.remove('x-mark', 'o-mark', 'occupied', 'winning-cell', 'disabled', 'blind');
        cell.setAttribute('aria-label', `Cell ${index + 1}`);
        cell.setAttribute('tabindex', '0');
    });

    // Remove any previous winning line
    const oldLine = document.querySelector('.winning-line-animation');
    if (oldLine) oldLine.remove();

    // Sudden Death UI setup
    if (gameSettings.gameMode === 'suddenDeath') {
        gameTimerContainer.classList.remove('hidden');
        gameTimerDisplay.textContent = '10.0'; // Initial timer value
        gameTimerContainer.style.setProperty('--timer-progress', '1'); // Full bar
        startSuddenDeathTimer();
    } else {
        gameTimerContainer.classList.add('hidden');
        stopSuddenDeathTimer();
    }

    // Blind Play UI setup
    if (gameSettings.gameMode === 'blindPlay') {
        startBlindCellsTimer();
    } else {
        stopBlindCellsTimer();
    }

    // Daily Challenge setup
    if (gameSettings.gameMode === 'dailyChallenge') {
        // Determine the daily challenge board
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        if (gameStats.lastDailyChallengeDate !== today || !gameStats.lastDailyChallengeDate) {
            // New day or first time, pick a new challenge
            dailyChallengeIndex = Math.floor(Math.random() * DAILY_CHALLENGE_BOARDS.length);
            gameStats.lastDailyChallengeDate = today;
            showNotification('Daily Challenge', 'A new challenge awaits!');
        } else {
            // Same day, use the existing challenge
            showNotification('Daily Challenge', 'Continuing today\'s challenge!');
        }
        board = [...DAILY_CHALLENGE_BOARDS[dailyChallengeIndex]]; // Clone the challenge board

        // Render initial challenge board state
        board.forEach((mark, index) => {
            if (mark) {
                const cellElement = document.querySelector(`#gameBoard [data-cell-index="${index}"]`);
                if (cellElement) {
                    cellElement.innerHTML = `<span class="mark-animated">${mark}</span>`;
                    cellElement.classList.add(mark === 'X' ? 'x-mark' : 'o-mark', 'occupied');
                    cellElement.setAttribute('aria-label', `${mark} placed in cell ${index + 1}`);
                    cellElement.setAttribute('tabindex', '-1');
                }
            }
        });
        flawlessVictoryPossible = false; // Not possible with pre-filled cells
    }


    // Decide who goes first randomly (no specific setting for it now)
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';

    gameStatus.textContent = `Game On! ${currentPlayer === 'X' ? 'Player X' : 'AI O'}'s Turn`;
    updateScoreDisplay();
    updateTwistInfo();
    saveGameData(); // Save game data including stats (total games etc)

    // AI's first turn if it's 'O'
    if (currentPlayer === 'O') {
        setTimeout(() => handleAITurn(), gameSettings.animationSpeed);
    }
    recordMove(); // Record initial board state
}

function resetGame() {
    stopSuddenDeathTimer();
    stopBlindCellsTimer();
    initializeGame(true); // Call initialize game, marking it as a new game
}

// --- Core Game Logic ---

function handleCellClick(event) {
    const clickedCell = event.target;
    const clickedCellIndex = parseInt(clickedCell.dataset.cellIndex);

    if (board[clickedCellIndex] !== '' || !isGameActive || currentPlayer !== 'X') {
        // If AI's turn, occupied, or game ended, do nothing
        return;
    }

    playSound('placeMark');
    placeMark(clickedCell, clickedCellIndex, currentPlayer);
    recordMove(); // Record move after placing
    checkResult();

    if (isGameActive) {
        // AI's turn after player makes a move
        setTimeout(() => {
            handleAITurn();
        }, gameSettings.animationSpeed);
    }
}

function handleCellKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        handleCellClick(event);
    }
    // Implement arrow key navigation for accessibility
    const index = parseInt(event.target.dataset.cellIndex);
    let nextIndex = -1;

    switch (event.key) {
        case 'ArrowUp':
            nextIndex = index - GAME_BOARD_SIZE;
            break;
        case 'ArrowDown':
            nextIndex = index + GAME_BOARD_SIZE;
            break;
        case 'ArrowLeft':
            nextIndex = index - 1;
            break;
        case 'ArrowRight':
            nextIndex = index + 1;
            break;
    }

    if (nextIndex >= 0 && nextIndex < board.length) {
        const nextCell = document.querySelector(`[data-cell-index="${nextIndex}"]`);
        if (nextCell) {
            nextCell.focus();
            event.preventDefault(); // Prevent default scroll behavior
        }
    }
}

function placeMark(cellElement, index, player) {
    board[index] = player;
    cellElement.innerHTML = `<span class="mark-animated">${player}</span>`; // Use span for animation
    cellElement.classList.add(player === 'X' ? 'x-mark' : 'o-mark', 'occupied');
    cellElement.setAttribute('aria-label', `${player} placed in cell ${index + 1}`);
    cellElement.setAttribute('aria-live', 'assertive');
    cellElement.setAttribute('tabindex', '-1');

    if (player === 'O') {
        flawlessVictoryPossible = false;
    }

    // Reset Sudden Death timer
    if (gameSettings.gameMode === 'suddenDeath') {
        currentTurnStartTime = Date.now();
        gameTimerContainer.style.setProperty('--timer-progress', '1');
    }
}

function changePlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    gameStatus.textContent = `${currentPlayer === 'X' ? 'Player X' : 'AI O'}'s Turn`;
    updateScoreDisplay();
    updateTwistInfo(); // Update twist info on turn change
}

function checkResult() {
    const winnerInfo = getWinner(board);

    if (winnerInfo) {
        isGameActive = false;
        stopSuddenDeathTimer();
        stopBlindCellsTimer();
        highlightWinningCells(winnerInfo.cells);

        let outcome = '';
        if (winnerInfo.player === 'X') {
            gameStatus.textContent = 'Player X Wins!';
            gameStats.playerWins++;
            gameStats.consecutivePlayerWins++;
            gameStats.consecutivePlayerLosses = 0;
            gameStats.playerWinsByDifficulty[gameSettings.difficulty]++;
            gameStats.playerWinsByMode[gameSettings.gameMode]++;
            playSound('win');
            outcome = 'win';

            // Check Fastest Sudden Death Win
            if (gameSettings.gameMode === 'suddenDeath') {
                const gameDuration = (Date.now() - gameHistory[0].timestamp) / 1000;
                if (gameDuration < gameStats.fastestSuddenDeathWinTime) {
                    gameStats.fastestSuddenDeathWinTime = gameDuration;
                    showNotification('New Record!', `Fastest Sudden Death win: ${gameDuration.toFixed(1)}s`);
                }
            }

        } else {
            gameStatus.textContent = 'AI O Wins!';
            gameStats.aiWins++;
            gameStats.consecutivePlayerLosses++;
            gameStats.consecutivePlayerWins = 0;
            playSound('lose');
            outcome = 'lose';
        }
        updateScoreDisplay();
        saveGameData();
        updateAchievements(outcome);
        setTimeout(() => handleGameEnd(), gameSettings.animationSpeed * 2);
        return;
    }

    const isBoardFull = !board.includes('');
    if (isBoardFull) {
        isGameActive = false;
        stopSuddenDeathTimer();
        stopBlindCellsTimer();
        gameStatus.textContent = 'It\'s a Draw!';
        gameStats.draws++;
        gameStats.consecutivePlayerWins = 0;
        gameStats.consecutivePlayerLosses = 0;
        playSound('draw');
        updateScoreDisplay();
        saveGameData();
        updateAchievements('draw');
        setTimeout(() => handleGameEnd(), gameSettings.animationSpeed);
        return;
    }

    changePlayer();
}

function handleGameEnd() {
    // Offer replay
    const replayMessage = gameSettings.gameMode === 'dailyChallenge' ? 'Daily Challenge completed!' : 'Game Over!';
    replayStatusDisplay.textContent = replayMessage;
    openModal(replayModal);
    renderReplayBoard(gameHistory[0].board);
    replayCurrentStep = 0;
    updateReplayControls();

    if (gameSettings.autoPlayNextRound) {
        // Automatically start next game after a delay
        setTimeout(() => {
            closeModal(replayModal); // Close replay modal automatically
            initializeGame(true); // Start a new game
        }, gameSettings.animationSpeed * 5); // Longer delay before auto-reset
    }
}

function highlightWinningCells(cells) {
    // Calculate board dimensions for line drawing
    const boardRect = gameBoardContainer.getBoundingClientRect();
    const cellSize = boardRect.width / GAME_BOARD_SIZE;

    let lineClass = '';
    let startCellRect, endCellRect;

    if (cells[0] === 0 && cells[1] === 1 && cells[2] === 2) { // Top Row
        lineClass = 'horizontal';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    } else if (cells[0] === 3 && cells[1] === 4 && cells[2] === 5) { // Middle Row
        lineClass = 'horizontal';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    } else if (cells[0] === 6 && cells[1] === 7 && cells[2] === 8) { // Bottom Row
        lineClass = 'horizontal';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    } else if (cells[0] === 0 && cells[1] === 3 && cells[2] === 6) { // Left Col
        lineClass = 'vertical';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    } else if (cells[0] === 1 && cells[1] === 4 && cells[2] === 7) { // Middle Col
        lineClass = 'vertical';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    } else if (cells[0] === 2 && cells[1] === 5 && cells[2] === 8) { // Right Col
        lineClass = 'vertical';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    } else if (cells[0] === 0 && cells[1] === 4 && cells[2] === 8) { // Diag TL-BR
        lineClass = 'diag1';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    } else if (cells[0] === 2 && cells[1] === 4 && cells[2] === 6) { // Diag TR-BL
        lineClass = 'diag2';
        startCellRect = document.querySelector(`[data-cell-index="${cells[0]}"]`).getBoundingClientRect();
        endCellRect = document.querySelector(`[data-cell-index="${cells[2]}"]`).getBoundingClientRect();
    }

    const line = document.createElement('div');
    line.classList.add('winning-line-animation', lineClass);

    // Position the line
    line.style.left = `${(startCellRect.left - boardRect.left) + (cellSize / 2)}px`;
    line.style.top = `${(startCellRect.top - boardRect.top) + (cellSize / 2)}px`;

    // For diagonal lines, set custom property for animation length
    if (lineClass.startsWith('diag')) {
        const lineLength = Math.sqrt(Math.pow(endCellRect.x - startCellRect.x, 2) + Math.pow(endCellRect.y - startCellRect.y, 2));
        line.style.setProperty('--board-size-px', `${lineLength}px`);
    }

    // Apply animation specific to class
    if (lineClass === 'vertical') {
        line.style.animationName = 'draw-line-vertical';
    } else if (lineClass === 'diag1') {
        line.style.animationName = 'draw-line-diag1';
    } else if (lineClass === 'diag2') {
        line.style.animationName = 'draw-line-diag2';
    }

    gameBoardContainer.appendChild(line);

    cells.forEach(index => {
        const cellElement = document.querySelector(`[data-cell-index="${index}"]`);
        if (cellElement) {
            cellElement.classList.add('winning-cell');
        }
    });
}


// --- AI Logic (Optimal Minimax for 3x3) ---

function getEmptyCells(currentBoard) {
    const emptyCells = [];
    for (let i = 0; i < currentBoard.length; i++) {
        if (currentBoard[i] === '') {
            emptyCells.push(i);
        }
    }
    return emptyCells;
}

function minimax(currentBoard, isMaximizingPlayer) {
    const winnerInfo = getWinner(currentBoard);

    if (winnerInfo) {
        if (winnerInfo.player === 'O') return 10; // AI wins (higher score)
        if (winnerInfo.player === 'X') return -10; // Player wins (lower score)
    }
    if (!currentBoard.includes('')) {
        return 0; // Draw
    }

    const emptyCells = getEmptyCells(currentBoard);

    if (isMaximizingPlayer) { // AI's turn (O)
        let bestScore = -Infinity;
        for (const index of emptyCells) {
            currentBoard[index] = 'O';
            let score = minimax(currentBoard, false);
            currentBoard[index] = '';
            bestScore = Math.max(bestScore, score);
        }
        return bestScore;
    } else { // Player's turn (X)
        let bestScore = Infinity;
        for (const index of emptyCells) {
            currentBoard[index] = 'X';
            let score = minimax(currentBoard, true);
            currentBoard[index] = '';
            bestScore = Math.min(bestScore, score);
        }
        return bestScore;
    }
}

function getWinner(currentBoard) {
    for (let i = 0; i < WINNING_COMBOS.length; i++) {
        const [a, b, c] = WINNING_COMBOS[i];
        if (currentBoard[a] !== '' && currentBoard[a] === currentBoard[b] && currentBoard[b] === currentBoard[c]) {
            return { player: currentBoard[a], cells: [a, b, c] };
        }
    }
    return null;
}

// AI's Turn - Based on Difficulty Preset
function handleAITurn() {
    if (!isGameActive || currentPlayer !== 'O') return;

    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) return;

    let aiMove = -1;

    switch (gameSettings.difficulty) {
        case 'zen':
            // Zen Master: 30% chance of a random move, otherwise optimal
            if (Math.random() < 0.3) {
                aiMove = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            } else {
                aiMove = getOptimalAIMove();
            }
            break;
        case 'strategist':
        case 'punisher': // Both play optimally
            aiMove = getOptimalAIMove();
            break;
    }

    const cellToClick = document.querySelector(`[data-cell-index="${aiMove}"]`);
    if (cellToClick) {
        playSound('placeMark');
        placeMark(cellToClick, aiMove, 'O');
        recordMove();
        checkResult();
    }
}

function getOptimalAIMove() {
    let bestScore = -Infinity;
    let bestMoves = [];
    const emptyCells = getEmptyCells(board);

    // Prioritize center and corners for initial moves (heuristic, but minimax will confirm)
    const moveOrder = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    const orderedEmptyCells = moveOrder.filter(idx => board[idx] === '');

    for (const index of orderedEmptyCells) {
        board[index] = 'O';
        let score = minimax([...board], false); // Pass a copy to avoid modifying original board
        board[index] = ''; // Reset board

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [index];
        } else if (score === bestScore) {
            bestMoves.push(index);
        }
    }
    // Return a random choice among the best moves if multiple exist
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// --- Game Mode Specific Logic ---

// Sudden Death Timer
function startSuddenDeathTimer() {
    stopSuddenDeathTimer(); // Ensure no multiple timers
    currentTurnStartTime = Date.now();
    let timeLeft = 10; // Initial time for each turn
    gameTimerDisplay.textContent = timeLeft.toFixed(1);

    suddenDeathInterval = setInterval(() => {
        const elapsedTime = (Date.now() - currentTurnStartTime) / 1000;
        timeLeft = 10 - elapsedTime; // Time per turn
        gameTimerDisplay.textContent = timeLeft.toFixed(1);

        const progress = timeLeft / 10;
        gameTimerContainer.style.setProperty('--timer-progress', Math.max(0, progress));

        if (timeLeft <= 0) {
            playSound('timeout');
            handleSuddenDeathTimeout();
        } else if (timeLeft <= 3 && Math.floor(timeLeft * 10) % 10 === 0) { // Play tick sound every second for last 3 seconds
            playSound('timerTick');
        }
    }, 100); // Update every 100ms for smooth countdown
}

function stopSuddenDeathTimer() {
    if (suddenDeathInterval) {
        clearInterval(suddenDeathInterval);
        suddenDeathInterval = null;
    }
}

function handleSuddenDeathTimeout() {
    stopSuddenDeathTimer();
    gameStatus.textContent = `${currentPlayer === 'X' ? 'Player X' : 'AI O'} Timed Out!`;
    isGameActive = false;

    // Forfeit logic: For human player, AI wins. For AI, human wins (only if Zen Master AI)
    if (currentPlayer === 'X') {
        gameStats.aiWins++;
        gameStats.consecutivePlayerLosses++;
        gameStats.consecutivePlayerWins = 0;
        showNotification('Time Out!', 'You failed to make a move!');
    } else { // AI timed out (only if AI is 'Zen Master' and took too long for its random move)
        gameStats.playerWins++;
        gameStats.consecutivePlayerWins++;
        gameStats.consecutivePlayerLosses = 0;
        showNotification('AI Timed Out!', 'The Zen Master was too zen!');
    }
    updateScoreDisplay();
    saveGameData();
    updateAchievements('timeout');
    setTimeout(() => handleGameEnd(), gameSettings.animationSpeed * 2);
}

// Blind Play Mode
function startBlindCellsTimer() {
    stopBlindCellsTimer(); // Clear any existing timer
    let turnCount = 0;
    blindCellsInterval = setInterval(() => {
        if (!isGameActive) return;

        turnCount++;
        // On turn 3 (2 marks each) and every 2 turns after, toggle blind cells
        if (turnCount >= 3 && turnCount % 2 !== 0) {
            toggleBlindCells();
        } else {
            // Unblind cells
            document.querySelectorAll('#gameBoard .cell.blind').forEach(cell => {
                cell.classList.remove('blind', 'highlight-on-hover');
            });
        }
    }, (gameSettings.animationSpeed * 2) + 1000); // Check every ~2 turns for new state
}

function stopBlindCellsTimer() {
    if (blindCellsInterval) {
        clearInterval(blindCellsInterval);
        blindCellsInterval = null;
    }
    // Always unblind all cells when mode ends or game stops
    document.querySelectorAll('#gameBoard .cell.blind').forEach(cell => {
        cell.classList.remove('blind', 'highlight-on-hover');
    });
    blindCells = []; // Clear the list of blind cells
}

function toggleBlindCells() {
    const empty = getEmptyCells(board);
    const occupied = board.map((mark, idx) => mark !== '' ? idx : -1).filter(idx => idx !== -1);

    // Prioritize blinding occupied cells
    const potentialBlindCells = occupied.length > 3 ? occupied : empty; // If many marks, blind occupied, else blind empty

    if (potentialBlindCells.length === 0) return;

    blindCells = []; // Reset current blind cells
    const numToBlind = Math.min(2, Math.floor(potentialBlindCells.length / 2)); // Blind up to 2 cells, or half available
    for (let i = 0; i < numToBlind; i++) {
        let randomIndex = Math.floor(Math.random() * potentialBlindCells.length);
        let cellIndex = potentialBlindCells[randomIndex];
        // Ensure we don't blind a cell already chosen
        while (blindCells.includes(cellIndex) && potentialBlindCells.length > blindCells.length) {
            randomIndex = Math.floor(Math.random() * potentialBlindCells.length);
            cellIndex = potentialBlindCells[randomIndex];
        }
        blindCells.push(cellIndex);
    }

    document.querySelectorAll('#gameBoard .cell').forEach((cell, index) => {
        if (blindCells.includes(index)) {
            cell.classList.add('blind');
            if (board[index] === '') { // Only allow hover highlight for empty blind cells
                cell.classList.add('highlight-on-hover');
            }
        } else {
            cell.classList.remove('blind', 'highlight-on-hover');
        }
    });
    twistInfo.textContent = "The board shifts... what was there again?";
}

// Daily Challenge - Check if it's a new day for the challenge
function isNewDailyChallenge() {
    const today = new Date().toISOString().slice(0, 10);
    return gameStats.lastDailyChallengeDate !== today;
}


// --- Achievements System ---

function updateAchievements(outcome = null) {
    // General Stats based
    if (gameStats.playerWins >= 1) unlockAchievement('firstWin');
    if (gameStats.draws >= 3) unlockAchievement('drawSpecialist');
    if (gameStats.consecutivePlayerWins >= 3) unlockAchievement('unstoppableForce');
    if ((gameStats.totalGames >= 10 && gameStats.playerWins === 0) || (gameStats.totalGames - gameStats.playerWins - gameStats.aiWins - gameStats.draws >= 10 && gameStats.playerWins === 0)) {
        unlockAchievement('neverGiveUp'); // If played 10 or more games (total) without any wins
    }

    // Tiered difficulty wins
    ACHIEVEMENTS_DATA.filter(a => a.id.startsWith('masterOfDespair')).forEach(ach => {
        if (gameStats.playerWinsByDifficulty.strategist >= ach.threshold || gameStats.playerWinsByDifficulty.punisher >= ach.threshold) {
            unlockAchievement(ach.id);
        }
    });

    // Mode-specific achievements
    ACHIEVEMENTS_DATA.filter(a => a.mode).forEach(ach => {
        if (gameStats.playerWinsByMode[ach.mode] >= ach.threshold) {
            unlockAchievement(ach.id);
        }
    });

    // Flawless Victory
    if (outcome === 'win' && flawlessVictoryPossible) {
        unlockAchievement('perfectGame');
    }

    // Breaking the Flow
    if (outcome === 'win' && gameStats.consecutivePlayerLosses >= 2) {
        unlockAchievement('breakingFlow');
    }

    // Lucky Strike (if player won Sudden Death with very little time left)
    if (outcome === 'win' && gameSettings.gameMode === 'suddenDeath') {
        const timeAtWin = (Date.now() - currentTurnStartTime) / 1000;
        if (timeAtWin <= 1.5) { // If less than 1.5 seconds left when winning move was made
            unlockAchievement('luckyStrike');
        }
    }

    // Tactical Genius (fork detection) - This is hard for a perfectly playing AI.
    // Simplified: Win by X having 5 marks and O having 4 marks, implies AI couldn't block a fork
    if (outcome === 'win' && board.filter(cell => cell === 'X').length === 5 && board.filter(cell => cell === 'O').length === 4) {
        unlockAchievement('tacticalGenius');
    }

    // Themes Unlocked
    // This check should be based on if user has explicitly selected all themes at least once
    // A better way would be to track 'themesApplied' in localStorage
    const themeCounts = { dark: false, light: false, matrix: false };
    const savedSettings = JSON.parse(localStorage.getItem('ticTacToeSettings') || '{}');
    if (savedSettings.theme === 'dark' || document.body.classList.contains('theme-dark')) themeCounts.dark = true;
    if (savedSettings.theme === 'light' || document.body.classList.contains('theme-light')) themeCounts.light = true;
    if (savedSettings.theme === 'matrix' || document.body.classList.contains('theme-matrix')) themeCounts.matrix = true;

    if (themeCounts.dark && themeCounts.light && themeCounts.matrix) {
        unlockAchievement('themesUnlocked');
    }


    saveGameData(); // Save updated achievement status
    renderAchievements(); // Refresh achievement list
}

function getAchievement(id) {
    return achievements.find(a => a.id === id);
}

function unlockAchievement(id) {
    const achievement = getAchievement(id);
    if (achievement && !achievement.unlocked) {
        achievement.unlocked = true;
        showNotification(`Achievement Unlocked: ${achievement.name}`, achievement.description);
        playSound('win'); // Use win sound for achievement
        renderAchievements();
        saveGameData();
    }
}

function renderAchievements() {
    achievementList.innerHTML = '';
    achievements.forEach(ach => {
        const card = document.createElement('div');
        card.classList.add('achievement-card');
        if (ach.unlocked) {
            card.classList.add('unlocked');
        }
        if (ach.secret && !ach.unlocked) {
            // Hide secret achievements if not unlocked
            card.classList.add('hidden'); // Or show with question marks
        }

        const icon = document.createElement('div');
        icon.classList.add('achievement-icon');
        icon.textContent = ach.unlocked ? ach.icon : '🔒';

        const name = document.createElement('div');
        name.classList.add('achievement-name');
        name.textContent = ach.name;

        const description = document.createElement('div');
        description.classList.add('achievement-description');
        description.textContent = ach.description;

        card.append(icon, name, description);
        achievementList.appendChild(card);
    });
}

function renderStats() {
    statTotalGames.textContent = gameStats.totalGames;
    statPlayerWins.textContent = gameStats.playerWins;
    statAIWins.textContent = gameStats.aiWins;
    statDraws.textContent = gameStats.draws;

    const totalDecidedGames = gameStats.playerWins + gameStats.aiWins;
    if (totalDecidedGames > 0) {
        const winRate = (gameStats.playerWins / totalDecidedGames) * 100;
        statWinRate.textContent = `${winRate.toFixed(1)}%`;
    } else {
        statWinRate.textContent = 'N/A';
    }

    // --- The improved check for fastestSuddenDeathWinTime ---
    // Check if it's a valid finite number.
    // isFinite() returns false for Infinity, -Infinity, and NaN, as well as null/undefined if type-coerced.
    if (Number.isFinite(gameStats.fastestSuddenDeathWinTime)) {
        statFastestSDWin.textContent = `${gameStats.fastestSuddenDeathWinTime.toFixed(1)}s`;
    } else {
        statFastestSDWin.textContent = 'N/A';
    }
}

function resetStats() {
    showConfirmation("Are you sure you want to reset all your game statistics and achievements? This cannot be undone!", () => {
        gameStats = {
            totalGames: 0,
            playerWins: 0,
            aiWins: 0,
            draws: 0,
            consecutivePlayerLosses: 0,
            consecutivePlayerWins: 0,
            fastestSuddenDeathWinTime: Infinity,
            playerWinsByDifficulty: { zen: 0, strategist: 0, punisher: 0 },
            playerWinsByMode: { standard: 0, suddenDeath: 0, blindPlay: 0, dailyChallenge: 0 },
            lastDailyChallengeDate: null
        };
        // Reset all achievements to unlocked: false
        achievements.forEach(ach => ach.unlocked = false);

        saveGameData();
        renderStats();
        renderAchievements();
        showNotification('Stats Reset!', 'Your game statistics and achievements have been reset.');
        closeModal(confirmationModal);
    });
}

// --- Twist Info / Dynamic Messages ---
// (Moved definition to earlier in the script for proper scope)

// --- Notification System ---
function showNotification(title, message) {
    notificationElement.innerHTML = `<h3>${title}</h3><p>${message}</p>`;
    notificationElement.classList.add('show');
    notificationElement.setAttribute('aria-live', 'assertive');
    notificationElement.setAttribute('role', 'status');

    setTimeout(() => {
        notificationElement.classList.remove('show');
        notificationElement.addEventListener('transitionend', function handler() {
            notificationElement.removeEventListener('transitionend', handler);
            // Optional: clear content after transition
        });
    }, 4000);
}

// --- Replay System ---
function recordMove() {
    gameHistory.push({
        board: [...board], // Deep copy of the board
        player: currentPlayer,
        timestamp: Date.now()
    });
}

function renderReplayBoard(boardState) {
    const cells = replayBoardContainer.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        const mark = boardState[index];
        cell.innerHTML = mark ? `<span class="${mark === 'X' ? 'x-mark' : 'o-mark'}">${mark}</span>` : '';
        cell.classList.remove('x-mark', 'o-mark', 'occupied', 'winning-cell');
        if (mark) {
            cell.classList.add('occupied');
        }
    });
}

function updateReplayControls() {
    replayPrevBtn.disabled = replayCurrentStep === 0;
    replayNextBtn.disabled = replayCurrentStep >= gameHistory.length - 1;

    if (replayCurrentStep >= gameHistory.length - 1) {
        replayPlayPauseBtn.textContent = 'Replay';
        clearInterval(replayInterval);
        replayInterval = null;
    } else if (replayInterval) {
        replayPlayPauseBtn.textContent = 'Pause';
    } else {
        replayPlayPauseBtn.textContent = 'Play';
    }

    replayStatusDisplay.textContent = `Move ${replayCurrentStep + 1} of ${gameHistory.length}`;
}

function playReplay() {
    if (replayInterval) { // If playing, pause
        clearInterval(replayInterval);
        replayInterval = null;
        updateReplayControls();
        return;
    }

    if (replayCurrentStep >= gameHistory.length - 1) { // If at end, restart
        replayCurrentStep = 0;
    }

    replayInterval = setInterval(() => {
        replayCurrentStep++;
        if (replayCurrentStep < gameHistory.length) {
            renderReplayBoard(gameHistory[replayCurrentStep].board);
        }
        updateReplayControls();
        if (replayCurrentStep >= gameHistory.length - 1) {
            clearInterval(replayInterval);
            replayInterval = null;
            updateReplayControls();
        }
    }, gameSettings.animationSpeed + 100); // Speed of replay
}

function nextReplayStep() {
    if (replayCurrentStep < gameHistory.length - 1) {
        replayCurrentStep++;
        renderReplayBoard(gameHistory[replayCurrentStep].board);
        updateReplayControls();
    }
}

function prevReplayStep() {
    if (replayCurrentStep > 0) {
        replayCurrentStep--;
        renderReplayBoard(gameHistory[replayCurrentStep].board);
        updateReplayControls();
    }
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadGameData();
    createBoard(gameBoardContainer); // Initialize the game board once
    createBoard(replayBoardContainer, true); // Initialize the replay board (non-interactive)
    showView('mainMenu'); // Start at main menu
    renderAchievements(); // Populate achievements
    renderStats(); // Populate stats
});

// Main Menu Button Listeners
playGameBtn.addEventListener('click', () => {
    openModal(gameSetupModal);
});
achievementsBtn.addEventListener('click', () => {
    renderAchievements(); // Ensure latest state is rendered
    openModal(achievementsModal);
});
statsBtn.addEventListener('click', () => {
    renderStats(); // Ensure latest state is rendered
    openModal(statsModal);
});
howToPlayBtn.addEventListener('click', () => openModal(howToPlayModal));
settingsBtn.addEventListener('click', () => openModal(settingsModal));

// Game Setup Modal Listeners
startGameFromSetupBtn.addEventListener('click', () => {
    // Get selected difficulty
    gameSettings.difficulty = document.querySelector('input[name="difficulty"]:checked').value;
    // Get selected game mode
    gameSettings.gameMode = document.querySelector('input[name="gameMode"]:checked').value;
    // Get auto play setting
    gameSettings.autoPlayNextRound = autoPlayNextRoundCheckbox.checked;

    saveGameData();
    closeModal(gameSetupModal);
    showView('gameScreen');
    initializeGame(true); // Start a brand new game with selected settings
});

// Game Screen Button Listeners
resetButton.addEventListener('click', resetGame);
backToMenuBtn.addEventListener('click', () => {
    stopSuddenDeathTimer();
    stopBlindCellsTimer();
    isGameActive = false; // Ensure game is not active in background
    showView('mainMenu');
});

// Modal Close Buttons
modalCloseButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const modal = event.target.closest('.modal-overlay');
        if (modal) closeModal(modal);
    });
});

// Click outside modal to close
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeModal(overlay);
        }
    });
});

// Reset Stats Confirmation
resetStatsBtn.addEventListener('click', resetStats);
confirmYesBtn.addEventListener('click', () => {
    if (confirmActionCallback) {
        confirmActionCallback();
    }
});
confirmNoBtn.addEventListener('click', () => closeModal(confirmationModal));


// General Settings Listeners
animationSpeedSlider.addEventListener('input', (event) => {
    gameSettings.animationSpeed = parseInt(event.target.value);
    animationSpeedValue.textContent = `${gameSettings.animationSpeed}ms`;
    document.documentElement.style.setProperty('--animation-speed', `${gameSettings.animationSpeed}ms`);
    saveGameData();
});
soundToggleCheckbox.addEventListener('change', (event) => {
    gameSettings.soundEnabled = event.target.checked;
    saveGameData();
});
themeRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
        applyTheme(event.target.value);
    });
});

// Replay Controls
replayPlayPauseBtn.addEventListener('click', playReplay);
replayPrevBtn.addEventListener('click', prevReplayStep);
replayNextBtn.addEventListener('click', nextReplayStep);


// --- Keyboard Shortcuts (Accessibility & UX) ---
document.addEventListener('keydown', (event) => {
    const activeModal = document.querySelector('.modal-overlay.active');

    if (activeModal) {
        if (event.key === 'Escape') {
            closeModal(activeModal);
            event.preventDefault(); // Prevent further actions
        }
    } else { // Only respond to shortcuts if no modal is active
        if (event.key === 'r' || event.key === 'R') {
            if (gameScreen.classList.contains('active')) { // Only reset if on game screen
                resetGame();
                event.preventDefault();
            }
        } else if (event.key === 'a' || event.key === 'A') {
            renderAchievements();
            openModal(achievementsModal);
            event.preventDefault();
        } else if (event.key === 's' || event.key === 'S') {
            openModal(settingsModal); // Now opens general settings
            event.preventDefault();
        }
    }
});