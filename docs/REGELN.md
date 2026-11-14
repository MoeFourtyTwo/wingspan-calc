# Flügelschlag – Regeln zur Schlusswertung

Diese Zusammenfassung beschreibt die **Schlusswertung** von *Flügelschlag* (engl. *Wingspan*, Stonemaier Games / Feuerland Spiele) mit allen Erweiterungen, die dieser Rechner unterstützt. Sie ist in eigenen Worten verfasst und ersetzt nicht die offiziellen Regelhefte. Diese gibt es kostenlos bei Feuerland Spiele:

- Grundspiel: <https://www.feuerland-spiele.de/fileadmin/game/Fluegelschlag/Fluegelschlag_DE_Regel_V2-0.pdf>
- Ozeanien-Erweiterung: <https://www.feuerland-spiele.de/fileadmin/game/Fluegelschlag/Exp_2_Ozeanien/Regelbuch.pdf>
- Flügelschlag Asien: <https://www.feuerland-spiele.de/fileadmin/game/Fluegelschlag/Exp_3_Asien/Regel_fluegelschlag_asien.pdf>
- Mittel- und Südamerika: Regeln im Ordner `Exp_4_Amerika` auf feuerland-spiele.de

Neben jeder Regel steht der Name der Funktion in [`src/lib/rules/scoring.ts`](../src/lib/rules/scoring.ts), die sie umsetzt. Die Tests in [`scoring.test.ts`](../src/lib/rules/scoring.test.ts) und [`store.test.ts`](../src/lib/store.test.ts) prüfen diese Regeln.

---

## 1. Spielerzahl

| Variante | Spieler |
|---|---|
| Grundspiel, Europa, Ozeanien, Amerika | 1–5 (Solo gegen den Automa) |
| Flügelschlag Asien – Duellmodus | 2 |
| Flügelschlag Asien – Schwarmmodus (mit Grundspiel kombiniert) | 6–7 |

Im Rechner sind deshalb 1–7 Spieler erlaubt (`MIN_PLAYERS`, `MAX_PLAYERS`).

## 2. Wertungskategorien

Die Schlusswertung erfolgt am Ende der 4. Runde. Jeder Spieler addiert die Punkte aus allen Kategorien (`sumScores`):

| # | Kategorie (Wertungsblock) | Punkte |
|---|---|---|
| 1 | **Vögel** | aufgedruckter Punktwert jeder ausgespielten Vogelkarte |
| 2 | **Bonuskarten** | laut Bonuskarte |
| 3 | **Rundenziele** | auf der Zieltafel gesammelte Punkte (siehe Abschnitt 3) |
| 4 | **Eier** | 1 Punkt je Ei auf Vogelkarten |
| 5 | **Gelagertes Futter** | 1 Punkt je Futtermarker auf Vogelkarten |
| 6 | **Karten unter Vögeln** | 1 Punkt je unter einen Vogel gesteckter Karte |
| 7 | **Nektar** *(Ozeanien)* | Mehrheiten je Lebensraum (siehe Abschnitt 4) |
| 8 | **Kolibri-Leiste** *(Mittel- und Südamerika)* | Summe der Werte unter den Markern; kann negativ sein (siehe Abschnitt 5) |

Futtermarker im eigenen Vorrat und Karten auf der Hand bringen **keine** Punkte.

## 3. Rundenziele (Zieltafel)

Am Ende jeder Runde wird das Rundenziel gewertet. Die Zieltafel hat zwei Seiten.

### 3.1 Grüne Seite (Wettbewerb), `scoreRoundGoals`

Die Spieler werden danach gereiht, wie oft sie das Ziel erfüllen. Punkte für Platz 1 / 2 / 3 (`ROUND_GOAL_POINTS`):

| Runde | 1. Platz | 2. Platz | 3. Platz |
|---|---|---|---|
| 1 | 4 | 1 | 0 |
| 2 | 5 | 2 | 1 |
| 3 | 6 | 3 | 2 |
| 4 | 7 | 4 | 3 |

- **Wer 0 passende Elemente hat, bekommt nichts.** Das gilt auch dann, wenn sein Platz eigentlich Punkte bringen würde. Im Rechner bekommt so ein Spieler die Spalte „Rest“ bzw. „Other“.
- **Gleichstand:** Die gleichauf liegenden Spieler zählen die Punkte ihres Platzes und der folgenden Plätze zusammen, die sie gemeinsam belegen. Die Summe wird gleichmäßig verteilt und **abgerundet**.
- Die von einem Gleichstand belegten Plätze **entfallen** für die übrigen Spieler. Teilen sich zwei Spieler den 1. Platz, ist der nächste Spieler Dritter. Einen Zweiten gibt es dann nicht (Rangfolge „1-1-3“).

Beispiele (`scorePlacementRow`):

