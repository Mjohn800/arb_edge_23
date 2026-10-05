// lib/teamMatch.js
// Strict team-name matcher, extracted verbatim from pages/api/odds.js so verifyArb.js and
// auditFeed.js use the SAME rule as the scan (no "Inter" ~ "Inter Miami" substring matching).

function squadTags(s) {
  const t = ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
  const tags = [];
  if (/ (women|womens|ladies|w|fem|feminino|femenino|femminile|frauen) /.test(t)) tags.push('w');
  if (/ u ?(17|18|19|20|21|23) /.test(t) || / (youth|juniors?) /.test(t)) tags.push('youth');
  if (/ (reserves?|res|ii|2|b|c|castilla|primavera|juvenil|amateur) /.test(t)) tags.push('res');
  return tags.sort().join(',');
}

// Whole-name equivalents that token rules can't derive (nickname / abbreviation -> full name).
// Add to this list whenever a real feed pair fails to merge; every entry is a deliberate,
// reviewable decision, unlike a loose substring rule.
const TEAM_ALIASES = {
  'man utd': 'manchester united', 'man united': 'manchester united', 'man u': 'manchester united',
  'man city': 'manchester city', 'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur',
  'wolves': 'wolverhampton wanderers', 'wolverhampton': 'wolverhampton wanderers',
  'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'newcastle': 'newcastle united',
  'west ham': 'west ham united', 'leeds': 'leeds united', 'brighton': 'brighton hove albion',
  'nottm forest': 'nottingham forest', 'nott m forest': 'nottingham forest',
  'inter': 'inter milan', 'internazionale': 'inter milan', 'ac milan': 'milan',
  'atletico madrid': 'atletico', 'atl madrid': 'atletico', 'athletic bilbao': 'athletic club',
  'bayern munchen': 'bayern munich', 'gladbach': 'borussia monchengladbach',
  'celta': 'celta vigo', 'leverkusen': 'bayer leverkusen', 'dortmund': 'borussia dortmund', 'sociedad': 'real sociedad',
  'betis': 'real betis', 'valladolid': 'real valladolid', 'alaves': 'deportivo alaves', 'rayo': 'rayo vallecano',
  'villarreal': 'villarreal', 'napoli': 'napoli', 'juventus': 'juventus', 'roma': 'as roma', 'lazio': 'lazio',
  'crystal palace': 'crystal palace', 'palace': 'crystal palace', 'villa': 'aston villa', 'fulham': 'fulham',
};
const TEAM_STOPWORDS = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'rcd', 'cd', 'ud', 'fk', 'sk', 'bk', 'ca', 'club', 'de', 'the']);
function teamTokens(name) {
  let t = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (TEAM_ALIASES[t]) t = TEAM_ALIASES[t];
  return t.split(' ').filter(w => w && !TEAM_STOPWORDS.has(w)).map(w => (w === 'utd' ? 'united' : w));
}

function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  if (squadTags(a) !== squadTags(b)) return false;
  // Strict word-level matching. The old "one name contains the other" rule is gone: it merged
  // "Inter" with "Inter Miami", "Newcastle" with "Newcastle Jets", "Leeds" with "Leeds Rhinos".
  // Now a shorter or longer spelling only matches through TEAM_ALIASES (a reviewed list), so a
  // real pair that fails to merge is fixed by adding one alias line.
  const ta = teamTokens(a), tb = teamTokens(b);
  if (!ta.length || ta.length !== tb.length) return false;
  // Each word pair: equal, or one is a >=3-letter prefix of the other ("Man" ~ "Manchester").
  return ta.every((w, i) => w === tb[i] || (Math.min(w.length, tb[i].length) >= 3 && (w.startsWith(tb[i]) || tb[i].startsWith(w))));
}

module.exports = { fuzzyMatch, teamTokens };
