import dayjs from "dayjs";

const WEEKDAYS = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
};

const DURATION_HINTS = [
  { re: /\b(rapide|vite fait|quick|5\s?min)\b/i, minutes: 10, complexity: 1 },
  { re: /\b(appeler|téléphoner|appel|mail|e-?mail|message|envoyer|répondre|contacter|rappeler)\b/i, minutes: 15, complexity: 1 },
  { re: /\b(acheter|commander|réserver|payer|imprimer|signer)\b/i, minutes: 20, complexity: 2 },
  { re: /\b(rédiger|écrire|relire|corriger|mettre à jour|update)\b/i, minutes: 60, complexity: 3 },
  { re: /\b(réunion|meeting|rendez-?vous|rdv)\b/i, minutes: 60, complexity: 2 },
  { re: /\b(préparer|préparer|réviser|analyser|étudier|rechercher|comparer)\b/i, minutes: 120, complexity: 4 },
  { re: /\b(développer|coder|programmer|créer|concevoir|designer|monter|installer)\b/i, minutes: 180, complexity: 4 },
  { re: /\b(long|grosse?s?|complexe|gros projet|refactor)\b/i, minutes: 240, complexity: 5 },
];

function estimate(text) {
  let minutes = 45;
  let complexity = 3;
  let matched = false;
  for (const hint of DURATION_HINTS) {
    if (hint.re.test(text)) {
      minutes = hint.minutes;
      complexity = hint.complexity;
      matched = true;
      break;
    }
  }
  if (/\b(rapide|vite fait)\b/i.test(text)) { minutes = Math.min(minutes, 10); complexity = 1; }
  if (/\b(longue?|grosse?s?|complexe)\b/i.test(text)) { minutes = Math.max(minutes, 180); complexity = 5; }
  const hours = /\b(\d+)\s?(h|heures?)\b/i.exec(text);
  if (hours) { minutes = Number(hours[1]) * 60; matched = true; }
  const mins = /\b(\d+)\s?(min|minutes)\b/i.exec(text);
  if (mins) { minutes = Number(mins[1]); matched = true; }
  if (!matched) complexity = minutes <= 20 ? 2 : minutes <= 60 ? 3 : 4;
  return { estimatedMinutes: minutes, complexity };
}

