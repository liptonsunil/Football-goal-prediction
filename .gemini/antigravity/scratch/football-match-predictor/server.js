const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Helper to read JSON
function readJSON(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

// Helper to write JSON
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Backup initial matches for reset
const initialMatches = readJSON(MATCHES_FILE, []);

// GET all matches
app.get('/api/matches', (req, res) => {
  const matches = readJSON(MATCHES_FILE, []);
  res.json({ success: true, count: matches.length, data: matches });
});

// GET single match
app.get('/api/matches/:id', (req, res) => {
  const matches = readJSON(MATCHES_FILE, []);
  const match = matches.find(m => m.id === req.params.id);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }
  res.json({ success: true, data: match });
});

// POST vote for a match
app.post('/api/matches/:id/vote', (req, res) => {
  const { id } = req.params;
  const { prediction, previousPrediction, scorePrediction } = req.body;

  if (!['home', 'draw', 'away'].includes(prediction)) {
    return res.status(400).json({ success: false, message: 'Invalid prediction option. Must be "home", "draw", or "away".' });
  }

  const matches = readJSON(MATCHES_FILE, []);
  const matchIndex = matches.findIndex(m => m.id === id);

  if (matchIndex === -1) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }

  const match = matches[matchIndex];

  // If user is switching their vote, decrement previous vote
  if (previousPrediction && ['home', 'draw', 'away'].includes(previousPrediction) && previousPrediction !== prediction) {
    if (match.votes[previousPrediction] > 0) {
      match.votes[previousPrediction]--;
    }
  }

  // Increment selected vote (if not already counted)
  if (previousPrediction !== prediction) {
    match.votes[prediction] = (match.votes[prediction] || 0) + 1;
  }

  matches[matchIndex] = match;
  writeJSON(MATCHES_FILE, matches);

  res.json({
    success: true,
    message: `Vote recorded for ${prediction.toUpperCase()}!`,
    data: match
  });
});

// POST create custom match
app.post('/api/matches', (req, res) => {
  const { league, stage, venue, date, homeTeamName, awayTeamName, homeFlag, awayFlag } = req.body;

  if (!homeTeamName || !awayTeamName) {
    return res.status(400).json({ success: false, message: 'Home and Away team names are required.' });
  }

  const matches = readJSON(MATCHES_FILE, []);
  const newMatch = {
    id: `match-${Date.now()}`,
    league: league || 'Friendly Match',
    stage: stage || 'Regular Match',
    venue: venue || 'Neutral Stadium',
    date: date || 'Upcoming',
    status: 'upcoming',
    minute: null,
    featured: false,
    homeTeam: {
      name: homeTeamName.trim(),
      short: homeTeamName.trim().substring(0, 3).toUpperCase(),
      color: '#3b82f6',
      bg: '#1e293b',
      flag: homeFlag || '⚽️',
      form: ['W', 'D', 'W', 'W', 'D'],
      score: null
    },
    awayTeam: {
      name: awayTeamName.trim(),
      short: awayTeamName.trim().substring(0, 3).toUpperCase(),
      color: '#10b981',
      bg: '#0f172a',
      flag: awayFlag || '⚽️',
      form: ['D', 'W', 'L', 'W', 'W'],
      score: null
    },
    votes: {
      home: 1,
      draw: 0,
      away: 0
    },
    odds: {
      home: '2.10',
      draw: '3.40',
      away: '3.10'
    },
    stats: {
      h2h: { homeWins: 1, draws: 1, awayWins: 1 },
      possession: { home: 50, away: 50 },
      keyPlayer: { home: 'Star Striker', away: 'Playmaker' }
    }
  };

  matches.unshift(newMatch);
  writeJSON(MATCHES_FILE, matches);

  res.status(201).json({ success: true, message: 'Match created successfully!', data: newMatch });
});

// POST simulate match action (goal, start, finish)
app.post('/api/matches/:id/simulate', (req, res) => {
  const { id } = req.params;
  const matches = readJSON(MATCHES_FILE, []);
  const matchIndex = matches.findIndex(m => m.id === id);

  if (matchIndex === -1) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }

  const match = matches[matchIndex];

  if (match.status === 'upcoming') {
    match.status = 'live';
    match.minute = 15;
    match.homeTeam.score = 0;
    match.awayTeam.score = 0;
  } else if (match.status === 'live') {
    const min = (match.minute || 15) + 25;
    if (min >= 90) {
      match.status = 'finished';
      match.minute = 90;
      match.date = 'Full Time (FT)';
    } else {
      match.minute = min;
      // Randomly score a goal
      if (Math.random() > 0.4) {
        if (Math.random() > 0.5) {
          match.homeTeam.score = (match.homeTeam.score || 0) + 1;
        } else {
          match.awayTeam.score = (match.awayTeam.score || 0) + 1;
        }
      }
    }
  } else if (match.status === 'finished') {
    // Reset back to upcoming
    match.status = 'upcoming';
    match.minute = null;
    match.homeTeam.score = null;
    match.awayTeam.score = null;
  }

  matches[matchIndex] = match;
  writeJSON(MATCHES_FILE, matches);

  res.json({ success: true, data: match });
});

// GET leaderboard
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = readJSON(LEADERBOARD_FILE, []);
  res.json({ success: true, data: leaderboard });
});

// POST reset matches to original fixtures
app.post('/api/matches/reset', (req, res) => {
  writeJSON(MATCHES_FILE, initialMatches);
  res.json({ success: true, message: 'Database reset to default fixtures' });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`⚽ Football Match Predictor server running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3005;
startServer(DEFAULT_PORT);

