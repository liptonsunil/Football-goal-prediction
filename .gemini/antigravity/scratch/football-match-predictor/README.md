# KickPredict ⚽ - Football Match Prediction Web App

A clean, responsive football match prediction web application where users can vote and predict match outcomes (Home Win, Draw, Away Win), guess exact scores, track prediction accuracy, and test live match scenarios with an interactive match simulator.

![KickPredict Banner](https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80)

---

## 🌟 Key Features

1. **Interactive Match Voting & Prediction**:
   - 3-Way Prediction: **Home Win (1)**, **Draw (X)**, and **Away Win (2)**.
   - Real-time community voting percentage bars with fluid CSS animations.
   - Exact score prediction guesser (e.g. `2 - 1`) for bonus points (+30 pts).
   - Instant visual feedback, selection state, and confetti celebration on voting.

2. **Fixtures & Leagues**:
   - Rich fixtures across the UEFA Champions League, Premier League, La Liga, Serie A, and Bundesliga.
   - Status tracking: **Upcoming**, **LIVE (with live minutes & scores)**, and **Finished (FT)**.
   - League filter pills and live team search bar.

3. **Live Match Simulator**:
   - Click the **⚡ Simulate** button on any match to advance the game clock, score goals dynamically, and finish the match in real-time.
   - Automatically scores your predictions and awards points!

4. **"My Predictions" Slips**:
   - Track every vote and score guess you've cast.
   - Clear status indicators: **Pending**, **🟢 Correct Outcome (+10 pts)**, **🎯 Exact Score (+30 pts)**, or **🔴 Missed**.
   - Live accuracy rate (%) and total points tracker.

5. **Community Leaderboard**:
   - Hall of Fame table displaying top predictors, win streaks, prediction accuracy, and badges (*Oracle*, *Grandmaster*, *Sniper*).
   - Your guest profile updates dynamically as you make accurate predictions.

6. **Add Custom Match Fixtures**:
   - Built-in modal to add any custom football fixture with team names, emoji flags, tournament name, and kickoff venue.

7. **Audio & Visual Polish**:
   - Synthesized referee whistle, crowd cheer, and goal fanfare using the Web Audio API (zero external audio dependencies, toggleable on/off).
   - Confetti bursts on voting and winning predictions.
   - Responsive dark stadium theme crafted with Tailwind CSS and glassmorphism cards.

---

## 🚀 Quick Start Guide

### 1. Requirements
- Node.js (v18+)
- npm

### 2. Run the App
Open your terminal and navigate to the project directory:

```bash
cd /Users/lipton/.gemini/antigravity/scratch/football-match-predictor
npm start
```

Open your browser at:
👉 **[http://localhost:3005](http://localhost:3005)**

*(Note: The server automatically falls back to the next available port if port 3005 is occupied).*

---

## 📁 Project Structure

```
football-match-predictor/
├── package.json          # Express and CORS dependencies
├── server.js             # Node.js Express server & REST API
├── data/
│   ├── matches.json      # JSON database for fixtures & votes
│   └── leaderboard.json  # Community leaderboard data
├── public/
│   ├── index.html        # Main application page & navigation
│   ├── app.js            # Client-side voting, audio, and state logic
│   └── style.css         # Custom animations and styling
└── README.md             # Documentation
```

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/matches` | `GET` | List all match fixtures |
| `/api/matches/:id` | `GET` | Get single match details |
| `/api/matches/:id/vote` | `POST` | Cast or change a prediction vote |
| `/api/matches/:id/simulate` | `POST` | Advance match state (live minutes, goals, final score) |
| `/api/matches` | `POST` | Add a new custom match |
| `/api/matches/reset` | `POST` | Reset fixtures back to default demo state |
| `/api/leaderboard` | `GET` | Retrieve community predictor rankings |
