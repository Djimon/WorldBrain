// M10-S17 (#363, D16): Session-Zeit + host-seitiges Kalender-Gate.
//
// „Session-Jetzt" ist ein campaign-scoped, absoluter Tages-Zähler
// (`campaign_session_now.day`). Der DM kann ihn VORANSCHREITEN (relativ, in
// Tagen/Wochen/Jahren) ODER ABSOLUT SETZEN (konkreter Tag). Beides
// persistiert. Das Kalender-Gate ist HOST-seitig: nur Ereignisse mit
// start_day <= Session-Jetzt verlassen den Host (Decision 8 — Client filtert
// nie). Zukunfts-Ereignisse werden dem Client nie ausgeliefert.
import type { DatabaseLike } from './entity-service';
import { loadActiveCalendar } from './calendar-service';

// Fallback-Konvertierung wenn kein aktiver Kalender existiert. 7-Tage-Woche,
// 365-Tage-Jahr — greift nur für advance-by-weeks/years ohne Kalender.
const DEFAULT_WEEK_DAYS = 7;
const DEFAULT_YEAR_DAYS = 365;

export interface SessionNow {
  day: number;
}

/**
 * Liest den campaign-scoped Session-Jetzt. Ohne Eintrag = Tag 0 (Startpunkt).
 */
export async function getSessionNow(db: DatabaseLike, campaignId: string): Promise<SessionNow> {
  const rows = await db.select<{ day: number }>(
    'SELECT day FROM campaign_session_now WHERE campaign_id = ?',
    [campaignId],
  );
  return { day: rows[0]?.day ?? 0 };
}

/**
 * Setzt Session-Jetzt ABSOLUT auf einen konkreten Tag (Rückblende/Zeitsprung).
 * Upsert — persistiert campaign-scoped.
 */
export async function setSessionNow(
  db: DatabaseLike,
  params: { campaignId: string; day: number },
): Promise<void> {
  await db.execute(
    `INSERT INTO campaign_session_now (campaign_id, day) VALUES (?, ?)
     ON CONFLICT(campaign_id) DO UPDATE SET day = excluded.day`,
    [params.campaignId, params.day],
  );
}

/**
 * Schreibt Session-Jetzt VOR — relativ, in Tagen/Wochen/Jahren. Wochen/Jahre
 * werden über den aktiven Kalender (week.length / yearLengthDays) in Tage
 * umgerechnet; ohne Kalender greifen 7-Tage-Woche / 365-Tage-Jahr.
 */
export async function advanceTime(
  db: DatabaseLike,
  params: { campaignId: string; days?: number; weeks?: number; years?: number },
): Promise<void> {
  const current = await getSessionNow(db, params.campaignId);
  const weeks = params.weeks ?? 0;
  const years = params.years ?? 0;
  // Kalender NUR laden, wenn tatsächlich Wochen/Jahre umzurechnen sind — die
  // reine Tage-Advance braucht die calendars-Tabelle nicht (und darf nicht an
  // ihr hängen, falls kein Kalender existiert).
  let weekDays = DEFAULT_WEEK_DAYS;
  let yearDays = DEFAULT_YEAR_DAYS;
  if (weeks !== 0 || years !== 0) {
    ({ weekDays, yearDays } = await resolveUnitLengths(db));
  }
  const delta = (params.days ?? 0) + weeks * weekDays + years * yearDays;
  await setSessionNow(db, { campaignId: params.campaignId, day: current.day + delta });
}

async function resolveUnitLengths(db: DatabaseLike): Promise<{ weekDays: number; yearDays: number }> {
  const cal = await loadActiveCalendar(db);
  if (cal === null) return { weekDays: DEFAULT_WEEK_DAYS, yearDays: DEFAULT_YEAR_DAYS };
  return {
    weekDays: cal.week.length > 0 ? cal.week.length : DEFAULT_WEEK_DAYS,
    yearDays: cal.year_length_days > 0 ? cal.year_length_days : DEFAULT_YEAR_DAYS,
  };
}

/**
 * HOST-seitiges Kalender-Gate (Decision 8): filtert eine Ereignis-Liste auf
 * die, deren start_day <= Session-Jetzt liegt. Zukunfts-Ereignisse verlassen
 * den Host nie — der Client bekommt sie gar nicht erst zu sehen.
 */
export async function filterEventsBySessionNow<T extends { start_day: number }>(
  db: DatabaseLike,
  params: { campaignId: string; events: T[] },
): Promise<T[]> {
  const now = await getSessionNow(db, params.campaignId);
  return params.events.filter((e) => e.start_day <= now.day);
}
