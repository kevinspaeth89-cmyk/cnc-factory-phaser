# Agentenauftrag 3 – Kundenprojekte

## Exakter Prompt zum Kopieren

> Arbeite im Repository `kevinspaeth89-cmyk/cnc-factory-phaser` auf Branch `feature/cf2-customer-projects`. Lies zuerst `docs/cnc-factory-2.0/ARCHITECTURE.md` vollständig; sie ist der verbindliche Vertrag.
>
> Implementiere ausschließlich `systems/customerProjects.js` und `tests/customerProjects.test.js`. Ändere keine anderen Dateien. Erzeuge fortlaufende Kundenprojekte mit sichtbaren Hauptphasen (mindestens Prototyp → Vorserie → Serie), während spätere mögliche Abzweigungen teilweise verdeckt bleiben. Kleine Projekte sollen weitgehend automatisch ablaufen; größere Projekte bekommen mehrere Wendepunkte und Entscheidungen mit Auswirkungen auf Produktionsmenge, erwarteten Gewinn, Risiko oder Kundenbeziehung.
>
> Exportiere browser-global und CommonJS die API `ensureState`, `create`, `getById`, `getAvailableDecision`, `chooseDecision`, `completePhase`, `tick`. Nutze stabile IDs, JSON-Zustand, absolute Spielminuten und einen im State bzw. über Optionen reproduzierbaren Zufall. Bestehende Kundenprofile samt Branche, Spielstil und Ruf sollen angenommen werden, ohne `orderMarket.js` oder `game.js` zu importieren. Eine Phasenentscheidung darf erst bei verfügbarer Entscheidung angenommen werden; doppelte Entscheidung oder Abschluss muss sicher abgewiesen werden.
>
> Gedeckelter Zufall: gute Ergebnisse verbessern, garantieren aber keinen Projektzweig. Definiere dokumentierte Unter- und Obergrenzen für Wahrscheinlichkeiten. `completePhase` liefert einen klaren Result-Descriptor für die spätere Integration; buche weder Geld noch Kundenruf selbst.
>
> Schreibe Tests mit festen Seeds. Decke sichtbare/verdeckt markierte Phasen, Prototyp/Vorserie/Serie, mehrere Entscheidungsergebnisse, Größenunterschiede, Chancenbegrenzung, stabile Wiederholbarkeit, doppelte Zustandsaufrufe, JSON-Roundtrip, unbekannte Projekt-/Phasen-IDs und fehlerhafte Entscheidung ohne Teilmutation ab.
>
> Führe `node --test tests/customerProjects.test.js` und danach `node --test tests/*.test.js` aus. Behebe Fehler in den Eigentümerdateien. Fasse Abschluss, geänderte Dateien, Tests und Integrationsannahmen knapp zusammen. Wenn der Vertrag erweitert werden müsste, halte an und melde den Vorschlag.

## Eigentümerdateien

- `systems/customerProjects.js`
- `tests/customerProjects.test.js`

## Akzeptanzkriterien

- Hauptphasen werden im Snapshot offen dargestellt; verdeckte Abzweigungen verraten keine noch nicht sichtbaren Ausgänge.
- Phasenfolge unterstützt mindestens Prototyp, Vorserie und Serie plus plausible Abzweige: größere/kleinere Serie, Sonderauftrag, Änderungswunsch oder Ende.
- Kleine Projekte erfordern wenige Entscheidungen; große Projekte bieten mehrere echte Wendepunkte.
- Projektentscheidungen zeigen vor Auswahl eine Beschreibung der Auswirkungen auf Menge, Marge, Termin-/Qualitätsrisiko und Beziehung, ohne nur einen pauschalen Geldbonus zu geben.
- Gute Leistung verschiebt Chancen innerhalb dokumentierter Grenzen, der Zufall kann trotzdem anders entscheiden.
- Jede Entscheidung und Phasenfertigstellung ist einmalig, serialisierbar und nach Reload fortsetzbar.

## Testplan

```sh
node --test tests/customerProjects.test.js
node --test tests/*.test.js
```

Pflichtfälle: Phasenanlage und Sichtbarkeit; kleine/große Projektpfade; Entscheidungen wirken wie angekündigt auf Deskriptoren; Ergebnisstreuung bleibt gedeckelt und reproduzierbar; doppelte Ereignisse; ungültige Entscheidung ohne Mutation; Save/Reload-Fortsetzung; `ensureState` idempotent.
