# Agentenauftrag 4 – Spezialaufträge und Markt-/Betriebslagen

## Exakter Prompt zum Kopieren

> Arbeite im Repository `kevinspaeth89-cmyk/cnc-factory-phaser` auf Branch `feature/cf2-special-orders-situations`. Lies zuerst `docs/cnc-factory-2.0/ARCHITECTURE.md` vollständig; sie ist der verbindliche Vertrag.
>
> Implementiere ausschließlich `systems/factorySituations.js` und `tests/factorySituations.test.js`. Ändere keine anderen Dateien. Das Modul verwaltet gelegentliche Spezialaufträge sowie seltene mehrtägige Markt-/Betriebslagen. Spezialaufträge sollen zwei oder drei klar erklärte Mechaniken kombinieren, etwa komplexe Route, Präzision, kleine Lose, kurze Frist oder fehlende Maschine. Verwende Kundenprofile als Einfluss auf Auftragstyp und Schwierigkeit.
>
> Exportiere browser-global und CommonJS die API `ensureState`, `generateSpecialOrder`, `tick`, `getActiveModifiers`, `applyModifiers`, `getSnapshot`. Nutze absolute Spielminuten, stabile IDs, seedbaren Zufall, JSON-Speicher und idempotente Zeitübergänge. `applyModifiers` muss einen Auftrag kopieren, ihn nicht mutieren und auch unbekannte Modifier gefahrlos ignorieren. Keine globalen Timer, DOM- oder Phaser-Abhängigkeiten.
>
> Ereignisse wie Materialpreissprung, Werkzeugengpass, Nachfrageboom und Personalausfall sind selten, dauern mehrere Spieltage und haben klare Start-, Ablauf- und Auswirkungsdaten. Zufallswahrscheinlichkeiten und Effektstärken müssen begrenzt sein. Das Modul beschreibt Preise, Kapazitäts-/Zeitfaktoren und Warnungen, führt aber keine Buchungen oder direkte Änderungen an Lager, Personal, Maschinen oder Kundenruf aus; diese Effekte verbindet Paket 5.
>
> Schreibe Tests mit festen Seeds. Prüfe Seltenheit über deterministische Wahrscheinlichkeits-/Grenzwerte statt flaky Häufigkeitstests; überprüfe Datumskanten, Dauer, Auslaufen, inaktives Verhalten, Modifikatorenkopie, Kundenprofile, 2–3 Mechaniken, JSON-Roundtrip und wiederholte Ticks.
>
> Führe `node --test tests/factorySituations.test.js` und danach `node --test tests/*.test.js` aus. Behebe Fehler in den Eigentümerdateien. Fasse Abschluss, geänderte Dateien, Tests und Integrationsannahmen knapp zusammen. Wenn der Vertrag erweitert werden müsste, berichte den Vorschlag, statt Integrationsverhalten in dieses Modul zu verlagern.

## Eigentümerdateien

- `systems/factorySituations.js`
- `tests/factorySituations.test.js`

## Akzeptanzkriterien

- Kundentyp beeinflusst Auswahl und Intensität eines Spezialauftrags; die Basismenge an Optionen bleibt nachvollziehbar.
- Jeder Spezialauftrag zeigt genau zwei oder drei besondere Mechaniken aus einem kontrollierten Katalog.
- Ereignisse sind mit Seed reproduzierbar, selten, mehrere Spieltage aktiv und in der Snapshot-Ausgabe mit Auswirkungen und Restdauer sichtbar.
- `tick` über Ereignisbeginn/-ende ist idempotent; es gibt keine doppelte Auslösung nach Save/Reload.
- Modifier lassen sich anwenden und entfernen, ohne Ausgangsauftrag oder unbekannte Felder zu zerstören.
- Ereignisse liefern beschreibende Effekte an Paket 5; keine direkte Kassen-, Lager- oder Maschinenmutation.

## Testplan

```sh
node --test tests/factorySituations.test.js
node --test tests/*.test.js
```

Pflichtfälle: Spezialauftrag mit 2–3 Mechaniken je Kundenprofil; Randwerte für Modifier; Event nicht aktiv vor Start/nach Ende; mehrtägige Dauer; Material-/Werkzeug-/Nachfrage-/Personallagen; Duplicate Tick; Seed-Reproduzierbarkeit; apply-Kopie und JSON-Roundtrip.