| Situation | Rechnung | Ergebnis |
|---|---|---|
| Runde 1, zwei Spieler gleichauf auf Platz 1 | (4 + 1) / 2 = 2,5 | je **2**, der nächste Spieler wird Dritter mit 0 Punkten |
| Runde 4, drei Spieler gleichauf auf Platz 1 | (7 + 4 + 3) / 3 = 4,67 | je **4** |
| Runde 2, ein Erster, zwei gleichauf auf Platz 2 | (2 + 1) / 2 = 1,5 | Erster **5**, Zweite je **1** |
| Runde 4, vier Spieler gleichauf auf Platz 1 | (7 + 4 + 3 + 0) / 4 = 3,5 | je **3** (nur drei Plätze bringen Punkte) |

**Gültige Belegung** (`isValidPlacementRow`): Platz *r* darf nur vergeben werden, wenn genau *r − 1* Spieler besser platziert sind. Ungültige Zeilen markiert der Rechner rot. Sie bringen 0 Punkte, bis sie korrigiert sind.

### 3.2 Blaue Seite (ohne Wettbewerb), `scoreCasualRoundGoals`

Jeder Spieler bekommt **1 Punkt pro passendem Element, höchstens 5 pro Runde**, insgesamt also maximal 20 Punkte. Die Mitspieler spielen dabei keine Rolle.

## 4. Nektar *(Ozeanien-Erweiterung)*, `scoreNectar`

- Nektar ist eine Futterart. Ausgegebener Nektar wird auf den Lebensraum gelegt, in dem er ausgegeben wurde: **Wald, Grasland oder Feuchtgebiet**.
- Nicht ausgegebener Nektar verfällt am Ende jeder Runde.
- Bei Spielende wird jeder Lebensraum einzeln gewertet: **am meisten Nektar: 5 Punkte, am zweitmeisten: 2 Punkte** (`NECTAR_POINTS`).
- Wer in einem Lebensraum keinen Nektar ausgegeben hat, bekommt dort keine Punkte.
- Gleichstände werden wie bei den Rundenzielen behandelt:
  - zwei Spieler gleichauf auf Platz 1: (5 + 2) / 2, also je **3**, und es gibt keinen zweiten Platz;
  - zwei Spieler gleichauf auf Platz 2: 2 / 2, also je **1**.

## 5. Kolibri-Leiste *(Mittel- und Südamerika, neueste Erweiterung, 2026)*

- Jeder Spieler hat eine **eigene** Kolibri-Leiste mit 5 Spalten, eine pro Kolibri-Gruppe. In jeder Spalte steht ein Marker.
- Kehrt ein Kolibri in den Kolibri-Garten zurück, rückt der passende Marker vor.
- Bei Spielende bringt jeder Marker den Wert, der neben seiner Position aufgedruckt ist. Die unteren Felder sind **negativ**, die Summe kann also auch unter 0 liegen.
- Kolibri-Karten selbst haben **keinen** Punktwert. Für Rundenziele, Bonuskarten usw. zählen sie aber als Vögel.
- Es gibt weder Mehrheiten noch Gleichstände, weil jeder nur seine eigene Leiste wertet.
- Im Rechner trägt man die Summe der fünf Werte direkt ein; negative Werte sind erlaubt (`SIGNED_CATEGORIES`).

## 6. Sieger und Gleichstand, `rankPlayers`

1. Es gewinnt, wer die meisten Punkte hat.
2. Bei Gleichstand gewinnt, wer **die meisten ungenutzten Futtermarker im eigenen Vorrat** hat.
3. Herrscht dann immer noch Gleichstand, teilen sich die Spieler den Sieg.

Der Rechner fragt die Futtermarker nur ab, wenn sie für den Sieg tatsächlich entscheidend sind (`needsTieBreaker`).

## 7. Flügelschlag Asien (Kurzüberblick, keine eigene Wertung im Rechner)

- **Duellmodus (2 Spieler):**
  - Beim Ausspielen eines Vogels legt man Duell-Marker auf eine gemeinsame Duell-Karte.
  - Am Ende bringt die größte zusammenhängende Gruppe eigener Marker 1 Punkt je Marker.
  - Dazu kommen eigene Duell-Rundenziele.
  - Im Rechner lässt sich das über die blaue Rundenziel-Seite bzw. als Bonuspunkte erfassen.
- **Schwarmmodus (6–7 Spieler):** Er hat eine eigene Zieltafel; die übrigen Kategorien bleiben gleich. Die Rundenziele trägt man hier am besten als Zahl ein (blaue Seite bzw. manuelle Eingabe).

---

## 8. Spielaufbau: Rundenziele (Aufbau-Helfer)

Umgesetzt in [`src/lib/setup/setupDraw.ts`](../src/lib/setup/setupDraw.ts):

- **Rundenziele:** Aus allen Zielplättchen der verwendeten Erweiterungen werden 4 zufällig gezogen, eines pro Runde, jeweils mit zufälliger Seite nach oben (`drawSetup`).
  - Die Plättchen aus *Flügelschlag Asien* gehören zur Duell-Karte und werden hier nicht verwendet.
  - Auf dem Ozeanien-Plättchen kann auch „Kein Ziel“ liegen.
