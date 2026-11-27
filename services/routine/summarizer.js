const ECO_HINTS = /(éco|eco|econom|bourse|marché|finance|investi|action|obligation|crypto|inflation)/i;
const NEWS_HINTS = /(newsletter|news|actu|information|hebdo|quotidien|journal|revue de presse|bulletin)/i;

export function classifyMail(mail) {
  const text = `${mail.subject} ${mail.fromAddress}`;
  if (ECO_HINTS.test(text)) return "eco";
  if (NEWS_HINTS.test(text) || /newsletter|noreply|no-?reply/i.test(mail.fromAddress)) return "news";
  return "mail";
}

export function summarizeText(text, maxSentences = 3) {
  if (!text) return "";
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  if (!sentences.length) return text.slice(0, 280);
  return sentences.slice(0, maxSentences).join(" ").slice(0, 600);
}

export function summarizeMails(mails) {
  const groups = { eco: [], news: [], mail: [] };
  for (const mail of mails) groups[classifyMail(mail)].push(mail);

  const brief = {
    total: mails.length,
    unread: mails.filter((m) => !m.seen).length,
    newslettersEco: groups.eco.map((m) => ({ subject: m.subject, from: m.from, date: m.date, summary: summarizeText(m.subject, 1) })),
    newslettersInfo: groups.news.map((m) => ({ subject: m.subject, from: m.from, date: m.date, summary: summarizeText(m.subject, 1) })),
    importantMails: groups.mail
      .filter((m) => !/noreply|no-?reply|notification|alerte|digest/i.test(m.fromAddress + m.subject))
      .slice(0, 10)
      .map((m) => ({ subject: m.subject, from: m.from, date: m.date, unread: !m.seen })),
  };
  return brief;
}
