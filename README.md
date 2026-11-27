# TaskHub — Dashboard local d'organisation

Application web locale (JavaScript) pour organiser tâches, projets, calendrier, notifications et routine du matin.

## Architecture

Microservices Node.js indépendants + frontend React, communiquant en HTTP local via une passerelle :

```
apps/web          Frontend React + Vite (dashboard, port 5173)
services/gateway  Passerelle unique           → http://localhost:4000
services/tasks    Tâches, projets, analyse de phrases (port 4001)
services/calendar Calendrier + planification automatique (port 4002)
services/notifications  Rappels, pop-ups temps réel via SSE (port 4003)
services/routine  Routine du matin : mails IMAP, newsletters, météo (port 4004)
```

Chaque service stocke ses données dans `data/<service>/*.json` (aucune base de données à installer).

## Démarrage

```bash
npm run install:all
npm run dev
```

Puis ouvrir http://localhost:5173

Configuration optionnelle : copier `.env.example` vers `.env`
- `WEATHER_CITY` : ville pour la météo (Open-Meteo, sans clé d'API)
- `IMAP_*` : boîte mail pour la routine du matin (Gmail : `imap.gmail.com`, port 993, mot de passe d'application)
- `ROUTINE_TIME` : heure de la routine (défaut `07:00`)

## Ajout rapide en une phrase

La barre d'ajout analyse une phrase en français et en déduit :

| Phrase | Analyse |
|---|---|
| « Rédiger le rapport client avant vendredi, urgent #ClientX » | titre nettoyé, projet ClientX, priorité haute, ~1 h, complexité 3/5, échéance vendredi 18 h |
| « Appeler le comptable demain, rapide » | 10 min, complexité 1/5, échéance demain 18 h |
| « Préparer la présentation équipe » | 2 h, complexité 4/5, pas d'échéance |

Si une échéance existe, la tâche est automatiquement découpée en créneaux de 30 min et placée dans les créneaux libres (9 h – 18 h, jours ouvrés) avant la deadline. Des rappels sont créés (J-1, matin même, échéance).

Syntaxes reconnues : `#projet`, « urgent / important / pas urgent », « aujourd'hui, ce soir, demain, après-demain », « dans X jours/semaines », « avant/d'ici/pour + jour », « cette semaine / semaine prochaine / fin du mois », dates `jj/mm` et « 3 mai », durées explicites « 2 h », « 30 min ».

## Notifications et pop-ups

- Flux SSE temps réel : cloche 🔔 + toasts dans le dashboard
- Notifications navigateur (Notification API) après autorisation
- Rappels automatiques par tâche avec échéance

## Routine du matin

Lancée tous les jours à `ROUTINE_TIME` (ou via le bouton « Lancer la routine ») :
1. météo du jour (Open-Meteo)
2. tâches et événements du jour
3. lecture des mails des dernières 24 h (IMAP)
4. classement : newsletter éco (mots-clés éco/marchés/finance), newsletters info, mails importants
5. résumé poussé en notification et affiché dans le widget « Brief du matin »

Sans configuration mail, la routine fonctionne quand même (météo + tâches + agenda).

## Variantes

- Backend seul : `npm run start:backend`
- Build frontend de production : `npm run build:web`
- Docker : `docker compose up` (compose fourni à titre optionnel)
