"""Test-Daten-Generator fuer WorldBuilderX (Projekt Test-123).

EIN Durchlauf legt IMMER alle vier Gruppen an (keine Optionen):
- A: nur echte Relations (relations-Tabelle), keine @mentions
- B: nur Mentions (@[Titel](id) im summary), keine Relations
- C: gemischt (Relations UND Mentions)
- D: isoliert (keine Verbindung) -> testet Mindestgroesse

Skaliert auf TARGET Nodes (Default 400), Verteilung A35/B25/C25/D15 %.
Alle IDs 'gen-XXXX', alle Titel 'GEN …' -> leicht auffindbar/loeschbar.

WICHTIG: App vorher schliessen (sonst WAL-Lock / stale Ansicht).

Aufruf:
    python gen_test_entities.py            # 400 Nodes einfuegen
    python gen_test_entities.py 250        # eigene Anzahl
    python gen_test_entities.py --wipe     # alle gen-* wieder loeschen
"""
import sqlite3
import sys

DB = r"C:\Users\Administrator\AppData\Roaming\com.worldbuilderx.desktop\projects\test-123\world.db"
TYPES = ["Character", "Location", "Faction", "Item", "Event", "Lore"]
CLUSTER = 12  # Gruppe-A Cluster-Groesse (Mitglieder je Hub)
# Vielfalt an relation_type (mit Inverse) -> Relations werden reihum belegt,
# damit im Graphen viele verschiedene Beziehungstypen vorkommen.
REL_PAIRS = [
    ("member_of", "has_member"),
    ("located_in", "contains"),
    ("allied_with", "allied_with"),
    ("owns", "owned_by"),
    ("knows", "known_by"),
    ("rules", "ruled_by"),
    ("parent_of", "child_of"),
    ("enemy_of", "enemy_of"),
    ("mentor_of", "student_of"),
    ("part_of", "has_part"),
]


def build(target: int):
    nA = int(target * 0.35)
    nB = int(target * 0.25)
    nC = int(target * 0.25)
    nD = target - nA - nB - nC

    ents = []       # [id, type, title, summary]
    title = {}
    idx = 0

    def mk(t: str, name: str) -> str:
        nonlocal idx
        i = f"gen-{idx:04d}"; idx += 1
        ti = f"GEN {name}"
        ents.append([i, t, ti, ""]); title[i] = ti
        return i

    A = [mk("Faction" if k % CLUSTER == 0 else "Character", f"Nord {k}") for k in range(nA)]
    B = [mk("Character", f"Sued {k}") for k in range(nB)]
    C = [mk(TYPES[k % len(TYPES)], f"Mix {k}") for k in range(nC)]
    D = [mk(TYPES[k % len(TYPES)], f"Waise {k}") for k in range(nD)]

    rels = []
    summ = {}
    rc = 0

    def add_rel(src: str, tgt: str):
        nonlocal rc
        rel, inv = REL_PAIRS[rc % len(REL_PAIRS)]
        rels.append([f"r{rc:05d}", src, tgt, rel, inv])
        rc += 1

    # A: relations-only. Mitglieder -> Cluster-Hub; Hubs untereinander verkettet.
    # relation_type reihum aus REL_PAIRS (Vielfalt, Semantik zweitrangig).
    for gi, i in enumerate(A):
        hub = A[(gi // CLUSTER) * CLUSTER]
        if i != hub:
            add_rel(i, hub)
    hubs = A[::CLUSTER]
    for k in range(len(hubs) - 1):
        add_rel(hubs[k], hubs[k + 1])

    # B: mentions-only. Jeder verweist per @[..](id) auf die naechsten zwei.
    for gi, i in enumerate(B):
        if len(B) < 3:
            break
        t1 = B[(gi + 1) % len(B)]; t2 = B[(gi + 2) % len(B)]
        summ[i] = f"Kennt @[{title[t1]}]({t1}) und @[{title[t2]}]({t2})."

    # C: gemischt. Relation auf den naechsten + Mention auf den uebernaechsten.
    for gi, i in enumerate(C):
        if len(C) < 3:
            break
        nxt = C[(gi + 1) % len(C)]; men = C[(gi + 2) % len(C)]
        add_rel(i, nxt)
        summ[i] = f"Sieht @[{title[men]}]({men})."

    # D: isoliert.
    for i in D:
        summ[i] = "Ohne Verbindungen."

    for e in ents:
        if e[0] in summ:
            e[3] = summ[e[0]]

    return [tuple(e) for e in ents], [tuple(r) for r in rels]


def wipe(cur):
    cur.execute("DELETE FROM relations WHERE id LIKE 'r%gen-%' OR id LIKE 'rA%' OR id LIKE 'rC%' "
                "OR source_id LIKE 'gen-%' OR target_id LIKE 'gen-%'")
    cur.execute("DELETE FROM base_entities WHERE id LIKE 'gen-%'")


def main():
    args = [a for a in sys.argv[1:]]
    con = sqlite3.connect(DB, timeout=3)
    cur = con.cursor()
    if "--wipe" in args:
        wipe(cur); con.commit()
        print("gen-* Test-Daten geloescht.")
        con.close(); return

    target = next((int(a) for a in args if a.isdigit()), 400)
    ents, rels = build(target)
    wipe(cur)  # idempotent
    cur.executemany("INSERT INTO base_entities (id, type, title, summary) VALUES (?, ?, ?, ?)", ents)
    cur.executemany("INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type) VALUES (?, ?, ?, ?, ?)", rels)
    con.commit()
    mcount = sum(1 for e in ents if "@[" in e[3])
    print(f"Ziel {target}: {len(ents)} Entities, {len(rels)} Relations, {mcount} mit Mentions.")
    print("Gruppen: A Relations-only, B Mentions-only, C gemischt, D isoliert (alle in EINEM Durchlauf).")
    print("Rueckgaengig: python gen_test_entities.py --wipe")
    con.close()


if __name__ == "__main__":
    main()
