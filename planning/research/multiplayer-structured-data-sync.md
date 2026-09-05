# Research: Struktur-Daten-Sync Host→Spieler (P2P/WebRTC) — SOTA 2026

**Stand:** 2026-09 · **Spike:** #434 (P1) · **Speist:** #427 (DB-lose Datenquelle für Spieler-Views) · **Schwester-Spike:** „Binär-Asset-Transfer" (Karten-Bilder — **nicht hier**).

## Kontext (self-contained, für Leser ohne Vorwissen)
Worlds and Beyond ist eine **Tauri-v2-Desktop-App** (React/TS, Windows = WebView2/Chromium). Multiplayer läuft **P2P über WebRTC-DataChannel, ohne eigenen Server**. Vertrag (**D30-Membran**): der **Spieler hat keine Welt-DB**. Er sieht nur den vom **Host sichtbarkeits-gefilterten** Ausschnitt, den der Host über den Transport pusht; der Client hält ihn in einem transport-gespeisten In-Memory-Store und rendert daraus. Der **Host ist alleinige Autorität** (ground truth + Sichtbarkeits-Filter); der Spieler ist **read-only** und schickt nur Intents (`ClientAction`) zurück.

Dieser Spike behandelt **nur STRUKTURIERTE Daten** (Text/Objekte: Entities, Kalender-Events, Kampflog, Session-/Zeit-State, Roster, Player-Character). **Große Binärdaten (Karten-Bilder) sind explizit ausgeschlossen** (Schwester-Spike).

**Harte Transport-Bindung (Rahmenbedingung):** Der Sync läuft über **unseren bestehenden** WebRTC-DataChannel-Transport (`session-transport` über `webrtc-transport`; `loopback-transport` für GM-Self-Join/Tests). Eine Kandidaten-Lib darf **nur** ihren Sync-Algorithmus / ihr Nachrichten-Protokoll beitragen — **niemals** einen eigenen Server/Transport/Signaling. **CRDT-Netzwerk-Provider (`y-websocket`, `y-webrtc`, Automerge-Repo-Adapter, Liveblocks-Backend) sind damit ausgeschlossen.** Braucht ein Kandidat seinen mitgelieferten Transport → disqualifiziert.

---

## 1. Ist-Zustand (Baseline — bewerten: behalten+erweitern ODER ersetzen)

Der Membran-Vertrag existiert bereits und funktioniert für den Live-Fall:

- **Protokoll** `src/services/play-sync-protocol.ts` — reine Typen, drei Nachrichten:
  - `Snapshot { campaignId, recipientPlayerId, serverTime, entities: SyncEntity[] }` — **voller** host-gefilterter Satz für **einen** Empfänger.
  - `Delta { op:'add'|'update'|'remove', kind, id, data?, serverTime }` — **eine** Änderung.
  - `ClientAction` — Spieler→Host-Intent.
  - `SyncEntity { kind, id, data }` mit `SyncEntityKind` = entity/map/marker/token/calendar_event/handout/combat_log/whiteboard_element/session_time/player_character (alle Struktur-Kinds außer dem `map`-**Bild**).
- **Client-Store** `src/services/play-client-store.ts` — In-Memory-`Map<"kind::id", SyncEntity>`. `applySnapshot` = **`items.clear()` + neu befüllen** (Reset). `applyDelta` = eine Zelle. `list`/`get`/`ownCharacter`/`subscribe`/`clear`.
- **Host-Filter** `src/services/host-push-service.ts` (`computeSnapshot`, `computeDeltaRecipients` — letzte `gm_only`-Sperre) + `player-content-filter-service` / `player-view-export`. **Bleibt einzige Sichtbarkeits-Autorität.**
- **Transport** `session-transport.ts` (Envelope `{ type, payload, token }`, per-Message-Token-Gate, Pre-Auth-Handshake) über `webrtc-transport.ts`.

### Lücken der Baseline (= genau der Spike-Auftrag)
| # | Anforderung | Baseline heute |
|---|---|---|
| G1 | **Cold-Join** voller Ausschnitt | ✅ `Snapshot` deckt das ab |
| G2 | **Re-Join inkrementell** (nur Delta seit letztem Stand) | ❌ es gibt **nur** vollen Snapshot; kein „since"-Konzept |
| G3 | **Live-Deltas konsistent**, auch **während** Initial-Transfer | ❌ **keine Ordnung/Sequenz**; ein Delta, das **vor/während** eines Snapshots ankommt, wird vom `items.clear()` **überschrieben** oder verpasst |
| G4 | **Integrität** (Client == host-gefiltertes Soll) | ❌ keine Verifikation/Hash |
| — | Re-Join-Cache über Neustart | ❌ rein flüchtig (RAM) |

