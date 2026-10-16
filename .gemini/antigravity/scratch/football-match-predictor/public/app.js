// KickPredict - Football Match Prediction Web App
// Client-side Application Logic

(function () {
  'use strict';

  // State
  let matches = [];
  let leaderboard = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let activeTab = 'fixtures';
  let soundEnabled = localStorage.getItem('kickpredict_sound') !== 'false';
  let userPoints = parseInt(localStorage.getItem('kickpredict_points') || '120', 10);
  let userPredictions = JSON.parse(localStorage.getItem('kickpredict_user_predictions') || '{}');

  // DOM Elements
  const featuredContainer = document.getElementById('featured-match-container');
  const matchesGrid = document.getElementById('matches-grid');
  const userPredsList = document.getElementById('user-predictions-list');
  const leaderboardTable = document.getElementById('leaderboard-table-body');
  const headerPoints = document.getElementById('header-user-points');
  const badgePredCount = document.getElementById('badge-my-pred-count');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');

  // Audio Context for synthesized sound effects
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'vote') {
        // Triumphant chime
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.15, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.35);
        });
      } else if (type === 'whistle') {
        // Referee whistle simulation
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(2600, now);
        osc2.frequency.setValueAtTime(2850, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.setValueAtTime(0.25, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      } else if (type === 'goal') {
        // Goal fanfare
        const notes = [392, 523.25, 659.25, 783.99];
        const now = ctx.currentTime;
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
          gain.gain.setValueAtTime(0.12, now + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.09 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.45);
        });
      }
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  // Toast notification helper
  let toastTimer = null;
  function showToast(message, icon = '⚽') {
    if (toastTimer) clearTimeout(toastTimer);
    toastMsg.textContent = message;
    toastIcon.textContent = icon;
    toast.classList.remove('translate-y-[-20px]', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    toastTimer = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-[-20px]', 'opacity-0', 'pointer-events-none');
    }, 3200);
  }

  // Confetti trigger
  function triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.75 }
      });
    }
  }

  // Fetch matches from API with local fallback
  async function fetchMatches() {
    try {
      const res = await fetch('/api/matches');
      if (res.ok) {
        const json = await res.json();
        matches = json.data || [];
      } else {
        throw new Error('API returned ' + res.status);
      }
    } catch (err) {
      console.warn('Using local fallback matches cache', err);
      // Fallback if opened purely static or offline
      if (!matches.length) {
        matches = getFallbackMatches();
      }
    }
    renderApp();
  }

  // Fetch leaderboard
  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const json = await res.json();
        leaderboard = json.data || [];
      }
    } catch (err) {
      console.warn('Leaderboard fetch error', err);
    }
  }

  // Calculate vote percentages
  function calculatePercentages(votes) {
    const home = votes.home || 0;
    const draw = votes.draw || 0;
    const away = votes.away || 0;
    const total = home + draw + away;

    if (total === 0) {
      return { home: 33, draw: 34, away: 33, total: 0 };
    }

    const homePct = Math.round((home / total) * 100);
    const drawPct = Math.round((draw / total) * 100);
    const awayPct = Math.max(0, 100 - homePct - drawPct);

    return {
      home: homePct,
      draw: drawPct,
      away: awayPct,
      total
    };
  }

  // Handle Vote Submission
  async function castVote(matchId, prediction) {
    const currentPred = userPredictions[matchId]?.prediction;
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Check if match is already finished
    if (match.status === 'finished') {
      showToast('Voting is closed for completed matches', '🔒');
      return;
    }

    playSound('vote');
    triggerConfetti();

    // Preserve existing score guess if any
    const existingScore = userPredictions[matchId]?.score || { home: 2, away: 1 };

    userPredictions[matchId] = {
      prediction,
      score: existingScore,
      timestamp: Date.now()
    };
    localStorage.setItem('kickpredict_user_predictions', JSON.stringify(userPredictions));

    // Optimistically update UI
    if (currentPred && currentPred !== prediction && match.votes[currentPred] > 0) {
      match.votes[currentPred]--;
    }
    if (currentPred !== prediction) {
      match.votes[prediction] = (match.votes[prediction] || 0) + 1;
    }

    const predLabel = prediction === 'home' ? match.homeTeam.name : prediction === 'away' ? match.awayTeam.name : 'Draw (X)';
    showToast(`Prediction locked: ${predLabel}!`, '✅');

    renderApp();

    // Sync with backend API
    try {
      await fetch(`/api/matches/${matchId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prediction,
          previousPrediction: currentPred,
          scorePrediction: existingScore
        })
      });
    } catch (err) {
      console.warn('Backend vote sync failed, saved locally', err);
    }
  }

  // Handle Score Prediction Change
  function updateScorePrediction(matchId, homeScore, awayScore) {
    if (!userPredictions[matchId]) {
      // Default to home if user hasn't voted yet
      userPredictions[matchId] = {
        prediction: homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw',
        score: { home: homeScore, away: awayScore },
        timestamp: Date.now()
      };
    } else {
      userPredictions[matchId].score = { home: homeScore, away: awayScore };
    }
    localStorage.setItem('kickpredict_user_predictions', JSON.stringify(userPredictions));
    playSound('click');
    showToast(`Score predicted: ${homeScore} - ${awayScore}`, '🎯');
    renderApp();
  }

  // Simulate Match Progress
  async function simulateMatch(matchId) {
    playSound('whistle');
    try {
      const res = await fetch(`/api/matches/${matchId}/simulate`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        const updated = json.data;
        const idx = matches.findIndex(m => m.id === matchId);
        if (idx !== -1) {
          matches[idx] = updated;
        }

        if (updated.status === 'live') {
          showToast(`Match LIVE: ${updated.minute}' - ${updated.homeTeam.score}:${updated.awayTeam.score}`, '⚡');
        } else if (updated.status === 'finished') {
          playSound('goal');
          triggerConfetti();
          checkPredictionRewards(updated);
          showToast(`Full Time! Final: ${updated.homeTeam.score} - ${updated.awayTeam.score}`, '🏁');
        } else {
          showToast('Match reset to Upcoming', '🔄');
        }

        renderApp();
      }
    } catch (err) {
      console.warn('Simulate failed', err);
      // Local simulation fallback
      const m = matches.find(item => item.id === matchId);
      if (m) {
        if (m.status === 'upcoming') {
          m.status = 'live';
          m.minute = 25;
          m.homeTeam.score = 1;
          m.awayTeam.score = 0;
        } else if (m.status === 'live') {
          m.status = 'finished';
          m.minute = 90;
          m.homeTeam.score = 2;
          m.awayTeam.score = 1;
          checkPredictionRewards(m);
        } else {
          m.status = 'upcoming';
          m.minute = null;
          m.homeTeam.score = null;
          m.awayTeam.score = null;
        }
        renderApp();
      }
    }
  }

  // Calculate rewards for user predictions
  function checkPredictionRewards(match) {
    const predObj = userPredictions[match.id];
    if (!predObj) return;

    const actualOutcome = match.homeTeam.score > match.awayTeam.score ? 'home'
      : match.homeTeam.score < match.awayTeam.score ? 'away' : 'draw';

    let pointsAwarded = 0;
    if (predObj.prediction === actualOutcome) {
      pointsAwarded += 10;
      if (predObj.score && predObj.score.home === match.homeTeam.score && predObj.score.away === match.awayTeam.score) {
        pointsAwarded += 20; // 30 total for exact score
        showToast(`🎯 Bullseye! Exact score bonus +30 pts!`, '🏆');
      } else {
        showToast(`🎉 You predicted the winner! +10 pts`, '⭐');
      }
      userPoints += pointsAwarded;
      localStorage.setItem('kickpredict_points', userPoints.toString());
    }
  }

  // Render Spotlight Hero Match
  function renderFeaturedMatch(featured) {
    if (!featured) {
      featuredContainer.innerHTML = '';
      return;
    }

    const pcts = calculatePercentages(featured.votes);
    const userPred = userPredictions[featured.id]?.prediction;
    const userScore = userPredictions[featured.id]?.score || { home: 2, away: 1 };

    featuredContainer.innerHTML = `
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stadium-900 via-slate-900 to-stadium-950 border border-slate-700/60 p-6 sm:p-8 shadow-2xl">
        
        <!-- Background Stadium glow -->
        <div class="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Header line -->
        <div class="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-6">
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Featured Match of the Day
            </span>
            <span class="text-xs font-semibold text-slate-400">${featured.league} • ${featured.stage}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400 font-medium">📍 ${featured.venue}</span>
            <button onclick="window.KickPredict.simulate('${featured.id}')" title="Simulate Match" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1">
              <span>⚡</span> Simulate
            </button>
          </div>
        </div>

        <!-- Teams Head to Head Clash -->
        <div class="relative z-10 grid grid-cols-1 md:grid-cols-7 items-center gap-6 my-4">
          
          <!-- Home Team -->
          <div class="md:col-span-3 flex items-center justify-between md:justify-end gap-4 text-right">
            <div>
              <div class="flex items-center justify-end gap-1.5 mb-1">
                ${featured.homeTeam.form.map(f => `<span class="form-badge form-${f.toLowerCase()}">${f}</span>`).join('')}
              </div>
              <h2 class="text-2xl sm:text-3xl font-display font-black text-white">${featured.homeTeam.name}</h2>
              <p class="text-xs text-slate-400">Key: ${featured.stats?.keyPlayer?.home || 'Star Striker'}</p>
            </div>
            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-4xl shadow-xl flex-shrink-0">
              ${featured.homeTeam.flag}
            </div>
          </div>

          <!-- Score / VS Center -->
          <div class="md:col-span-1 text-center py-2 flex flex-col items-center justify-center">
            ${featured.status === 'live' ? `
              <span class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold live-pulse mb-1">LIVE ${featured.minute}'</span>
              <div class="text-3xl sm:text-4xl font-display font-black text-white tracking-wider">${featured.homeTeam.score} - ${featured.awayTeam.score}</div>
            ` : featured.status === 'finished' ? `
              <span class="px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[11px] font-bold mb-1">FINAL</span>
              <div class="text-3xl sm:text-4xl font-display font-black text-white tracking-wider">${featured.homeTeam.score} - ${featured.awayTeam.score}</div>
            ` : `
              <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 mb-1">${featured.date}</span>
              <div class="text-xl font-display font-black text-slate-500">VS</div>
            `}
          </div>

          <!-- Away Team -->
          <div class="md:col-span-3 flex items-center justify-between md:justify-start gap-4 text-left">
            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-4xl shadow-xl flex-shrink-0">
              ${featured.awayTeam.flag}
            </div>
            <div>
              <div class="flex items-center justify-start gap-1.5 mb-1">
                ${featured.awayTeam.form.map(f => `<span class="form-badge form-${f.toLowerCase()}">${f}</span>`).join('')}
              </div>
              <h2 class="text-2xl sm:text-3xl font-display font-black text-white">${featured.awayTeam.name}</h2>
              <p class="text-xs text-slate-400">Key: ${featured.stats?.keyPlayer?.away || 'Top Scorer'}</p>
            </div>
          </div>

        </div>

        <!-- Live Prediction Vote Distribution Bar -->
        <div class="relative z-10 mt-6 pt-6 border-t border-slate-800/80">
          <div class="flex items-center justify-between text-xs font-bold mb-2">
            <span class="text-emerald-400 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              ${featured.homeTeam.short} Win: ${pcts.home}% (${featured.votes.home.toLocaleString()} votes)
            </span>
            <span class="text-amber-400 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Draw: ${pcts.draw}% (${featured.votes.draw.toLocaleString()})
            </span>
            <span class="text-blue-400 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              ${featured.awayTeam.short} Win: ${pcts.away}% (${featured.votes.away.toLocaleString()} votes)
            </span>
          </div>

          <!-- Multi-segment progress bar -->
          <div class="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
            <div class="vote-pct-bar bg-gradient-to-r from-emerald-600 to-emerald-400" style="width: ${pcts.home}%"></div>
            <div class="vote-pct-bar bg-gradient-to-r from-amber-600 to-amber-400" style="width: ${pcts.draw}%"></div>
            <div class="vote-pct-bar bg-gradient-to-r from-blue-600 to-blue-400" style="width: ${pcts.away}%"></div>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
            <span>Community Consensus: <strong class="text-white">${pcts.home > pcts.away ? featured.homeTeam.name + ' favored' : pcts.away > pcts.home ? featured.awayTeam.name + ' favored' : 'Evenly Split'}</strong></span>
            <span>Total: <strong>${pcts.total.toLocaleString()} fan predictions</strong></span>
          </div>
        </div>

        <!-- 3-Way Vote Action Buttons -->
        <div class="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
          
          <button 
            onclick="window.KickPredict.vote('${featured.id}', 'home')"
            class="vote-btn ${userPred === 'home' ? 'selected' : ''} group p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border ${userPred === 'home' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700'} text-center transition-all flex flex-col items-center justify-center relative overflow-hidden"
          >
            ${userPred === 'home' ? '<span class="absolute top-2 right-2 text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">✓ Voted</span>' : ''}
            <span class="text-xs uppercase tracking-wider font-bold text-slate-400 group-hover:text-emerald-400 transition-colors">1 • Home Win</span>
            <span class="text-lg font-extrabold text-white mt-0.5">${featured.homeTeam.name}</span>
            <span class="text-xs font-semibold text-emerald-400 mt-1">Odds ${featured.odds?.home || '2.40'}</span>
          </button>

          <button 
            onclick="window.KickPredict.vote('${featured.id}', 'draw')"
            class="vote-btn ${userPred === 'draw' ? 'selected-draw' : ''} group p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border ${userPred === 'draw' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700'} text-center transition-all flex flex-col items-center justify-center relative overflow-hidden"
          >
            ${userPred === 'draw' ? '<span class="absolute top-2 right-2 text-xs font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">✓ Voted</span>' : ''}
            <span class="text-xs uppercase tracking-wider font-bold text-slate-400 group-hover:text-amber-400 transition-colors">X • Draw</span>
            <span class="text-lg font-extrabold text-white mt-0.5">Tie Match</span>
            <span class="text-xs font-semibold text-amber-400 mt-1">Odds ${featured.odds?.draw || '3.50'}</span>
          </button>

          <button 
            onclick="window.KickPredict.vote('${featured.id}', 'away')"
            class="vote-btn ${userPred === 'away' ? 'selected-away' : ''} group p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border ${userPred === 'away' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700'} text-center transition-all flex flex-col items-center justify-center relative overflow-hidden"
          >
            ${userPred === 'away' ? '<span class="absolute top-2 right-2 text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">✓ Voted</span>' : ''}
            <span class="text-xs uppercase tracking-wider font-bold text-slate-400 group-hover:text-blue-400 transition-colors">2 • Away Win</span>
            <span class="text-lg font-extrabold text-white mt-0.5">${featured.awayTeam.name}</span>
            <span class="text-xs font-semibold text-blue-400 mt-1">Odds ${featured.odds?.away || '2.65'}</span>
          </button>

        </div>

        <!-- Optional Exact Score Callout -->
        <div class="relative z-10 mt-4 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-amber-400 font-bold">🎯 Exact Score Prediction</span>
            <span class="text-slate-400 hidden sm:inline">(Bonus +20 pts on exact hit!)</span>
          </div>
          <div class="flex items-center gap-2">
            <input 
              type="number" 
              min="0" 
              max="15" 
              id="hero-score-home" 
              value="${userScore.home}" 
              class="w-10 h-8 text-center bg-slate-900 border border-slate-700 rounded-lg text-white font-bold" 
            />
            <span class="font-bold text-slate-500">-</span>
            <input 
              type="number" 
              min="0" 
              max="15" 
              id="hero-score-away" 
              value="${userScore.away}" 
              class="w-10 h-8 text-center bg-slate-900 border border-slate-700 rounded-lg text-white font-bold" 
            />
            <button 
              onclick="window.KickPredict.saveHeroScore('${featured.id}')"
              class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors ml-1"
            >
              Set Score
            </button>
          </div>
        </div>

      </div>
    `;
  }

  // Render Grid of Match Cards
  function renderMatchesGrid(filteredList) {
    if (!filteredList.length) {
      matchesGrid.innerHTML = `
        <div class="col-span-full py-16 text-center bg-stadium-900/40 rounded-3xl border border-dashed border-slate-800">
          <div class="text-4xl mb-3">🔍</div>
          <h3 class="text-lg font-bold text-white">No matches found</h3>
          <p class="text-xs text-slate-400 mt-1">Try selecting another league filter or clear your search term.</p>
        </div>
      `;
      return;
    }

    matchesGrid.innerHTML = filteredList.map(match => {
      const pcts = calculatePercentages(match.votes);
      const userPred = userPredictions[match.id]?.prediction;
      const userScore = userPredictions[match.id]?.score || { home: 1, away: 0 };
      const isFinished = match.status === 'finished';
      const isLive = match.status === 'live';

      return `
        <div class="match-card bg-stadium-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden backdrop-blur-sm">
          
          <!-- Match Header -->
          <div class="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80 text-xs">
            <div class="flex items-center gap-1.5 font-bold text-slate-300">
              <span class="text-emerald-400">⚽</span>
              <span class="truncate max-w-[150px]">${match.league}</span>
            </div>
            
            ${isLive ? `
              <span class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold live-pulse flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                LIVE ${match.minute}'
              </span>
            ` : isFinished ? `
              <span class="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                FT ${match.homeTeam.score} - ${match.awayTeam.score}
              </span>
            ` : `
              <span class="text-slate-400 font-medium">
                ${match.date}
              </span>
            `}
          </div>

          <!-- Teams & Form Display -->
          <div class="py-4 space-y-3">
            
            <!-- Home team row -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xl flex-shrink-0">
                  ${match.homeTeam.flag}
                </div>
                <div>
                  <div class="font-bold text-white text-sm hover:text-emerald-400 transition-colors">${match.homeTeam.name}</div>
                  <div class="flex items-center gap-1 mt-0.5">
                    ${match.homeTeam.form.map(f => `<span class="form-badge form-${f.toLowerCase()}">${f}</span>`).join('')}
                  </div>
                </div>
              </div>
              <div class="text-right">
                ${isLive || isFinished ? `
                  <span class="text-2xl font-black font-display ${match.homeTeam.score > match.awayTeam.score ? 'text-emerald-400' : 'text-white'}">${match.homeTeam.score}</span>
                ` : `
                  <span class="text-xs font-semibold text-slate-400">${match.odds?.home ? '@' + match.odds.home : ''}</span>
                `}
              </div>
            </div>

            <!-- Away team row -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xl flex-shrink-0">
                  ${match.awayTeam.flag}
                </div>
                <div>
                  <div class="font-bold text-white text-sm hover:text-blue-400 transition-colors">${match.awayTeam.name}</div>
                  <div class="flex items-center gap-1 mt-0.5">
                    ${match.awayTeam.form.map(f => `<span class="form-badge form-${f.toLowerCase()}">${f}</span>`).join('')}
                  </div>
                </div>
              </div>
              <div class="text-right">
                ${isLive || isFinished ? `
                  <span class="text-2xl font-black font-display ${match.awayTeam.score > match.homeTeam.score ? 'text-blue-400' : 'text-white'}">${match.awayTeam.score}</span>
                ` : `
                  <span class="text-xs font-semibold text-slate-400">${match.odds?.away ? '@' + match.odds.away : ''}</span>
                `}
              </div>
            </div>

          </div>

          <!-- Vote Distribution Bar -->
          <div class="pt-2">
            <div class="flex items-center justify-between text-[11px] font-bold mb-1.5 text-slate-400">
              <span class="text-emerald-400">${match.homeTeam.short} ${pcts.home}%</span>
              <span class="text-amber-400">Draw ${pcts.draw}%</span>
              <span class="text-blue-400">${match.awayTeam.short} ${pcts.away}%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
              <div class="vote-pct-bar bg-emerald-500" style="width: ${pcts.home}%"></div>
              <div class="vote-pct-bar bg-amber-500" style="width: ${pcts.draw}%"></div>
              <div class="vote-pct-bar bg-blue-500" style="width: ${pcts.away}%"></div>
            </div>
          </div>

          <!-- 3-Way Vote Button Group -->
          <div class="grid grid-cols-3 gap-2 mt-4">
            
            <button 
              onclick="window.KickPredict.vote('${match.id}', 'home')"
              class="vote-btn ${userPred === 'home' ? 'selected' : ''} py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 border ${userPred === 'home' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700/80'} text-center transition-all"
            >
              <div class="text-[10px] uppercase font-bold text-slate-400">1</div>
              <div class="text-xs font-bold text-white truncate px-1">${match.homeTeam.short}</div>
              <div class="text-[10px] font-semibold text-emerald-400">${pcts.home}%</div>
            </button>

            <button 
              onclick="window.KickPredict.vote('${match.id}', 'draw')"
              class="vote-btn ${userPred === 'draw' ? 'selected-draw' : ''} py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 border ${userPred === 'draw' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700/80'} text-center transition-all"
            >
              <div class="text-[10px] uppercase font-bold text-slate-400">X</div>
              <div class="text-xs font-bold text-white truncate px-1">Draw</div>
              <div class="text-[10px] font-semibold text-amber-400">${pcts.draw}%</div>
            </button>

            <button 
              onclick="window.KickPredict.vote('${match.id}', 'away')"
              class="vote-btn ${userPred === 'away' ? 'selected-away' : ''} py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 border ${userPred === 'away' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700/80'} text-center transition-all"
            >
              <div class="text-[10px] uppercase font-bold text-slate-400">2</div>
              <div class="text-xs font-bold text-white truncate px-1">${match.awayTeam.short}</div>
              <div class="text-[10px] font-semibold text-blue-400">${pcts.away}%</div>
            </button>

          </div>

          <!-- Bottom bar: Total votes & Simulate action button -->
          <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>🗳️ ${pcts.total.toLocaleString()} votes</span>
            <div class="flex items-center gap-1.5">
              <button 
                onclick="window.KickPredict.openDetails('${match.id}')"
                class="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium"
              >
                H2H Stats
              </button>
              <button 
                onclick="window.KickPredict.simulate('${match.id}')"
                title="Simulate Match Progress"
                class="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1"
              >
                <span>⚡</span>
              </button>
            </div>
          </div>

        </div>
      `;
    }).join('');
  }

  // Render User Predictions Tab
  function renderUserPredictions() {
    const predKeys = Object.keys(userPredictions);
    badgePredCount.textContent = predKeys.length;
    badgePredCount.classList.toggle('hidden', predKeys.length === 0);

    const statTotal = document.getElementById('stat-total-preds');
    const statCorrect = document.getElementById('stat-correct-preds');
    const statAccuracy = document.getElementById('stat-accuracy');
    const statPoints = document.getElementById('stat-points');

    let correctCount = 0;
    let evaluatedCount = 0;

    const listHtml = predKeys.map(matchId => {
      const predObj = userPredictions[matchId];
      const match = matches.find(m => m.id === matchId);
      if (!match) return '';

      const isFinished = match.status === 'finished';
      let outcomeStatus = 'Pending';
      let statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';

      if (isFinished) {
        evaluatedCount++;
        const actualWinner = match.homeTeam.score > match.awayTeam.score ? 'home'
          : match.homeTeam.score < match.awayTeam.score ? 'away' : 'draw';
        
        if (predObj.prediction === actualWinner) {
          correctCount++;
          const isExactScore = predObj.score && predObj.score.home === match.homeTeam.score && predObj.score.away === match.awayTeam.score;
          outcomeStatus = isExactScore ? '🎯 Exact Score (+30 pts)' : '🟢 Correct (+10 pts)';
          statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
        } else {
          outcomeStatus = '🔴 Missed (0 pts)';
          statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
        }
      }

      const predictedTeamName = predObj.prediction === 'home' ? match.homeTeam.name
        : predObj.prediction === 'away' ? match.awayTeam.name : 'Draw (X)';

      return `
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="text-2xl">${predObj.prediction === 'home' ? match.homeTeam.flag : predObj.prediction === 'away' ? match.awayTeam.flag : '⚖️'}</div>
            <div>
              <div class="text-xs text-slate-400">${match.league} • ${match.venue}</div>
              <div class="font-bold text-white text-sm sm:text-base">${match.homeTeam.name} vs ${match.awayTeam.name}</div>
              <div class="text-xs text-slate-300 mt-0.5">
                Your pick: <strong class="text-emerald-400">${predictedTeamName}</strong>
                ${predObj.score ? ` • Guess: <strong class="text-white">${predObj.score.home} - ${predObj.score.away}</strong>` : ''}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 self-end sm:self-center">
            <span class="px-3 py-1 rounded-full text-xs font-bold border ${statusColor}">
              ${outcomeStatus}
            </span>
            ${!isFinished ? `
              <button 
                onclick="window.KickPredict.simulate('${match.id}')"
                class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl border border-slate-700 transition-colors"
              >
                Simulate Result
              </button>
            ` : `
              <span class="text-xs text-slate-400 font-semibold">Score: ${match.homeTeam.score} - ${match.awayTeam.score}</span>
            `}
          </div>
        </div>
      `;
    }).filter(Boolean).join('');

    if (statTotal) statTotal.textContent = predKeys.length;
    if (statCorrect) statCorrect.textContent = correctCount;
    if (statAccuracy) {
      const rate = evaluatedCount > 0 ? Math.round((correctCount / evaluatedCount) * 100) : 0;
      statAccuracy.textContent = `${rate}%`;
    }
    if (statPoints) statPoints.textContent = userPoints;
    if (headerPoints) headerPoints.textContent = `${userPoints} pts`;

    userPredsList.innerHTML = listHtml || `
      <div class="text-center py-12 text-slate-500">
        <div class="text-4xl mb-2">🎯</div>
        <p class="font-bold text-sm text-slate-400">No predictions yet</p>
        <p class="text-xs mt-1">Browse the matches tab and vote on who will win to build your prediction slip!</p>
      </div>
    `;
  }

  // Render Leaderboard
  function renderLeaderboard() {
    if (!leaderboard.length) return;

    // Update guest user score in leaderboard
    const updatedBoard = leaderboard.map(user => {
      if (user.isCurrentUser) {
        return {
          ...user,
          points: userPoints
        };
      }
      return user;
    }).sort((a, b) => b.points - a.points);

    leaderboardTable.innerHTML = updatedBoard.map((u, idx) => {
      const isCurrentUser = !!u.isCurrentUser;
      const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

      return `
        <tr class="${isCurrentUser ? 'bg-emerald-500/10 font-bold border-l-4 border-l-emerald-500' : 'hover:bg-slate-800/40'} transition-colors">
          <td class="py-4 px-6 text-sm font-extrabold text-white">${rankBadge}</td>
          <td class="py-4 px-6">
            <div class="flex items-center gap-2.5">
              <span class="text-xl">${u.avatar}</span>
              <div>
                <div class="text-white text-sm flex items-center gap-1.5">
                  <span>${u.user}</span>
                  ${isCurrentUser ? '<span class="text-[10px] px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-black rounded-full">YOU</span>' : ''}
                </div>
                <div class="text-[10px] text-amber-400 font-semibold">${u.badge}</div>
              </div>
            </div>
          </td>
          <td class="py-4 px-6 text-emerald-400 font-bold">${u.accuracy}</td>
          <td class="py-4 px-6 text-slate-300">${u.correct} / ${u.total}</td>
          <td class="py-4 px-6 text-slate-300">${u.streak}</td>
          <td class="py-4 px-6 text-right font-display font-extrabold text-white text-base">${u.points}</td>
        </tr>
      `;
    }).join('');
  }

  // Render H2H and Stats Modal
  function openMatchDetails(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const modal = document.getElementById('modal-match-details');
    const content = document.getElementById('match-details-content');

    const h2h = match.stats?.h2h || { homeWins: 3, draws: 2, awayWins: 3 };
    const poss = match.stats?.possession || { home: 50, away: 50 };

    content.innerHTML = `
      <div class="text-center mb-6">
        <span class="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">${match.league}</span>
        <h3 class="text-xl font-bold font-display text-white mt-3">${match.homeTeam.name} vs ${match.awayTeam.name}</h3>
        <p class="text-xs text-slate-400 mt-1">📍 ${match.venue} • ${match.stage}</p>
      </div>

      <!-- Head to Head Record -->
      <div class="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 mb-4">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">Head-to-Head History</div>
        <div class="grid grid-cols-3 text-center">
          <div>
            <div class="text-2xl font-black text-emerald-400">${h2h.homeWins}</div>
            <div class="text-[10px] text-slate-400 uppercase font-semibold">${match.homeTeam.short} Wins</div>
          </div>
          <div>
            <div class="text-2xl font-black text-amber-400">${h2h.draws}</div>
            <div class="text-[10px] text-slate-400 uppercase font-semibold">Draws</div>
          </div>
          <div>
            <div class="text-2xl font-black text-blue-400">${h2h.awayWins}</div>
            <div class="text-[10px] text-slate-400 uppercase font-semibold">${match.awayTeam.short} Wins</div>
          </div>
        </div>
      </div>

      <!-- Key Player Matchup -->
      <div class="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 mb-6">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Key Player Matchup</div>
        <div class="flex items-center justify-between text-xs">
          <div class="text-left">
            <span class="text-slate-400 block text-[10px]">${match.homeTeam.name}</span>
            <strong class="text-white">${match.stats?.keyPlayer?.home || 'Striker'}</strong>
          </div>
          <span class="text-slate-500 font-bold">VS</span>
          <div class="text-right">
            <span class="text-slate-400 block text-[10px]">${match.awayTeam.name}</span>
            <strong class="text-white">${match.stats?.keyPlayer?.away || 'Striker'}</strong>
          </div>
        </div>
      </div>

      <div class="flex justify-center gap-3">
        <button 
          onclick="window.KickPredict.vote('${match.id}', 'home'); document.getElementById('modal-match-details').classList.add('hidden');"
          class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors"
        >
          Vote ${match.homeTeam.short}
        </button>
        <button 
          onclick="window.KickPredict.vote('${match.id}', 'draw'); document.getElementById('modal-match-details').classList.add('hidden');"
          class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-colors"
        >
          Vote Draw
        </button>
        <button 
          onclick="window.KickPredict.vote('${match.id}', 'away'); document.getElementById('modal-match-details').classList.add('hidden');"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors"
        >
          Vote ${match.awayTeam.short}
        </button>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  // Filter and search matcher
  function getFilteredMatches() {
    return matches.filter(m => {
      // League or Status filter
      if (activeFilter === 'live') {
        if (m.status !== 'live') return false;
      } else if (activeFilter !== 'all') {
        if (m.league !== activeFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const homeName = m.homeTeam?.name?.toLowerCase() || '';
        const awayName = m.awayTeam?.name?.toLowerCase() || '';
        const leagueName = m.league?.toLowerCase() || '';
        if (!homeName.includes(q) && !awayName.includes(q) && !leagueName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }

  // Master Render
  function renderApp() {
    const filtered = getFilteredMatches();
    const featured = matches.find(m => m.featured) || matches[0];

    // If search or filter is active, we don't spotlight or we spotlight filtered match
    if (activeFilter === 'all' && !searchQuery.trim()) {
      renderFeaturedMatch(featured);
      // Render remainder in grid
      const gridMatches = matches.filter(m => m.id !== featured?.id);
      renderMatchesGrid(gridMatches);
    } else {
      featuredContainer.innerHTML = '';
      renderMatchesGrid(filtered);
    }

    renderUserPredictions();
    renderLeaderboard();
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Navigation tab switching
    const navFixtures = document.getElementById('nav-fixtures');
    const navMyPreds = document.getElementById('nav-my-predictions');
    const navLeaderboard = document.getElementById('nav-leaderboard');

    const viewFixtures = document.getElementById('view-fixtures');
    const viewMyPreds = document.getElementById('view-my-predictions');
    const viewLeaderboard = document.getElementById('view-leaderboard');

    function switchTab(tab) {
      activeTab = tab;
      playSound('click');

      [navFixtures, navMyPreds, navLeaderboard].forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-slate-400');
      });
      [viewFixtures, viewMyPreds, viewLeaderboard].forEach(v => v.classList.add('hidden'));

      if (tab === 'fixtures') {
        navFixtures.classList.add('active');
        navFixtures.classList.remove('text-slate-400');
        viewFixtures.classList.remove('hidden');
      } else if (tab === 'my-predictions') {
        navMyPreds.classList.add('active');
        navMyPreds.classList.remove('text-slate-400');
        viewMyPreds.classList.remove('hidden');
        renderUserPredictions();
      } else if (tab === 'leaderboard') {
        navLeaderboard.classList.add('active');
        navLeaderboard.classList.remove('text-slate-400');
        viewLeaderboard.classList.remove('hidden');
        renderLeaderboard();
      }
    }

    navFixtures.addEventListener('click', () => switchTab('fixtures'));
    navMyPreds.addEventListener('click', () => switchTab('my-predictions'));
    navLeaderboard.addEventListener('click', () => switchTab('leaderboard'));

    // League filter buttons
    document.querySelectorAll('.league-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.league-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderApp();
      });
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderApp();
      });
    }

    // Reset Data button
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        playSound('click');
        try {
          await fetch('/api/matches/reset', { method: 'POST' });
        } catch (e) {
          console.warn('Reset endpoint unavailable', e);
        }
        showToast('Fixtures reset to default', '🔄');
        fetchMatches();
      });
    }

    // Sound toggle button
    const btnSound = document.getElementById('btn-sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    if (btnSound) {
      soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
      btnSound.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('kickpredict_sound', soundEnabled.toString());
        soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
        if (soundEnabled) playSound('click');
        showToast(soundEnabled ? 'Sound enabled' : 'Sound muted', soundEnabled ? '🔊' : '🔇');
      });
    }

    // Modals: Add Custom Match
    const modalCreate = document.getElementById('modal-create-match');
    const btnOpenCreate = document.getElementById('btn-open-create-modal');
    const btnCloseCreate = document.getElementById('btn-close-create-modal');
    const btnCancelCreate = document.getElementById('btn-cancel-create');
    const formCreate = document.getElementById('form-create-match');

    function openCreateModal() {
      playSound('click');
      modalCreate.classList.remove('hidden');
    }
    function closeCreateModal() {
      modalCreate.classList.add('hidden');
    }

    if (btnOpenCreate) btnOpenCreate.addEventListener('click', openCreateModal);
    if (btnCloseCreate) btnCloseCreate.addEventListener('click', closeCreateModal);
    if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeCreateModal);

    if (formCreate) {
      formCreate.addEventListener('submit', async (e) => {
        e.preventDefault();
        const homeTeamName = document.getElementById('input-home-team').value;
        const awayTeamName = document.getElementById('input-away-team').value;
        const homeFlag = document.getElementById('input-home-flag').value;
        const awayFlag = document.getElementById('input-away-flag').value;
        const league = document.getElementById('input-league').value;
        const venue = document.getElementById('input-venue').value;
        const date = document.getElementById('input-date').value;

        try {
          const res = await fetch('/api/matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              homeTeamName,
              awayTeamName,
              homeFlag,
              awayFlag,
              league,
              venue,
              date
            })
          });

          if (res.ok) {
            const json = await res.json();
            matches.unshift(json.data);
          } else {
            throw new Error('Failed to create');
          }
        } catch (err) {
          // Local fallback creation
          const newMatch = {
            id: `match-${Date.now()}`,
            league: league || 'Friendly Match',
            stage: 'Regular Match',
            venue: venue || 'Neutral Stadium',
            date: date || 'Upcoming',
            status: 'upcoming',
            minute: null,
            featured: false,
            homeTeam: {
              name: homeTeamName.trim(),
              short: homeTeamName.trim().substring(0, 3).toUpperCase(),
              flag: homeFlag || '⚽️',
              form: ['W', 'D', 'W', 'W', 'D'],
              score: null
            },
            awayTeam: {
              name: awayTeamName.trim(),
              short: awayTeamName.trim().substring(0, 3).toUpperCase(),
              flag: awayFlag || '⚽️',
              form: ['D', 'W', 'L', 'W', 'W'],
              score: null
            },
            votes: { home: 1, draw: 0, away: 0 },
            odds: { home: '2.10', draw: '3.40', away: '3.10' }
          };
          matches.unshift(newMatch);
        }

        formCreate.reset();
        closeCreateModal();
        playSound('vote');
        triggerConfetti();
        showToast('New match published! Fans can now vote!', '🎉');
        renderApp();
      });
    }

    // Modal Details Close
    const btnCloseDetails = document.getElementById('btn-close-details-modal');
    const modalDetails = document.getElementById('modal-match-details');
    if (btnCloseDetails) {
      btnCloseDetails.addEventListener('click', () => modalDetails.classList.add('hidden'));
    }
  }

  // Fallback initial dataset if server is not reachable
  function getFallbackMatches() {
    return [
      {
        id: "match-1",
        league: "UEFA Champions League",
        stage: "Semi-Final",
        venue: "Santiago Bernabéu",
        date: "Tonight • 20:00 GMT",
        status: "upcoming",
        featured: true,
        homeTeam: { name: "Real Madrid", short: "RMA", flag: "🇪🇸", form: ["W","W","D","W","W"], score: null },
        awayTeam: { name: "Manchester City", short: "MCI", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", form: ["W","W","W","D","W"], score: null },
        votes: { home: 2840, draw: 920, away: 3150 },
        odds: { home: "2.40", draw: "3.50", away: "2.65" },
        stats: { h2h: { homeWins: 4, draws: 4, awayWins: 5 } }
      },
      {
        id: "match-2",
        league: "Premier League",
        stage: "Matchday 31",
        venue: "Emirates Stadium",
        date: "LIVE NOW",
        status: "live",
        minute: 68,
        featured: false,
        homeTeam: { name: "Arsenal", short: "ARS", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", form: ["W","W","W","W","L"], score: 2 },
        awayTeam: { name: "Chelsea", short: "CHE", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", form: ["D","W","L","W","D"], score: 1 },
        votes: { home: 4120, draw: 780, away: 1250 },
        odds: { home: "1.80", draw: "3.75", away: "4.20" }
      }
    ];
  }

  // Global API exposed for inline HTML onclick handlers
  window.KickPredict = {
    vote: castVote,
    simulate: simulateMatch,
    openDetails: openMatchDetails,
    saveHeroScore: (matchId) => {
      const h = parseInt(document.getElementById('hero-score-home').value, 10) || 0;
      const a = parseInt(document.getElementById('hero-score-away').value, 10) || 0;
      updateScorePrediction(matchId, h, a);
    }
  };

  // Initialization
  async function init() {
    setupEventListeners();
    await fetchLeaderboard();
    await fetchMatches();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