function extractPriority(text) {
  if (/\b(urgent|urgemment|asap|aujourd'hui absolu|priorité maximale|critique)\b/i.test(text)) return 3;
  if (/\b(important|priorité haute|haute priorité)\b/i.test(text)) return 2;
  if (/\b(pas urgent|pas pressé|priorité basse|quand tu peux|un de ces jours)\b/i.test(text)) return 1;
  return 2;
}

function extractDeadline(text, now) {
  const low = text.toLowerCase();

  const dmy = /\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/.exec(low);
  const longDate = /\b(\d{1,2})(?:er)?\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/.exec(low);
  const inDays = /\bdans\s+(\d+)\s+(jour|jours|semaine|semaines)\b/.exec(low);
  const weekday = /\b(?:avant|d'ici|pour)\s+(?:le\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.exec(low);
  const bareWeekday = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(?:prochain|matin|soir)?\b/.exec(low);

  if (/\b(aujourd'hui|ce jour)\b/.test(low)) return now.endOf("day");
  if (/\bce soir\b/.test(low)) return now.hour(21).minute(0).second(0).millisecond(0);
  if (/\bdemain\b/.test(low)) return now.add(1, "day").hour(18).minute(0).second(0).millisecond(0);
  if (/\baprès-?demain\b/.test(low)) return now.add(2, "day").hour(18).minute(0).second(0).millisecond(0);
  if (/\b(fin de semaine|fin de la semaine)\b/.test(low)) return now.endOf("week").hour(18).minute(0);
  if (/\b(cette semaine)\b/.test(low)) return now.endOf("week").hour(18).minute(0);
  if (/\b(semaine prochaine)\b/.test(low)) return now.add(1, "week").endOf("week").hour(18).minute(0);
  if (/\b(cette semaine)\b/.test(low)) return now.endOf("week").hour(18).minute(0);
  if (/\b(ce mois|fin du mois)\b/.test(low)) return now.endOf("month").hour(18).minute(0);

  if (inDays) {
    const n = Number(inDays[1]);
    const unit = inDays[2].startsWith("semaine") ? "week" : "day";
    return now.add(n, unit).hour(18).minute(0).second(0).millisecond(0);
  }
  if (longDate) {
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const m = months.indexOf(longDate[2]);
    if (m >= 0) {
      let year = now.year();
      if (m < now.month() || (m === now.month() && Number(longDate[1]) < now.date())) year += 1;
      return dayjs(new Date(year, m, Number(longDate[1]), 18, 0));
    }
  }
  if (dmy) {
    let year = dmy[3] ? Number(dmy[3]) : now.year();
    if (year < 100) year += 2000;
    const d = dayjs(new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), 18, 0));
    if (d.isValid()) return d;
  }
  const wd = weekday || bareWeekday;
  if (wd) {
    const target = WEEKDAYS[wd[1]];
    let diff = (target - now.day() + 7) % 7;
    if (diff === 0) diff = 7;
    if (bareWeekday && !weekday && diff === 0) diff = 7;
    return now.add(diff, "day").hour(18).minute(0).second(0).millisecond(0);
  }
  return null;
}

function extractProject(text) {
  const tag = /#([\w-]+)/.exec(text);
  if (tag) return { name: tag[1], marker: tag[0] };
  return null;
}

function cleanTitle(text, markers) {
  let title = text;
  for (const m of markers) {
    if (!m) continue;
    title = title.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  title = title
    .replace(/\b(il faut (que je|que tu)?|je dois|je veux|pense à|penser à|ne pas oublier (de|:)|think about)\b/gi, " ")
    .replace(/\b(urgent|urgemment|asap|important(e)?|pas urgent|pas pressé|priorité (haute|basse|maximale)|haute priorité|quand tu peux|un de ces jours|rapide|vite fait)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s\-:,.]+|[\s\-:,.]+$/g, "");
  if (!title) title = text.trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function analyze(text, { projectNames = [], now } = {}) {
  const ref = now ? dayjs(now) : dayjs();
  const cleaned = text.trim();
  if (!cleaned) throw new Error("Phrase vide");

  const projectHit = extractProject(cleaned);
  let project = null;
  let projectMarker = projectHit ? projectHit.marker : null;
  if (projectHit) {
    project = projectHit.name;
  } else {
    const lower = cleaned.toLowerCase();
    project = projectNames.find((name) => lower.includes(name.toLowerCase())) || null;
    if (project) projectMarker = project;
  }

  const deadline = extractDeadline(cleaned, ref);
  const priority = extractPriority(cleaned);
  const { estimatedMinutes, complexity } = estimate(cleaned);

  const markers = [projectMarker];
  if (deadline) {
    markers.push(
      "aujourd'hui", "ce soir", "demain", "après-demain", "apres-demain",
      "cette semaine", "semaine prochaine", "fin de semaine", "fin de la semaine", "fin du mois", "ce mois",
      cleaned.match(/\bdans\s+\d+\s+(jour|jours|semaine|semaines)\b/i)?.[0],
      cleaned.match(/\b\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?\b/i)?.[0],
      cleaned.match(/\b\d{1,2}(?:er)?\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i)?.[0],
      cleaned.match(/\b(?:avant|d'ici|pour)\s+(?:le\s+)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i)?.[0],
      cleaned.match(/\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b\s*(?:prochain|matin|soir)?/i)?.[0],
      cleaned.match(/\b\d+\s?(h|heures?|min|minutes)\b/i)?.[0],
    );
  }

  const title = cleanTitle(cleaned, markers.filter(Boolean));

  return {
    title,
    project: project || "Inbox",
    priority,
    estimatedMinutes,
    complexity,
    deadline: deadline ? deadline.toISOString() : null,
  };
}
