/* =====================================================================
   OSU Hockey stats — ACHA data connection (shared by every page)
   Data comes from HockeyTech's LeagueStat feed, the same source and
   public key achahockey.org uses for its own stats pages.
   ===================================================================== */
(function () {
  const TEAM_ID = '509';            // MD2 Oklahoma State University
  const TEAM_NICKNAME = 'Cowboys';
  const SITE = 'https://www.achahockey.org/stats';
  const FEED = 'https://lscluster.hockeytech.com/feed/index.php';
  const FEED_BASE = { feed: 'statviewfeed', key: 'e6867b36742a0c9d', client_code: 'acha', site_id: '2', league_id: '1', lang: 'en' };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const POSITIONS = { F: 'Forward', C: 'Center', LW: 'Left wing', RW: 'Right wing', D: 'Defense', G: 'Goalie' };
  const LABELS = {
    games_played: ['GP', 'Games played'], goals: ['G', 'Goals'], assists: ['A', 'Assists'], points: ['PTS', 'Points'],
    points_per_game: ['P/GP', 'Points per game'],
    power_play_goals: ['PPG', 'Power-play goals'], pp: ['PPG', 'Power-play goals'],
    short_handed_goals: ['SHG', 'Shorthanded goals'], sh: ['SHG', 'Shorthanded goals'],
    game_winning_goals: ['GWG', 'Game-winning goals'], gw: ['GWG', 'Game-winning goals'],
    penalty_minutes: ['PIM', 'Penalty minutes'],
    wins: ['W', 'Wins'], losses: ['L', 'Losses'], ot_losses: ['OTL', 'Overtime losses'],
    shootout_losses: ['SOL', 'Shootout losses'], shootout_loss: ['SOL', 'Shootout losses'],
    goals_against_average: ['GAA', 'Goals-against average'], gaa: ['GAA', 'Goals-against average'],
    savepct: ['SV%', 'Save percentage'], svpct: ['SV%', 'Save percentage'], save_percentage: ['SV%', 'Save percentage'],
    shutouts: ['SO', 'Shutouts'], shutout: ['SO', 'Shutouts'],
    saves: ['SVS', 'Saves'], shots_against: ['SA', 'Shots against'], goals_against: ['GA', 'Goals against'],
    minutes_played: ['MIN', 'Minutes played'], minutes: ['MIN', 'Minutes played'],
    decision: ['DEC', 'Goalie decision (W–L–OTL in totals)'],
  };

  // JSONP request — works from any website without a server
  function feed(query) {
    return new Promise((resolve, reject) => {
      const cb = 'osuStats_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const done = () => { clearTimeout(timer); window[cb] = () => {}; script.remove(); };
      const timer = setTimeout(() => { done(); reject(new Error('The ACHA stats server took too long to answer.')); }, 15000);
      window[cb] = data => { done(); resolve(data); };
      script.onerror = () => { done(); reject(new Error('Could not reach the ACHA stats server.')); };
      script.src = FEED + '?' + new URLSearchParams({ ...FEED_BASE, ...query, callback: cb });
      document.head.appendChild(script);
    });
  }

  const sections = x => (Array.isArray(x) ? x[0]?.sections : x?.sections) || [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shortTeam = n => String(n || '').replace(/^[MW]D\d\s+/, '').replace(/^University of\s+/, '').replace(/\s+University$/, '').trim();
  const shortSeason = n => String(n || '')
    .replace(/(Men's|Women's)\s+Divisions?\b/, '').replace(/(Men's|Women's)\s+/, '')
    .replace(/Division\s+(\d)/, 'D$1').replace(/^(\d{4})-\d{2}(\d{2})/, '$1–$2').replace(/\s+/g, ' ').trim();
  const fmtDate = iso => { const [, m, d] = String(iso).split('-'); return m ? `${MONTHS[+m - 1]} ${+d}` : esc(iso); };
  const fmtHeight = h => String(h || '').replace(/^(\d+)[-'](\d+)"?$/, `$1′$2″`);
  const label = key => LABELS[key] || null;

  // Formats a stat for display (hockey writes save % as .923)
  function fmtStat(key, v) {
    if (v === undefined || v === null || v === '') return '–';
    if (/^(savepct|svpct|save_percentage)$/.test(key)) {
      const n = parseFloat(v);
      return isNaN(n) ? esc(v) : n >= 1 ? '1.000' : n.toFixed(3).replace(/^0/, '');
    }
    return esc(v);
  }

  // Applies ?theme= ?accent= ?bg= from the page URL
  function applyView(params) {
    const root = document.documentElement;
    const theme = params.get('theme');
    if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
    const accent = params.get('accent') || '';
    if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) {
      root.style.setProperty('--accent', '#' + accent);
      root.style.setProperty('--accent-ink', '#' + accent);
    }
    if (params.get('bg') === 'transparent') document.body.classList.add('bg-transparent');
  }

  // Builds a query string that keeps the look settings when moving between pages
  const VIEW_PARAMS = ['theme', 'accent', 'bg', 'team', 'refresh'];
  function carry(params, extra = {}) {
    const q = new URLSearchParams();
    for (const k of VIEW_PARAMS) if (params.has(k)) q.set(k, params.get(k));
    for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '') q.set(k, v);
    const s = q.toString();
    return s ? '?' + s : '';
  }

  function setStatus(el, kind, loadedAt, msg) {
    const t = loadedAt ? loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
    el.innerHTML = {
      loading: `<span class="live-dot${loadedAt ? '' : ' stale'}"></span>${t ? `Live from ACHA stats · updated ${t} · checking…` : 'Connecting to ACHA stats…'}`,
      ok: `<span class="live-dot"></span>Live from ACHA stats · updated ${t}`,
      error: `<span class="live-dot stale"></span>${esc(msg)}${t ? ` Showing stats from ${t}.` : ''}`,
    }[kind];
  }

  const headshot = id => `https://assets.leaguestat.com/acha/240x240/${encodeURIComponent(id)}.jpg`;

  window.ACHA = {
    TEAM_ID, TEAM_NICKNAME, SITE, MONTHS, POSITIONS, LABELS,
    feed, sections, esc, shortTeam, shortSeason, fmtDate, fmtHeight, fmtStat, label, applyView, carry, setStatus, headshot,
  };
})();
