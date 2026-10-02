# Agentenauftrag 5 – Mitarbeiterentwicklung und Integration/UI

## Exakter Prompt zum Kopieren

> Arbeite im Repository `kevinspaeth89-cmyk/cnc-factory-phaser` auf Branch `feature/cf2-employee-ui-integration`. Lies zuerst `docs/cnc-factory-2.0/ARCHITECTURE.md` vollständig. Behandle dessen gemeinsame Verträge als verbindlich. Prüfe zusätzlich die APIs und Eigentümerdateien der Pakete 1–4 in `integration/cnc-factory-2.0`; integriere erst, wenn sie verfügbar sind. Entwickle bis dahin gegen schmale lokale Test-Doubles in deinen Tests, nicht gegen abweichende API-Verträge.
>
> Implementiere das Modul `systems/employeeDevelopment.js` und `tests/employeeDevelopment.test.js`; integriere danach die fünf Systeme in `game.js`, `index.html` und bei Bedarf `styles.css`. Du bist alleiniger Eigentümer aller UI- und Integrationsänderungen. Verändere Kernlogik der Module aus Paket 1–4 nicht. Halte bestehende Abläufe, Legacy-Aufträge, vorhandene Mitarbeiterwerte und Save-Key `cnc_factory_save_v3` kompatibel.
>
> Die Mitarbeiter-API ist `ensureState`, `getAvailableSpecializations`, `assignSpecialization`, `getEffects`. Höchstens zwei Spezialisierungen pro Mitarbeiter; erste Freischaltung früh, zweite deutlich später. Persönlichkeit begrenzt/verändert die verfügbaren Spezialisierungen. Boni sind spürbar und fachbezogen, aber keine Spezialisierung darf Mitarbeiter außerhalb des Gebiets nutzlos machen.

Verwende die Adapter-APIs aus Abschnitt 6 der Architektur. Produktionsaufträge werden nach Vorabprüfung mit `productionFlow.addOrder` gespeichert; Stationsarbeit startet über `startNext` und Produktionsabschlüsse über `completeStep`. Zeige `estimateRestartSetup` vor einer Rush-Unterbrechung an und verknüpfe `interrupt`/`resume` mit dem gespeicherten Maschinenauftrag. Für Fremdvergabe arbeite nur mit einem expliziten Routenschritt `{ type: 'external', operationType, requiredMachineKind: null }`: erst `suppliers.quote(..., { routeStep, routeStepId, lotId, operationType, qty, atMinute })`, dann den exakten Quote mit `suppliers.outsource(..., atMinute, { quoteId, lotId })` annehmen, den Job mittels `productionFlow.outsourceLot` an dasselbe Los heften und nach erfolgreichem `suppliers.completeJob` mit `productionFlow.completeOutsourcedStep` freigeben. Jobzahlung, Erfolgsmarker und ein vorübergehend fehlgeschlagener Flow-Übergang müssen über Save/Reload genau einmal bzw. wiederholbar sein.

`customerProjects.tick(state, atMinute, { blockedProjectIds })` muss alle Projekte blockieren, deren verknüpfte Auftragslose noch nicht `completed` oder `cancelled` sind; die Projektphase wird erst nach Abschluss aller Lose über `completePhase` beendet. Sonderlagen werden mit der aktuellen absoluten Spielminute abgefragt: Materialpreis wirkt bei Preis/Kauf, Kapazität beim Planen angenommener Lose, Nachfrage über den optionalen `demandFactor`-Parameter von `orderMarket.tick` und Produktionszeit dynamisch nur während der aktiven Lage. Im angenommenen Auftrag gespeicherte `situationEffects` und `activeSituationModifierIds` sind der damalige Snapshot für Anzeige/Planung; der Zeitfaktor bleibt nicht nach Ereignisende aktiv.
>
> Lade neue Module vor `game.js`. Migriere alte Saves idempotent und speichere Module im bestehenden Save. Schließe Produktionsketten an Maschinen und Arbeitsgänge an, aktualisiere den Auftragssnapshot beim Annehmen, verbinde Zulieferjobs mit Teillos/Route, aktualisiere Projektphasen und Entscheidungen, wende Spezialaufträge und aktive Lagen an und zeige persönliche Spezialisierungen. Finanzbuchungen laufen durch `CNCModules.economy.book` genau einmal. UI muss Priorität, Teillose, Route, externe Vergabe, Projektphasen, aktive Lage, Mitarbeiterboni und die Folgen riskanter Entscheidungen verständlich zeigen. Risiken sowie Wiederanlaufrüstzeit stehen vor Bestätigung. Bestehende Navigation und mobile Bedienbarkeit erhalten. Deine einzige erlaubte Änderung an einem bestehenden Systemmodul ist die in Abschnitt 6 definierte optionale `demandFactor`-Erweiterung von `systems/orderMarket.js` samt `tests/orderMarket.test.js`; ändere keine weiteren Dateien aus Paket 1–4.
>
> Schreibe Integrationstests in der bestehenden Konvention; ergänze `tests/gameIntegration.test.js` nur bei Bedarf. Decke alten Spielstand, neuen Spielstart und Reload ab. Prüfe eine gemischte Route mit 120 Teilen einschließlich Mengenbilanz, priorisierten Teillosen, gestaffelter Stationsarbeit, besetzter QS-Zeit und Reload; prüfe, dass der Gesamtlohn über die Lose genau einmal gebucht wird. Decke ein externes Los mit exaktem Quote, einmaliger Zahlung, Lieferung und Freigabe in die Folgestation ab. Prüfe Projektentscheidung sowie ein kleines, mit einem noch laufenden Auftrag verknüpftes Projekt, dessen Phase erst nach allen Losen fortschreitet. Prüfe eine aktive Sonderlage während und nach ihrer Laufzeit, `demandFactor` auf dem Auftragsmarkt, eine im UI erzeugte Spezialbestellung, Mitarbeiter-Spezialisierung über die UI und UI-Elemente/Script-Ladereihenfolge. Ergänze einen Unterbrechungs-/Wiederaufnahmefall, der die gespeicherte Wiederanlaufrüstzeit nach Reload abdeckt.
>
> Führe `node --test tests/employeeDevelopment.test.js`, danach die nötigen betroffenen Integrationstests und abschließend `node --test tests/*.test.js` aus. Korrigiere Fehler in deinen Eigentümerdateien. Berichte geänderte Dateien, Tests, Save-Migrationsverhalten und offene Abnahmefragen. Wenn eine API der Pakete 1–4 abweicht, passe den Adapter nur nach gemeinsamer Vertragsklärung an.