- **Hausregel (optional): „Kein Ziel“ nur in Runde 1** (`applyHouseRules`). Wird „Kein Ziel“ für Runde 2–4 gezogen, tauscht es den Platz mit dem Ziel von Runde 1 – so wie beim Ziehen von Hand. Weil nur die Reihenfolge der ohnehin gezogenen Ziele geändert wird, kommt „Kein Ziel“ genauso oft ins Spiel wie ohne die Hausregel.

## 9. Bonuskarten: deutsche und englische Ausgabe

Einige Bonuskarten werten Begriffe in den **Vogelnamen**. Weil sich die deutschen Vogelnamen von den englischen unterscheiden, hat Feuerland diese Karten angepasst:

| Englisch | Deutsch (Feuerland) | Unterschied |
|---|---|---|
| Historian – Vögel, die nach einer Person benannt sind | **Biologe** – Vögel mit Pflanzen- oder Tiernamen | andere Bedingung |
| Photographer – 4–5 Vögel: 3 Pkt. | **Fotograf** – 4–5 Vögel: 4 Pkt. | andere Punkte |
| Anatomist (Körperteile im Namen) | **Morphologe** | andere Vögel erfüllen die Bedingung |
| Cartographer (Geografiebegriffe im Namen) | **Geograf** | andere Vögel erfüllen die Bedingung |

Je nachdem, welche Vogelkarten gemischt werden, verändert das die Häufigkeit passender Vögel stark. Feuerland empfiehlt deshalb, bestimmte Bonuskarten vor dem Mischen aus dem Spiel zu nehmen:

| Vogelkarten aus | Bonuskarten entfernen |
|---|---|
| Grundspiel, Ozeanien | Biologe, Morphologe |
| Grundspiel, Europa, Ozeanien | Geograf |
| Europa, Ozeanien | Biologe, Geograf |
| Grundspiel, Asien, Europa | Geograf, Morphologe |
| Grundspiel, Asien, Ozeanien | Biologe, Geograf |
| Grundspiel, Asien, Europa, Ozeanien | Biologe, Geograf |
| Asien, Europa | Biologe, Geograf, Morphologe |
| Asien, Ozeanien | Biologe, Fotograf, Geograf, Morphologe |
| Asien, Europa, Ozeanien | Biologe, Geograf |

Alle anderen Kombinationen brauchen keine Anpassung. *Mittel- und Südamerika* ist in der veröffentlichten Tabelle nicht berücksichtigt.

Quelle der Tabellen: Feuerland-Hinweise, zusammengetragen im Community-Projekt [wingsearch](https://github.com/navarog/wingsearch).

## 10. Gefundene Inkonsistenzen in der bisherigen App (behoben)

| Problem | Korrektur |
|---|---|
| Nektar wurde immer abgefragt, auch ohne Ozeanien-Erweiterung | Erweiterungen sind jetzt in den Spieloptionen schaltbar |
| Sieger = erster Eintrag nach Sortierung; Gleichstände wurden ignoriert | Tie-Breaker über Futtermarker, geteilter Sieg möglich |
| Die blaue Seite der Zieltafel wurde nicht unterstützt | Option „blaue Seite“: Rundenziele werden als Zahl eingegeben (max. 5 pro Runde) |
| Die Logik für Gleichstände und die Prüfung der Belegung war für Rundenziele und Nektar dreifach dupliziert und nicht getestet | eine gemeinsame, getestete Funktion für beide Wertungen |
| Ungültige Raster (z. B. 2. Platz ohne 1. Platz) brachten trotzdem Punkte | ungültige Zeilen bringen 0 Punkte und werden markiert |
| Negative oder gebrochene Eingaben wurden ungeprüft übernommen | Eingaben werden bereinigt (ganze Zahlen ≥ 0; nur die Kolibri-Leiste darf negativ sein) |
| Begriff „Wasser“ statt des offiziellen „Feuchtgebiet“ | Begriffe an die Feuerland-Ausgabe angepasst |
| Keine Obergrenze für die Spielerzahl | höchstens 7 Spieler (Schwarmmodus) |

## 11. Offene Punkte

Die offiziellen PDF-Regelhefte waren bei der Erstellung nicht direkt abrufbar. Die folgenden Punkte stammen deshalb aus Rezensionen bzw. Zusammenfassungen und sollten mit dem gedruckten Regelheft abgeglichen werden:

- die offizielle deutsche Bezeichnung der Kolibri-Zeile im Wertungsblock von *Mittel- und Südamerika*;
- die genauen Werte auf den Kolibri-Leisten (laut Rezensionen etwa −3 bis +10);
- die Punktwerte der Duell- und Schwarm-Zieltafeln aus *Flügelschlag Asien*;
- die deutschen Texte der Zielplättchen aus *Mittel- und Südamerika* und die deutschen Namen der fünf Kolibri-Gruppen (bisher eigene Übersetzungen).