> **Direkte Evidenz für G3 im eigenen Code:** `session-transport.ts:52–57` dokumentiert, dass der `roster`-Feed **bewusst als eigener Nachrichtentyp** (nicht als Snapshot/Delta-Entity) gebaut wurde, *weil* „`applySnapshot` clears its entity map on every map snapshot … which would wipe a roster kept there." Dasselbe Reset-Problem traf #421 (Roster) und #422 (Combatlog-Replay nach Snapshot). Das ist **kein** Roster-Spezialfall, sondern das fehlende Ordnungs-/Versions-Modell (G3) — die Workarounds sind Symptome.

### Haupt-Last: Karten-Overlay = hochfrequente Positions-Deltas (nicht nur seltene Edits)
Zu den **Struktur**-Daten gehört das **Live-Overlay der Karte** — **Token-/Marker-/Pin-Positionen, Grid-Status, Messwerkzeuge** = kleine `{x, y, typ, …}`-Records. Der `map`-Record selbst trägt nur **Metadaten + einen Bild-Hash**; die **Bild-Bytes sind NICHT Teil dieses Sync** (Schwester-Spike #435, einmalig gecacht). Kritische Konsequenz für die Diff-/Delta-Wahl: die Strategie muss **viele kleine, sehr häufige Positions-Deltas** tragen (Token-Bewegung während des Spiels), nicht nur seltene Entity-Edits.

Das Muster existiert bereits (#366, `token-movement-service.ts`): `buildMovementDelta` erzeugt genau ein `Delta { op:'update', kind:'token', data:{x,y} }`, `broadcastMovement` schickt es **fire-and-forget, ungefiltert** (Token sind D18/D20 für alle sichtbar), `applyMovementMessage` wendet es auf den Store an. **Das ist bereits ein Delta** → die empfohlene Delta-Log+Seq-Familie (C) verallgemeinert #366 **nativ** (nur `seq` ergänzen). Zwei Eigenschaften der Positions-Last prägen aber das Design:

- **Last-Write-Wins pro `id`, koaleszierbar:** nur die **aktuelle** Position zählt; Zwischenpositionen sind wegwerfbar. Ordnung braucht **`seq`** (out-of-order x/y würde jittern → nach `seq`, nicht nach Ankunft anwenden), aber der Verlauf muss **nicht** in den durablen Re-Join-Log. Der Store ist ein **keyed `Map` (aktueller Zustand pro `kind::id`)**, kein append-only Event-Log — Re-Join liest die **aktuelle** Position aus Snapshot/Manifest, nie die Bewegungshistorie. Damit bleiben Re-Join-Bytes auch unter starker Bewegung klein.
- **Durabel vs. ephemer trennen:** `entity`/`calendar_event`/`handout`/`combat_log` = durable Edits (append/behalten); `token`/`marker`/Pin-`x/y`, Grid, Messwerkzeug = **ephemere LWW-Positions-Deltas** (koaleszieren, ggf. **host-seitig throtteln** — max. N Updates/s pro Token, Zwischenframes droppen). Beides läuft über dasselbe `Delta`+`seq`, wird aber unterschiedlich **geloggt** (durabel im Re-Join-Tail, ephemer nur als „aktueller Zustand").
- **Filter-Asymmetrie:** Positions-Deltas sind heute **ungefiltert-broadcast** (alle sehen sie), Entities sind **pro-Empfänger gefiltert** — das Seq-Modell muss beide Ströme tragen (s. §7 offener Punkt).

> Das **verstärkt** die CRDT-Absage (§2A): ein CRDT würde **jede** Mikro-Bewegung als geloggte Op mit Metadaten/Tombstones führen — genau falsch für koaleszierbare, ephemere Positionen.

---

## 2. Kandidaten-Familien (SOTA 2026)

### A) CRDT-Frameworks — Yjs · Automerge · Loro
Alle drei sind **MIT**, aktiv, produktionsreif; Yjs ist der Default (~920k Downloads/Woche, größtes Ökosystem), Loro der schnellste, aber jüngste (Rust/WASM), Automerge der research-nahe ([PkgPulse 2026](https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026), [Velt 2026](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync)).

**Passung zu unserem Modell — ehrlich abgewogen: Overkill.**
- Die **Kernwertschöpfung** eines CRDT ist konfliktfreies **Merging nebenläufiger Schreiber**. Unser Modell hat **genau einen Schreiber (Host)** und **nur lesende** Clients. Es gibt **keinen Konflikt aufzulösen** → der teuerste Teil des CRDT ist toter Ballast (Tombstones, Lamport-/Vektor-Metadaten pro Element, WASM-Laufzeit).
- **Transport-Bindung killt den bequemen Pfad:** der übliche CRDT-Einsatz läuft über die mitgelieferten Netzwerk-Provider (`y-webrtc`, `y-websocket`) — die sind hier **verboten**. Bleibt nur die **reine Update-Ebene** einer Lib (`Y.encodeStateAsUpdate(doc, stateVector)` → binäres Delta) manuell über unseren Channel. Damit benutzt man vom CRDT nur noch das **State-Vector-Delta-Primitiv** — ein generischer Replikations-Gedanke, **nicht** CRDT-spezifisch (s. Familie C).
- **Sichtbarkeits-Filter kollidiert mit dem CRDT-Dokumentmodell:** unser Soll ist ein **pro-Empfänger unterschiedlich gefilterter** Ausschnitt. Ein geteiltes CRDT-Dokument ist per Design für **alle** Replikate dasselbe. Pro-Spieler ein eigenes CRDT-Doc zu fahren wirft den Ökosystem-Vorteil weg und dupliziert Host-Zustand n-fach.
- **Dep-Gewicht:** Automerge/Loro ziehen WASM (hunderte KB, async init) in ein Bundle, das wir gerade feature-gaten/tree-shaken (#412). Yjs ist schlanker (JS), bringt aber ohne Provider auch nur das Update-Primitiv.

**Verdikt: DISQUALIFIZIERT als Framework.** Kein Konflikt → kein CRDT-Nutzen, der das Dep-/Modell-Gewicht trägt. Der **einzige** übernehmbare Gedanke (State-Vector-Delta) ist in Familie C ohne Lib abbildbar.

### B) Inhalts-adressierter / Merkle-Diff (rsync-artig)
Jedes Element bekommt einen **Content-Hash**; Client und Host vergleichen **Hash-Manifeste** (flach oder als Merkle-Baum über `kind`-Buckets) und übertragen nur, was abweicht. Reift 2026 in Dat/Dolt/Git-artigen Systemen; **keine Lib nötig** (Web-Crypto `crypto.subtle.digest` ist nativ).
- **Stärke:** perfekt für **Re-Join (G2)** und **Integrität (G4)** — der Client schickt sein Manifest (oder nur einen Merkle-Root pro `kind`), der Host antwortet mit den geänderten Elementen. Sichtbarkeits-Filter integriert sauber (Host hasht **nur das gefilterte Soll** des Empfängers).
- **Schwäche:** **Live-Deltas (G3)** löst es nicht allein — Diff ist ein Pull-Zeitpunkt-Vergleich, kein Strom. Kombiniert man es mit einem Sequenz-Strom (C), ist es aber die ideale **Re-Join- und Verifikations-Schicht**.

### C) Versionierter Delta-Log + Sequenz/State-Vector (Snapshot + Log-Tail)
Der **klassische DB-Replikations-Pattern** — und laut Recherche der Standard für „Snapshot + inkrementeller Nachschub mit Konsistenz": initialer Snapshot mit einem **Sequenz-Cutoff**, danach **Replay der Log-Records nach dem Cutoff**, wobei bereits im Snapshot enthaltene übersprungen werden ([SQL Server transactional replication](https://www.sqlshack.com/sql-server-replication-configuring-snapshot-and-transactional-replication/), [Estuary: DB replication/CDC](https://estuary.dev/blog/database-replication/)).
- Host führt einen **monotonen `version`-Zähler** pro Campaign; jede Änderung ist ein Op mit `seq`. Der **Snapshot trägt `baseVersion`** (Stand, bis zu dem er vollständig ist). Live-`Delta`s tragen ihr **`seq`**; der Client wendet nur `seq > baseVersion` an und erkennt an **Lücken** (seq übersprungen) einen Fehler → Re-Sync.
- **G3 gelöst by design:** während der Initial-Transfer läuft, **puffert** der Client eingehende Deltas und spielt sie **nach** dem Snapshot **geordnet nach seq** ein (Dup per seq verworfen, Lücke → Full-Resync). Das ist exakt der „Snapshot-Cutoff + Log-Tail"-Mechanismus — kein Roster-artiger Sonderkanal mehr nötig.
- **G2 gelöst:** Re-Join schickt `since = letzterSeq`; Host replayt den **gefilterten** Log-Tail ab `since`. (Filter-Interaktion mit per-Empfänger-Seq → Design-Punkt für #427, s. §6.)
- **Keine Lib** — nur Zähler + Puffer über dem bestehenden Protokoll.

> **Delta-CRDT-Forschung als Warnung mitgenommen:** delta-basierte Verfahren schlagen State-basierte **nur bei kleiner Churn**; bei near-total-Churn pro Runde schrumpft der Vorteil auf null ([Enes et al., „Efficient Synchronization of State-based CRDTs"](https://arxiv.org/pdf/1803.02750)). Für uns unkritisch (Tisch-Runde = viele kleine, punktuelle Änderungen), aber die **Verwerf-Regel** (§5) muss den Fall „großer Batch schlägt Full-Snapshot" abfangen → dann lieber Snapshot neu.

### D) Kompression (orthogonal, für Cold-Join/große Snapshots)
`CompressionStream`/`DecompressionStream` sind **nativ** im Chromium-Unterbau von WebView2 (gzip/deflate überall; **zstd** ab Chrome 123, [MDN CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream), [Web-Kompression 2026](https://blog.andr2i.com/posts/2026-06-03-web-compression-in-2026-brotli-zstd-and-compression-patterns)). Für unsere Struktur-Payloads (JSON-Text) reicht **natives gzip/deflate, dep-frei**; brotli/zstd nur bei Bedarf (brotli-wasm als Fallback). **Empfehlung: erst messen** (unsere Snapshots sind klein) — Kompression ist ein späterer Schalter, kein Architektur-Treiber.

---

## 3. Vergleichs-Matrix

| Kriterium | A) CRDT-Framework | B) Merkle/Content-Hash | **C) Delta-Log + Seq** | D) Kompression |
|---|---|---|---|---|
| Passung host-autoritativ **read-only** | ✖ (Konflikt-Logik ungenutzt) | ✔ | **✔✔** | n/a |
| Cold-Join (G1) | ✔ | ✔ | **✔** (bestehender Snapshot) | Hilfe |
| Re-Join inkrementell (G2) | ✔ (State-Vector) | **✔✔** | ✔ (Log-Tail) | — |
| Live-Delta-Konsistenz (G3) | ✔ | ✖ (Pull-Zeitpunkt) | **✔✔** (seq-Cutoff+Puffer) | — |
| **Hochfreq. Positions-Deltas** (Token/Marker) | ✖ (Op-/Tombstone-Bloat) | ✖ (kein Strom) | **✔✔** (LWW pro id + seq, koaleszierbar) | — |
| Integrität (G4) | ✔ (intern) | **✔✔** (Hash-Manifest) | ✔ (+Manifest) | — |
| Sichtbarkeits-Filter pro Empfänger | ✖ (geteiltes Doc) | ✔ (Host hasht Soll) | **✔** (Host filtert Tail) | ✔ |
| Transport-Bindung erfüllbar | ✖/~ (nur Update-Ebene) | ✔ | **✔** | ✔ |
| Dep-Gewicht / Lizenz | WASM, hunderte KB / MIT | **0 dep** (Web-Crypto) | **0 dep** | **0 dep** (nativ) |
| Reuse bestehender Baseline | gering (Umbau) | mittel | **hoch** (erweitert Snapshot/Delta) | additiv |

---

## 4. Empfehlung

**Die Baseline behalten und minimal erweitern — Familie C (Delta-Log + Sequenz) als Rückgrat, Familie B (Hash-Manifest) für Re-Join-Diff + Integrität, Familie D (natives gzip) optional-nach-Messung. Kein CRDT-Framework.**

Begründung in einem Satz: unser Modell ist **Single-Writer/Many-Reader read-only mit Pro-Empfänger-Filter** — das ist der Lehrbuchfall für **Snapshot + versionierten Log-Tail**, nicht für konfliktfreies Merging; die klassische Replikation ist dep-frei, filter-kompatibel und reift auf bewährter Basis, während CRDTs ihren einzigen Vorteil (Merge) hier nie ausspielen und dafür WASM-Gewicht + verbotene Netzwerk-Provider mitbringen.

Konkret zu bauen (in #427):
1. **Sequenz einführen:** monotoner `version`-Zähler pro Campaign auf dem Host; jedes `Delta` trägt `seq`, jeder `Snapshot` trägt `baseVersion`.
2. **Client-Ordnung + Puffer:** Store trackt `appliedSeq`, puffert Deltas während des Initial-Transfers, wendet `seq`-geordnet an, verwirft Dups, erkennt Lücken → Full-Resync. **Ersetzt** die Roster/Combatlog-Sonderkanäle langfristig (G3).
3. **Re-Join:** neue Nachricht `sync_request { since }`; Host replayt den gefilterten Log-Tail oder — bei zu großem Rückstand/Churn — schickt einen frischen Snapshot (Verwerf-Regel §5).
4. **Integrität/Manifest:** Host liefert je Snapshot einen **Hash-Manifest** (`kind::id → contentHash`, plus Merkle-Root pro `kind`); Client verifiziert Endzustand und kann beim Re-Join sein Manifest zum gezielten Diff schicken (Familie B).
5. **Re-Join-Cache (persistent, sauber abgegrenzt):** ein **reiner Sync-Cache** in **IndexedDB** (in WebView2 nativ), key = `(campaignId, playerId)`, Inhalt = letzter Store-Stand + `appliedSeq` + Manifest. **Das ist keine Welt-DB** (D30 bleibt gewahrt): er hält ausschließlich den bereits host-gefilterten, dem Spieler ohnehin sichtbaren Ausschnitt — nur damit Re-Join nicht bei 0 startet. RAM-only bleibt als Fallback gültig.

---

## 5. Bewertung + Mess-Methode (Pflicht, belegbar)

**Fixture (dokumentiert):** eine repräsentative Welt — **300 Entities + 80 Kalender-Events + 200 Kampflog-Zeilen + eine präsentierte Karte mit ~30 Token/Marker + Session-/Zeit-State + Roster (6 Spieler)**, davon ~40 % `gm_only` (Filter-Last). Als JSON-Seed unter `tests/fixtures/` ablegen, damit Benches reproduzierbar sind.

**Metriken je Kandidat:**
- **Cold-Join-Zeit** (ms) + Bytes über den Channel.
- **Re-Join** bei **kleiner** Änderung (1 Entity geändert): Bytes + ms — der Kern-Vergleich (Full-Snapshot vs. Log-Tail vs. Hash-Diff).
- **Live-Delta-Latenz** (Intent→sichtbar) + **Konsistenz** unter „Delta während Initial-Transfer" (gezielter Test).
- **Positions-Durchsatz:** Latenz **und** Bytes/s bei **hochfrequenten** Positions-Updates (z. B. 1 Token, 20 Bewegungen/s über 10 s; dann 5 Token gleichzeitig) — plus: **wächst der Re-Join-Tail dabei?** (Soll: nein — LWW-Coalescing hält ihn flach.)
- **Korrektheit:** Merkle-Root des Client-Stores == Host-gefiltertes Soll.
- **Dep-Gewicht** (KB im Bundle) / **Lizenz** (MIT-kompatibel) / Passung zu `play-sync-protocol`+`play-client-store`.

**Verwerf-Regeln (vorab):**
- Kandidat bringt **eigenen Transport/Server/Signaling** mit, der nicht abschaltbar ist → **raus** (Transport-Bindung).
- Nicht-MIT-kompatible Lizenz → **raus**.
- Re-Join bei kleiner Änderung überträgt **> 50 %** der Cold-Join-Bytes → schlägt Full-Snapshot nicht → **raus** (dann lieber Snapshot).
- WASM-Init > ~150 ms Cold-Start oder > ~150 KB gzipped Dep **ohne** proportionalen Nutzen → **raus**.
- Kann **pro-Empfänger-Filter** nicht abbilden → **raus**.

**Wegwerf-Prototyp/Bench:** ein Micro-Bench über `loopback-transport` (kein echtes WebRTC nötig) misst Cold-/Re-Join-Bytes & -Zeit für (a) heutiger Full-Snapshot, (b) Delta-Log+Seq, (c) Hash-Manifest-Diff. Nur **Vertrag/Erkenntnis** wandert in Prod. Vor jedem etwaigen Lib-Import zuerst deren **echte** `.d.ts` lesen (nie API aus dem Gedächtnis).

---

## 6. Protokoll-/Interface-Skizze für #427 (Struktur-Teil)

Additiv zum bestehenden `play-sync-protocol.ts` — **abwärtskompatibel als Erweiterung**, nicht als Neubau (Felder optional einführen, dann verpflichtend machen):

```ts
/** Monotone Host-Version pro Campaign (Lamport-artig; nur der Host schreibt). */
export type SyncVersion = number;

export interface Snapshot {
  type: 'snapshot';
  campaignId: string;
  recipientPlayerId: string;
  serverTime: string;
  entities: SyncEntity[];
  baseVersion: SyncVersion;      // NEU: vollständig bis zu diesem seq
  manifest?: SyncManifest;       // NEU (G4): Integritäts-/Re-Join-Diff-Basis
}

export interface Delta {
  type: 'delta';
  campaignId: string;
  op: DeltaOp;
  kind: SyncEntityKind;
  id: string;
  data?: Record<string, unknown>;
  serverTime: string;
  seq: SyncVersion;              // NEU: Ordnung + Lücken-/Dup-Erkennung
}

/** G2/G4: pro-Empfänger-gefiltertes Hash-Manifest (Familie B). */
export interface SyncManifest {
  version: SyncVersion;
  /** Merkle-Root je Kind → billiger Erst-Vergleich; Detail erst bei Abweichung. */
  rootsByKind: Partial<Record<SyncEntityKind, string>>;
  /** Optional voll: "kind::id" → contentHash (für gezielten Diff). */
  entries?: Record<string, string>;
}

/** G2: Re-Join. Client meldet Stand; Host antwortet mit Delta-Tail ODER frischem Snapshot. */
export interface SyncRequest {
  type: 'sync_request';
  campaignId: string;
  since: SyncVersion;            // letzter contiguous appliedSeq
  manifestRoots?: Partial<Record<SyncEntityKind, string>>; // optional für Hash-Diff
}

export type SyncMessage = Snapshot | Delta | ClientAction | SyncRequest;
```

**Client-Store-Erweiterung** (`play-client-store`): `appliedSeq: SyncVersion`, ein **Reorder-Puffer** (`Map<seq, Delta>`) für den Initial-Transfer, `verify(manifest): boolean`, und Persistenz-Hooks (`hydrate(cache)`/`dehydrate(): cache`) für den IndexedDB-Sync-Cache. `applySnapshot` setzt `appliedSeq = baseVersion` und **spült dann den Puffer** (seq-geordnet) — damit sind gepufferte Live-Deltas nicht mehr vom `clear()` betroffen (behebt G3 an der Wurzel).

**Host-Seite** (`host-push-service`): `computeSnapshot` liefert zusätzlich `baseVersion` + `manifest` aus dem gefilterten Soll; ein neuer `computeResync(since, filterCtx)` liefert den gefilterten Log-Tail **oder** signalisiert „Full-Snapshot nötig" (Verwerf-Schwelle). Die Sichtbarkeits-Autorität bleibt unverändert bei `player-content-filter-service`.

---

## 7. Rest-Risiken / offene Design-Punkte für #427
- **Seq vs. Pro-Empfänger-Filter:** ein globaler Host-`version` erzeugt beim gefilterten Empfänger **Lücken** (Ops, die er nicht sehen darf). Sauber: Host führt **pro Empfänger** ein contiguous `seq` auf dem **gefilterten** Strom (globale `version` bleibt intern). Das ist der Haupt-Detailentscheid von #427 (bench beide).
- **Sichtbarkeits-Wechsel als Delta:** wenn der Host ein Element **für einen Spieler unsichtbar** macht, muss das als `remove`-Delta an genau diesen Empfänger gehen (nicht nur „nicht mehr senden"). `computeDeltaRecipients` deckt das prinzipiell ab — im Sync-Modell explizit testen.
- **Cache-Invalidierung:** Kampagne gelöscht/umbenannt, Spieler gekickt, Manifest-Mismatch → Sync-Cache verwerfen und Cold-Join. `dev data disposable` (kein Migrations-Zwang).
- **Kompression erst nach Messung** — nicht vorbauen (Snapshots sind klein).

---

## Quellen
- [PkgPulse — Yjs vs Automerge vs Loro (2026)](https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026)
- [Velt — Best CRDT Libraries (2026)](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync)
- [Enes et al. — Efficient Synchronization of State-based CRDTs (arXiv 1803.02750)](https://arxiv.org/pdf/1803.02750)
- [SQLShack — SQL Server Snapshot & Transactional Replication](https://www.sqlshack.com/sql-server-replication-configuring-snapshot-and-transactional-replication/)
- [Estuary — Database Replication, CDC, Log-based Incremental](https://estuary.dev/blog/database-replication/)
- [MDN — CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream)
- [Web compression in 2026: brotli, zstd, patterns](https://blog.andr2i.com/posts/2026-06-03-web-compression-in-2026-brotli-zstd-and-compression-patterns)
