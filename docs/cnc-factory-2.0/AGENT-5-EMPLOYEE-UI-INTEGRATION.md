# Agentenauftrag 5 – Mitarbeiterentwicklung und Integration/UI

## Exakter Prompt zum Kopieren

> Arbeite im Repository \`kevinspaeth89-cmyk/cnc-factory-phaser\` auf Branch \`feature/cf2-employee-ui-integration\`. Lies zuerst \`docs/cnc-factory-2.0/ARCHITECTURE.md\` vollständig. Behandle dessen gemeinsame Verträge als verbindlich. Prüfe zusätzlich die APIs und Eigentümerdateien der Pakete 1–4 in \`integration/cnc-factory-2.0\`; integriere erst, wenn sie verfügbar sind. Entwickle bis dahin gegen schmale lokale Test-Doubles in deinen Tests, nicht gegen abweichende API-Verträge.
>
> Implementiere das Modul \`systems/employeeDevelopment.js\` und \`tests/employeeDevelopment.test.js\`; integriere danach die fünf Systeme in \`game.js\`, \`index.html\` und bei Bedarf \`styles.css\`. Du bist alleiniger Eigentümer aller UI- und Integrationsänderungen. Verändere Kernlogik der Module aus Paket 1–4 nicht. Halte bestehende Abläufe, Legacy-Aufträge, vorhandene Mitarbeiterwerte und Save-Key \`cnc_factory_save_v3\` kompatibel.
>
> Die Mitarbeiter-API ist \`ensureState\`, \`getAvailableSpecializations\`, \`assignSpecialization\`, \`getEffects\`. Höchstens zwei Spezialisierungen pro Mitarbeiter; erste Freischaltung früh, zweite deutlich später. Persönlichkeit begrenzt/verändert die verfügbaren Spezialisierungen. Boni sind spürbar und fachbezogen, aber keine Spezialisierung darf Mitarbeiter außerhalb des Gebiets nutzlos machen.
>
> Lade neue Module vor \`game.js\`. Migriere alte Saves idempotent und speichere Module im bestehenden Save. Schließe Produktionsketten an Maschinen und Arbeitsgänge an, aktualisiere den Auftragssnapshot beim Annehmen, verbinde Zulieferjobs mit Teillos/Route, aktualisiere Projektphasen und Entscheidungen, wende Spezialaufträge und aktive Lagen an und zeige persönliche Spezialisierungen. Finanzbuchungen laufen durch \`CNCModules.economy.book\` genau einmal. UI muss Priorität, Teillosmodus, Route, externe Vergabe, Projektphasen, aktive Lage, Mitarbeiterboni und die Folgen riskanter Entscheidungen verständlich zeigen. Risiken sowie Wiederanlaufrüstzeit stehen vor Bestätigung. Bestehende Navigation und mobile Bedienbarkeit erhalten.
>
> Schreibe Integrationstests in der bestehenden Konvention; ergänze \`tests/gameIntegration.test.js\` nur bei Bedarf. Decke alten Spielstand, neuen Spielstart, Reload, einmalige Zahlung, gemischte Route mit 120 Teilen, Fremdvergabe-/Lieferung, Projektentscheidung, aktive Situation, Spezialisierungsauswahl und UI-Elemente/Script-Ladereihenfolge ab.
>
> Führe \`node --test tests/employeeDevelopment.test.js\`, danach die nötigen betroffenen Integrationstests und abschließend \`node --test tests/*.test.js\` aus. Korrigiere Fehler in deinen Eigentümerdateien. Berichte geänderte Dateien, Tests, Save-Migrationsverhalten und offene Abnahmefragen. Wenn eine API der Pakete 1–4 abweicht, passe den Adapter nur nach gemeinsamer Vertragsklärung an.

## Eigentümerdateien

- \`systems/employeeDevelopment.js\`
- \`tests/employeeDevelopment.test.js\`
- \`game.js\`
- \`index.html\`
- \`styles.css\` nur falls im aktuellen Repo vorhanden
- \`tests/gameIntegration.test.js\` nur wenn Integrationstests ergänzt werden müssen

## Akzeptanzkriterien

- Persönlichkeitsspezialisierungen passen zu vorhandenen Mitarbeiterprofilen und ergänzen deren Skillwerte.
- Erste Spezialisierung wird früher als die zweite freigeschaltet; maximal zwei, doppelte Vergabe unmöglich.
- Alte Saves migrieren ohne Reset von Geld, Ruf, Maschinen, Aufträgen, Erfahrung oder Speicher-Key.
- Neue Script-Tags laden vor \`game.js\`; Node-Tests können das Modul ohne Browser laden.
- Angebot → Planung → Produktion → QS/Abschluss funktioniert für gemischte Route, einschließlich Losmenge und Priorität.
- Fremdvergabe kann fehlende Operationen abdecken; Angebote, Zahlungen und Resultate werden genau einmal verarbeitet.
- Projekt- und Ereignisentscheidungen sind im passenden Spielzustand sichtbar und nach Reload konsistent.
- UI kommuniziert geschätzte Liefer-/Rüstzeit, Risiko und Folgen vor der Entscheidung; die bestehende Bedienung bleibt nutzbar.
- Der Integrationspfad dupliziert keine Moduleffekte und bucht Geld genau einmal.

## Testplan

\`\`\`sh
node --test tests/employeeDevelopment.test.js
node --test tests/gameIntegration.test.js
node --test tests/*.test.js
\`\`\`

Pflichtfälle: Persönlichkeit → verfügbare Spezialisierungen; Freischaltgrenzen; zweite/duplizierte Zuweisung; Effekte innerhalb definierter Grenzen; bestehender \`gameIntegration.test.js\`-Boot-Harness; Script-Reihenfolge und alle neuen UI-IDs; Alt-Save migrieren/reloaden; einmalige Geldbuchung; Ende-zu-Ende-Route mit Teillosen, externer Station und QS; Projekt-/Eventzustände in UI.