## Eigentümerdateien

- `systems/employeeDevelopment.js`
- `tests/employeeDevelopment.test.js`
- `game.js`
- `index.html`
- `styles.css` nur falls im aktuellen Repo vorhanden
- `tests/gameIntegration.test.js` nur wenn Integrationstests ergänzt werden müssen
- `systems/orderMarket.js` ausschließlich für die optionale Nachfragefaktor-Erweiterung von `tick`
- `tests/orderMarket.test.js` für deren Erweiterungstest

## Akzeptanzkriterien

- Persönlichkeitsspezialisierungen passen zu vorhandenen Mitarbeiterprofilen und ergänzen deren Skillwerte.
- Erste Spezialisierung wird früher als die zweite freigeschaltet; maximal zwei, doppelte Vergabe unmöglich.
- Alte Saves migrieren ohne Reset von Geld, Ruf, Maschinen, Aufträgen, Erfahrung oder Speicher-Key.
- Neue Script-Tags laden vor `game.js`; Node-Tests können das Modul ohne Browser laden.
- Angebot → Planung → Produktion → QS/Abschluss funktioniert für gemischte Route, einschließlich Losmenge und Priorität.
- Fremdvergabe kann fehlende Operationen abdecken; Angebote, Zahlungen und Resultate werden genau einmal verarbeitet.
- Projekt- und Ereignisentscheidungen sind im passenden Spielzustand sichtbar und nach Reload konsistent; kleine Projekte warten bei verknüpften laufenden Auftragslosen mit automatischen Phasenwechseln.
- Ein Zulieferjob verwendet dasselbe Quote, Los und dieselbe Routenstufe bei Beauftragung und Lieferung; ausstehende Statuswechsel sind nach Reload wiederholbar, ohne Geld doppelt zu buchen.
- Nachfragefaktoren beeinflussen nur künftige Angebotsintervalle während der aktiven Lage; der Standardwert `1` erhält das bisherige orderMarket-Verhalten. Zeitfaktoren gelten nur während der Lage.
- UI kommuniziert geschätzte Liefer-/Rüstzeit, Risiko und Folgen vor der Entscheidung; die bestehende Bedienung bleibt nutzbar.
- Der Integrationspfad dupliziert keine Moduleffekte und bucht Geld genau einmal.

## Testplan

```sh
node --test tests/employeeDevelopment.test.js
node --test tests/gameIntegration.test.js
node --test tests/*.test.js
```

Pflichtfälle: Persönlichkeit → verfügbare Spezialisierungen; Freischaltgrenzen; zweite/duplizierte Zuweisung; Effekte innerhalb definierter Grenzen; bestehender `gameIntegration.test.js`-Boot-Harness; Script-Reihenfolge und alle neuen UI-IDs; Alt-Save migrieren/reloaden; 120-Teile-Route mit Teillosen, externer Station, staffed QS und einmaliger Gesamtzahlung; exakter Zuliefer-Quote/Job-Übergabe über Reload; projektbezogener Small-Project-Blocker bis zum Abschluss aller Auftragslose; laufzeitgebundene Sonderlagen und Nachfragefaktor; Spezialauftrag-Button, Projektentscheidung und Mitarbeiter-Spezialisierung tatsächlich über UI-Aktionen; Unterbrechung, gespeicherte Wiederanlaufrüstzeit und Fortsetzung nach Reload.
