# Agentenauftrag 1 – Produktionsketten

## Exakter Prompt zum Kopieren

> Arbeite im Repository `kevinspaeth89-cmyk/cnc-factory-phaser` auf Branch `feature/cf2-production-flow`. Lies zuerst `docs/cnc-factory-2.0/ARCHITECTURE.md` vollständig; sie ist der verbindliche Vertrag.
>
> Implementiere ausschließlich `systems/productionFlow.js` und `tests/productionFlow.test.js`. Ändere keine anderen Dateien. Implementiere Produktionsrouten mit maximal vier Schritten, automatische Freigabe in Stationswarteschlangen, Teillose in `auto/small/normal/large`, Priorität `low/normal/high`, Unterbrechung und Wiederaufnahme samt geschätzter Wiederanlaufrüstzeit. Das Modul muss Browser-global und per CommonJS nutzbar, DOM-frei, deterministisch, save-kompatibel und idempotent sein.
>
> Nutze exakt die API `ensureState`, `createPlan`, `setPriority`, `interrupt`, `resume`, `completeStep`, `tick` und `getSnapshot` mit der im Architekturdokument beschriebenen Semantik. Bewahre alle vorhandenen Auftragsfelder; mutiere Eingabeaufträge in `createPlan` nicht. Gleiche Prioritäten müssen stabil sortiert werden. Laufende Arbeit darf nicht automatisch verdrängt werden. Die Wiederanlaufrüstzeit darf höchstens 50 % der vollen Rüstzeit betragen und muss vor einer Unterbrechung berechenbar sein.
>
> Schreibe aussagekräftige Tests mit festem Seed bzw. ohne Zufallsabhängigkeit. Decke Mengenbilanz, Routenlänge, Losaufteilung, Queue-Reihenfolge, Statusübergänge, Unterbrechungs-/Wiederaufnahmezeit, wiederholte Initialisierung, JSON-Roundtrip und fehlerhafte Eingaben ohne Teilmutation ab. Bestehende Auftragsdaten und Legacy-Auftragssemantik müssen erhalten bleiben.
>
> Führe `node --test tests/productionFlow.test.js` und danach `node --test tests/*.test.js` aus. Behebe Fehler in den Eigentümerdateien. Fasse Abschluss, geänderte Dateien, Tests und verbleibende Integrationsannahmen knapp zusammen. Wenn ein Vertrag geändert werden müsste, halte an und melde den Vorschlag, statt abweichende Felder einzuführen.

## Eigentümerdateien

- `systems/productionFlow.js`
- `tests/productionFlow.test.js`

## Akzeptanzkriterien

- 120 Stück werden ohne Mengenverlust/-duplikat über eine Route wie Drehen → Fräsen → QS in stabile Teillose verteilt.
- `auto` liefert deterministisch eine gültige Losgröße; alle drei manuellen Modi sind unterscheidbar, Summe bleibt exakt `order.qty`.
- Freigegebene Lose warten automatisch auf die nächste passende Station. Statuswechsel sind nur in zulässiger Reihenfolge möglich.
- Priorität sortiert wartende Arbeit hoch/normal/niedrig; Gleichstände bleiben stabil. Laufende Lose bleiben unangetastet.
- Unterbrechung speichert Maschine, Menge und Zeit; Wiederaufnahme addiert berechenbare Zusatzrüstzeit bis maximal 50 %.
- `getSnapshot` ist schreibgeschützt und enthält Queue-Größen sowie wartende Teillose zur späteren Engpassanzeige.
- Altaufträge ohne 2.0-Felder funktionieren weiterhin; zweimaliges `ensureState` erzeugt keine Duplikate.

## Testplan

```sh
node --test tests/productionFlow.test.js
node --test tests/*.test.js
```

Pflichtfälle: deterministische Teillose und Summenbilanz; Route mit 1–4 Schritten und Ablehnung von 5; Priorität und FIFO bei Gleichstand; Queue-Freigabe nach Abschluss; Interrupt/Resume mit einfacher und maximal empfindlicher Arbeit; ungültige Priorität/ID ohne Teilmutation; Wiederholung von `ensureState`; JSON serialisieren, wiederherstellen, fortsetzen.
