import { writable, derived } from 'svelte/store';

export type Language = 'en' | 'de';

const STORAGE_KEY = 'wingspan_language';

function detectLanguage(): Language {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'de') return stored;
    } catch {
        /* storage unavailable */
    }
    try {
        if (navigator.language?.toLowerCase().startsWith('de')) return 'de';
    } catch {
        /* navigator unavailable */
    }
    return 'en';
}

export const language = writable<Language>(detectLanguage());

language.subscribe(lang => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
});

/** Change the UI language and remember the explicit choice. */
export function setLanguage(lang: Language) {
    language.set(lang);
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        /* storage unavailable */
    }
}

const en = {
    appTitle: "Wingspan Score Helper",
    back: "Back",
    next: "Next",
    // Setup
    addPlayer: "Add Player",
    playerName: "Player Name",
    players: "Players",
    startGame: "Start Game",
    // Categories
    round_goals: "Round Goals",
    bonus: "Bonus Cards",
    nectar: "Nectar",
    hummingbirds: "Hummingbird Track",
    birds: "Birds",
    tucked: "Tucked Cards",
    eggs: "Eggs",
    food: "Food on Cards",
    // Scoring
    selectPlayerPlace: "Select Player to Place:",
    resetGrid: "Reset Grid",
    tapGrid: "Tap the cells to place",
    selectAbove: "Pick a player above to start placing",
    // Grids
    round: "Round",
    biome: "Habitat",
    forest: "Forest",
    grassland: "Grassland",
    wetland: "Wetland",
    rank1: "1st",
    rank2: "2nd",
    rank3: "3rd",
    none: "None",
    // Result
    winner: "Winner",
    leaderboard: "Leaderboard",
    adjustScores: "Adjust Scores",
    viewStats: "View Detailed Stats",
    newGame: "New Game",
    confirmNewGame: "Start a new game?",
    // Start Selection
    start: "Start",
    firstSelected: "First Player Selected!",
    turnStartPre: "It's ",
    turnStartPost: "'s turn to start!",
    finishScoring: "Finish Scoring",
    pts: "pts",
    categoryTitle: "Category",
    total: "Total",
    // Stats
    scoreDistribution: "Score Distribution",
    avgScore: "Average Score",
    recentPlayers: "Recent Players",
    clearHistory: "Clear History",
    // History
    history: "History",
    date: "Date",
    delete: "Delete",
    compareGroup: "Compare Group",
    groupStats: "This group across all games",
    currentGame: "Current Game",
    selectGame: "Select Game",
    scoreBreakdown: "Score Breakdown",
    historyTrend: "History Trend",
    totalWins: "Total Wins",
    accumulatedPoints: "Accumulated Points",
    totalAccumulated: "Total Accumulated",
    statRate: "Win rate",
    statWins: "Wins",
    statAvg: "Avg",
    statHigh: "High",
    // --- Redesign additions ---
    appTagline: "field notes for the final tally",
    switchLanguage: "Switch language",
    gameOptions: "Game options",
    oceania: "Oceania expansion (nectar)",
    oceaniaHint: "Score nectar majorities per habitat",
    americas: "Americas expansion (hummingbirds)",
    americasHint: "Score your hummingbird track",
    roundGoalSide: "Round goal board",
    competitive: "Green · competitive",
    competitiveHint: "1st / 2nd / 3rd place per round",
    casual: "Blue · casual",
    casualHint: "1 point per item, max. 5 per round",
    maxPlayersReached: "The nest is full – up to {n} players.",
    removePlayerNamed: "Remove {name}",
    eggColor: "Egg colour {n}",
    nestEmpty: "The nest is empty – add the first player!",
    skip: "Skip",
    tapToSkip: "Tap to skip",
    letsGo: "Let's go!",
    hatching: "Who hatches first?",
    progressLabel: "Category {i} of {n}",
    plusOne: "One point more for {name}",
    minusOne: "One point less for {name}",
    toggleSign: "Toggle plus/minus for {name}",
    pointsFor: "Points for {name}",
    invalidRows: "Some placements don't add up – check the ties.",
    placeIn: "Place {name}: {row}, {rank}",
    hint_birds: "Points printed on your bird cards",
    hint_bonus: "Points from your bonus cards",
    hint_round_goals: "Place every player for each round",
    hint_round_goals_casual: "1 point per item, max. 5 per round (max. 20)",
    hint_eggs: "1 point per egg on your birds",
    hint_food: "1 point per food token cached on cards",
    hint_tucked: "1 point per card tucked under birds",
    hint_nectar: "Most nectar spent per habitat: 5 / 2 points",
    hint_hummingbirds: "Sum of the values beside your 5 markers – may be negative",
    revealing: "And the winner is …",
    sharedVictory: "Shared victory!",
    tieBreakerTitle: "Tie! Who has more food left?",
    tieBreakerHint: "Enter the unused food tokens in each tied player's supply.",
    foodTokens: "Food tokens",
    stillTied: "Still tied – the victory is shared.",
    noGameData: "No game data to display.",
    startNewGame: "Start new game",
    noHistoryYet: "No history yet",
    noGroupHistory: "No history for this exact group.",
    games: "games",
    home: "Home",
    // --- Quick sum ---
    quickSum: "Quick sum",
    quickSumFor: "Add up {category} for {name}",
    qsAdd: "Add {n}",
    qsRemoveTerm: "Remove {n}",
    qsSeed: "so far",
    qsSeedHint: "Already entered – keep tapping to add to it, or tap it to remove.",
    qsEmpty: "Tap the value of each card",
    qsTerms: "Entered values",
    qsSum: "Sum",
    qsUndo: "Undo",
    qsClear: "Clear",
    qsCancel: "Cancel",
    qsApply: "Apply",
    qsApplyNext: "Apply & on to {name}",
    qsUnit_card_one: "1 card",
    qsUnit_card: "{n} cards",
    qsUnit_bird_one: "1 bird",
    qsUnit_bird: "{n} birds",
    qsUnit_marker_one: "1 marker",
    qsUnit_marker: "{n} markers",
    qsUnit_round_one: "1 round",
    qsUnit_round: "{n} rounds",
    // --- Setup helper ---
    setupHelper: "Setup helper",
    setupIntro: "Draw the round goals for this game. Bonus cards stay secret – everyone draws their own.",
    setupTable: "Which goal tiles are in the box?",
    setupSets: "Expansions",
    set_core: "Core game",
    set_european: "European",
    set_oceania: "Oceania",
    set_asia: "Asia",
    set_americas: "Americas",
    setupErr_notEnoughGoals: "Not enough round goal tiles. Asia has no goal tiles for the normal game – add the core game or another expansion.",
    setupRedraw: "Re-draw round {n}",
    setupFlip: "Flip round {n}",
    setupShuffle: "Shuffle again",
    setupDealing: "Drawing …",
    setupDone: "Done – start scoring",
    setupGoalOfRound: "Round {n}: {goal}",
};

