# Agentenauftrag 2 – Zulieferer und Fremdvergabe

## Exakter Prompt zum Kopieren

> Arbeite im Repository `kevinspaeth89-cmyk/cnc-factory-phaser` auf Branch `feature/cf2-suppliers-outsourcing`. Lies zuerst `docs/cnc-factory-2.0/ARCHITECTURE.md` vollständig; sie ist der verbindliche Vertrag.
>
> Implementiere ausschließlich `systems/suppliers.js` und `tests/suppliers.test.js`. Ändere keine anderen Dateien. Entwickle feste Zulieferer plus gelegentlich freischaltbare Anbieter, Angebote für externe Arbeitsgänge, unbekannte anfangs nur als Bandbreite sichtbare Zuverlässigkeit, Lieferzeiten und Qualitätsrisiko. Bessere Anbieter werden durch Firmenruf verfügbar. Externe Jobs müssen Teillos-/Auftrags-/Routenstufen-IDs referenzieren und nach Liefertermin kontrolliert abgeschlossen werden können.
>
> Exportiere browser-global und CommonJS die API `ensureState`, `listProviders`, `quote`, `outsource`, `tick`, `completeJob`, `recordOutcome`. Halte Modulzustand JSON-serialisierbar und nutze absolute Spielminuten. Die API darf weder DOM noch Phaser noch `game.js` importieren. Geldbewegungen erfolgen ausschließlich in der späteren Integration über `CNCModules.economy.book`; buche selbst kein Geld.
>
> Tests müssen mit festen Seeds reproduzierbar sein und Anbieterfreischaltung, Angebotsbandbreiten, Annahme/Verbrauch, Zeitablauf, verspätete/fehlerhafte/erfolgreiche Lieferung, gelernte Zuverlässigkeit, Rufgrenzen, Migration/JSON-Roundtrip und ungültige Anfrage ohne Teilmutation abdecken. Agent 1s Produktionsmodul steht auf diesem Branch nicht voraus; verwende nur IDs und übergebene Orderdaten, keine versteckten Importe.
>
> Führe `node --test tests/suppliers.test.js` und danach `node --test tests/*.test.js` aus. Behebe Fehler in den Eigentümerdateien. Fasse Abschluss, geänderte Dateien, Tests und Integrationsannahmen knapp zusammen. Wenn der gemeinsame Vertrag erweitert werden muss, berichte erst den Vorschlag.

## Eigentümerdateien

- `systems/suppliers.js`
- `tests/suppliers.test.js`

## Akzeptanzkriterien

- Anbieter besitzen stabile IDs, unterstützte Arbeitsgänge, Rufschwellen, Preis-/Zeit-/Qualitätsparameter und einen Lernzustand.
- Bei unbekannter Zuverlässigkeit wird ein plausibles Intervall angezeigt; nach abgewickelten Aufträgen wird es nachvollziehbar enger.
- Ein Angebot ist deterministisch aus Seed und Eingabe ableitbar und enthält Kosten, Lieferzeit, Qualitätsrisiko sowie Ablauf-/Terminangaben.
- `outsource` verhindert doppeltes Vergeben derselben Job-ID und lehnt fehlende Fähigkeiten, Menge ≤ 0 und unzulässige Anbieter ab.
- `tick` nutzt absolute Spielzeit, ist idempotent und unterscheidet pünktlich, verspätet und überfällig.
- Qualitätsresultate können Nacharbeit/Reklamation markieren; Ruf und Finanzbuchhaltung bleiben beim Aufrufer.
- Alte Saves ohne `state.suppliers` erhalten einen gültigen Anfangszustand.

## Testplan

```sh
node --test tests/suppliers.test.js
node --test tests/*.test.js
```

Pflichtfälle: Anbieter nach Ruf filtern/freischalten; feste und unbekannte Zuverlässigkeitsspanne; Angebot wiederholbar; Auslagerung einmalig; Fortschritt und Fälligkeit mit absoluter Spielzeit; Outcome verändert gelernte Zuverlässigkeit; JSON-Roundtrip und Legacy-Migration; Ablehnungen ohne Zustandsänderung.