type TranslationKey = keyof typeof en;

const de: Record<TranslationKey, string> = {
    appTitle: "Flügelschlag-Rechner",
    back: "Zurück",
    next: "Weiter",
    // Setup
    addPlayer: "Spieler hinzufügen",
    playerName: "Spielername",
    players: "Spieler",
    startGame: "Spiel starten",
    // Categories
    round_goals: "Rundenziele",
    bonus: "Bonuskarten",
    nectar: "Nektar",
    hummingbirds: "Kolibri-Leiste",
    birds: "Vögel",
    tucked: "Karten unter Vögeln",
    eggs: "Eier",
    food: "Gelagertes Futter",
    // Scoring
    selectPlayerPlace: "Wen platzierst du?",
    resetGrid: "Zurücksetzen",
    tapGrid: "Tippe auf die Felder für",
    selectAbove: "Wähle oben eine Person aus, um sie zu platzieren.",
    // Grids
    round: "Runde",
    biome: "Lebensraum",
    forest: "Wald",
    grassland: "Grasland",
    wetland: "Feuchtgebiet",
    rank1: "1.",
    rank2: "2.",
    rank3: "3.",
    none: "Keine",
    // Result
    winner: "Sieg!",
    leaderboard: "Rangliste",
    adjustScores: "Punkte korrigieren",
    viewStats: "Zur Statistik",
    newGame: "Neues Spiel",
    confirmNewGame: "Neues Spiel starten?",
    // Start Selection
    start: "Start",
    firstSelected: "Der Startspieler steht fest!",
    turnStartPre: "",
    turnStartPost: " beginnt!",
    finishScoring: "Wertung abschließen",
    pts: "Pkt.",
    categoryTitle: "Kategorie",
    total: "Gesamt",
    // Stats
    scoreDistribution: "Punkteverteilung",
    avgScore: "Durchschnitt",
    recentPlayers: "Zuletzt dabei",
    clearHistory: "Liste leeren",
    // History
    history: "Verlauf",
    date: "Datum",
    delete: "Löschen",
    compareGroup: "Diese Gruppe vergleichen",
    groupStats: "Diese Gruppe über alle Partien",
    currentGame: "Aktuelle Partie",
    selectGame: "Partie wählen",
    scoreBreakdown: "Punkteübersicht",
    historyTrend: "Punkte im Verlauf",
    totalWins: "Siege gesamt",
    accumulatedPoints: "Punkte insgesamt",
    totalAccumulated: "Summe aller Partien",
    statRate: "Siegquote",
    statWins: "Siege",
    statAvg: "Ø",
    statHigh: "Max",
    // --- Redesign additions ---
    appTagline: "Feldnotizen zur Schlusswertung",
    switchLanguage: "Sprache wechseln",
    gameOptions: "Spieloptionen",
    oceania: "Ozeanien-Erweiterung (Nektar)",
    oceaniaHint: "Nektar-Mehrheiten je Lebensraum mitwerten",
    americas: "Mittel- und Südamerika (Kolibris)",
    americasHint: "Kolibri-Leiste mitwerten",
    roundGoalSide: "Zieltafel",
    competitive: "Grüne Seite · mit Wettbewerb",
    competitiveHint: "Punkte für Platz 1, 2 und 3 je Runde",
    casual: "Blaue Seite · ohne Wettbewerb",
    casualHint: "1 Punkt je passendem Element, max. 5 pro Runde",
    maxPlayersReached: "Das Nest ist voll – maximal {n} Personen.",
    removePlayerNamed: "{name} entfernen",
    eggColor: "Eifarbe {n}",
    nestEmpty: "Das Nest ist noch leer – wer spielt mit?",
    skip: "Überspringen",
    tapToSkip: "Tippen zum Überspringen",
    letsGo: "Los geht's!",
    hatching: "Wer schlüpft zuerst?",
    progressLabel: "Kategorie {i} von {n}",
    plusOne: "Ein Punkt mehr für {name}",
    minusOne: "Ein Punkt weniger für {name}",
    toggleSign: "Vorzeichen für {name} umkehren",
    pointsFor: "Punkte für {name}",
    invalidRows: "Diese Platzierungen sind so nicht möglich – bitte Gleichstände prüfen.",
    placeIn: "{name} platzieren: {row}, {rank}",
    hint_birds: "Summe der Punkte auf den ausgespielten Vogelkarten",
    hint_bonus: "Punkte aus allen Bonuskarten",
    hint_round_goals: "Für jede Runde die Platzierung auf der Zieltafel eintragen",
    hint_round_goals_casual: "1 Punkt je passendem Element, max. 5 pro Runde (insgesamt max. 20)",
    hint_eggs: "1 Punkt je Ei auf den Vogelkarten",
    hint_food: "1 Punkt je Futtermarker auf den Vogelkarten",
    hint_tucked: "1 Punkt je Karte, die unter einem Vogel steckt",
    hint_nectar: "Je Lebensraum: am meisten Nektar 5 Punkte, am zweitmeisten 2 Punkte",
    hint_hummingbirds: "Summe der Werte neben den 5 Markern – kann auch negativ sein",
    revealing: "Und der Sieg geht an …",
    sharedVictory: "Geteilter Sieg!",
    tieBreakerTitle: "Gleichstand! Wer hat mehr Futter übrig?",
    tieBreakerHint: "Trage für alle Punktgleichen die ungenutzten Futtermarker in ihrem Vorrat ein.",
    foodTokens: "Futtermarker",
    stillTied: "Weiterhin gleichauf – der Sieg wird geteilt.",
    noGameData: "Keine Spieldaten vorhanden.",
    startNewGame: "Neues Spiel starten",
    noHistoryYet: "Noch keine Partien gespeichert",
    noGroupHistory: "Für genau diese Gruppe gibt es noch keine Partien.",
    games: "Partien",
    home: "Startseite",
    // --- Quick sum ---
    quickSum: "Schnell-Summe",
    quickSumFor: "{category} für {name} zusammenzählen",
    qsAdd: "{n} hinzufügen",
    qsRemoveTerm: "{n} entfernen",
    qsSeed: "bisher",
    qsSeedHint: "Schon eingetragen – einfach weiterzählen oder antippen zum Entfernen.",
    qsEmpty: "Tippe den Wert jeder Karte an",
    qsTerms: "Eingegebene Werte",
    qsSum: "Summe",
    qsUndo: "Rückgängig",
    qsClear: "Leeren",
    qsCancel: "Abbrechen",
    qsApply: "Übernehmen",
    qsApplyNext: "Übernehmen & zu {name}",
    qsUnit_card_one: "1 Karte",
    qsUnit_card: "{n} Karten",
    qsUnit_bird_one: "1 Vogel",
    qsUnit_bird: "{n} Vögel",
    qsUnit_marker_one: "1 Marker",
    qsUnit_marker: "{n} Marker",
    qsUnit_round_one: "1 Runde",
    qsUnit_round: "{n} Runden",
    // --- Setup helper ---
    setupHelper: "Aufbau-Helfer",
    setupIntro: "Rundenziele für diese Partie ziehen. Bonuskarten bleiben geheim – die zieht jede Person selbst.",
    setupTable: "Welche Zielplättchen sind dabei?",
    setupSets: "Erweiterungen",
    set_core: "Grundspiel",
    set_european: "Europa",
    set_oceania: "Ozeanien",
    set_asia: "Asien",
    set_americas: "Mittel- und Südamerika",
    setupErr_notEnoughGoals: "Zu wenige Rundenziel-Plättchen. Asien hat keine Zielplättchen fürs normale Spiel – nimm das Grundspiel oder eine weitere Erweiterung dazu.",
    setupRedraw: "Runde {n} neu ziehen",
    setupFlip: "Runde {n} umdrehen",
    setupShuffle: "Neu mischen",
    setupDealing: "Wird gezogen …",
    setupDone: "Fertig – zur Wertung",
    setupGoalOfRound: "Runde {n}: {goal}",
};

const translations: Record<Language, Record<TranslationKey, string>> = { en, de };

export type { TranslationKey };

/** Translate a key, replacing `{placeholders}` with the given values. */
export const t = derived(language, $language => {
    return (key: TranslationKey, vars?: Record<string, string | number>) => {
        let val = translations[$language][key] ?? key;
        if (vars) for (const [k, v] of Object.entries(vars)) val = val.replaceAll(`{${k}}`, String(v));
        return val;
    };
});
