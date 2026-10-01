# CNC Factory 2.0 – gemeinsame Architektur

**Status:** Arbeitsgrundlage für fünf parallele Feature-Agenten  
**Repo:** \`kevinspaeth89-cmyk/cnc-factory-phaser\`  
**Zielplattform:** bestehendes Phaser-Browser-Spiel, JavaScript ohne Build-Schritt  
**Stand:** 1. Oktober 2026

## 1. Ziel und Grenzen

Diese Spezifikation legt Datenmodelle, Modulverträge, Zuständigkeiten, Branches und Abnahmeregeln für CNC Factory 2.0 fest. Sie implementiert keine der Spielmechaniken.

Die Umsetzung soll normale Aufträge übersichtlich halten und Abwechslung über gelegentliche Spezialfälle schaffen, die meist zwei oder drei Systeme verbinden. Komplexität wächst mit Firmenfortschritt und Ruf. Ein Fehler bei einem normalen Auftrag bleibt meist verkraftbar; große Projekte und risikoreiche Entscheidungen können stärkere, vorher sichtbare Folgen haben.

Zwischenlager bleiben unbegrenzt. Es gibt keinen künstlich festgelegten Engpass: Die aktuelle Warteschlange, Kapazität, Rüstzeit oder QS kann den Engpass bilden. Kundenprofile prägen die angebotenen Auftragsarten; normale Serien bleiben auch später relevant.

## 2. Repo-Konventionen und Integrationsregeln

Das Spiel lädt klassische Browser-Skripte aus \`index.html\`. Systemmodule liegen unter \`systems/\`, hängen ihre API als \`CNCModules.<name>\` an \`globalThis\` und exportieren dieselbe API über CommonJS. Tests laufen mit Node.js und \`node --test\`; es gibt keinen Build-Schritt als Voraussetzung.

Jedes neue Systemmodul muss:

- unter \`systems/<name>.js\` liegen und ohne DOM/Phaser importierbar sein;
- ausschließlich JSON-serialisierbaren Spielzustand speichern;
- Spielzeit in absoluten \`state.gameMinutes\` verwenden, nie reale Zeit;
- Migrationen idempotent ausführen und bestehende Spielstände erhalten;
- Zufall über injizierbare Seeds/Quellen reproduzierbar machen;
- Fehler als Rückgabewert wie \`{ ok: false, code: '...' }\` ausdrücken, statt halbe Zustandsänderungen zu hinterlassen;
- weder \`game.js\` noch \`index.html\` verändern, außer der Integrations-/UI-Agent in Paket 5;
- keine bestehenden Module oder deren öffentliche APIs umbenennen.

Die bestehenden orderMarket-Felder wie \`id\`, \`customer\`, \`part\`, \`partKey\`, \`kind\`, \`qty\`, \`duration\`, \`reward\`, \`deadlineHours\`, \`materialType\` und \`materialAmountKg\` bleiben gültig. Neue Felder ergänzen sie. Die persistente Save-ID \`cnc_factory_save_v3\` bleibt unverändert.

## 3. Gemeinsame Terminologie und Enumerationen

| Feld | Erlaubte Werte |
| --- | --- |
| \`routing[].type\` | \`turning\`, \`milling\`, \`quality\`, \`assembly\`, \`external\` |
| \`routing[].status\` | \`blocked\`, \`queued\`, \`running\`, \`completed\`, \`cancelled\` |
| \`priority\` | \`low\`, \`normal\`, \`high\` |
| \`batchMode\` | \`auto\`, \`small\`, \`normal\`, \`large\` |
| \`lot.status\` | \`waiting\`, \`queued\`, \`running\`, \`completed\`, \`outsourced\`, \`cancelled\` |
| \`supplier.status\` | \`available\`, \`unknown\`, \`suspended\` |
| \`project.phaseStatus\` | \`locked\`, \`available\`, \`active\`, \`completed\`, \`skipped\`, \`failed\` |
| \`situation.status\` | \`scheduled\`, \`active\`, \`ended\` |

IDs sind stabile Strings. Zeitfelder heißen \`*AtMinute\` oder \`*Minutes\` und sind Zahlen in der Spielzeitskala.

## 4. Gemeinsames Order- und Produktionsmodell

Ein Marktauftrag ist weiterhin das bestehende Order-Objekt. Folgende Erweiterungen sind der gemeinsame Vertrag:

\`\`\`js
{
  id: 'OM-0042',                    // vorhandene stabile Auftrags-ID
  customer: 'Kaeldor Components',   // bestehendes Feld
  partKey: 'mill-prism',             // bestehendes Feld, falls vorhanden
  kind: 'Fräsen',                    // Legacy-Hauptoperation, erhalten
  qty: 120,                          // Auftragsgesamtmenge
  duration: 150,                     // Legacy-Zyklusdauer pro Stück
  reward: 24000,                     // Gesamtvergütung, Legacy-Semantik erhalten
  materialType: 'aluminium6082',
  materialAmountKg: 72,
  routing: [
    { id: 'step-1', type: 'turning', requiredMachineKind: 'Drehen', status: 'queued' },
    { id: 'step-2', type: 'milling', requiredMachineKind: 'Fräsen', status: 'blocked' },
    { id: 'step-3', type: 'quality', requiredMachineKind: null, status: 'blocked' }
  ],
  batchMode: 'auto',
  effectiveBatchMode: 'normal',
  priority: 'normal',
  interruptionSensitivity: 0.7,     // dimensionslos 0..1
  projectId: null,
  modifiers: [],
  outsourcing: []
}
\`\`\`

Für jeden Schritt werden zusätzliche Fortschrittsfelder ergänzt, wenn sie gebraucht werden: \`qtyTotal\`, \`qtyCompleted\`, \`queueEnteredAtMinute\`, \`startedAtMinute\`, \`completedAtMinute\`, \`setupMinutes\` und \`restartSetupMinutes\`. Unbekannte Felder beim Laden bleiben erhalten.

Ein Teillos ist ein eigener persistenter Datensatz mit \`id\`, \`orderId\`, \`routeStepId\`, \`sequence\`, \`qty\`, \`qtyCompleted\`, \`status\`, \`priority\` und Spielzeitstempeln. Für jede Auftragsstufe gilt: Summe der Teillosmengen ist exakt \`order.qty\`; ein Teillos kann nur in die nächste Stufe wechseln, wenn seine aktuelle Stufe abgeschlossen ist. Die Aufteilung muss stabil und deterministisch sein; ein kleiner Rest wird dem letzten Los zugeschlagen.

\`auto\` wählt anhand von Auftragsmenge und Fabrikkapazität eine passende Größe. Der Spieler kann stattdessen \`small\`, \`normal\` oder \`large\` wählen. Kleine Lose verkürzen die Wartezeit bis zur ersten Folgeoperation, erhöhen aber die Zahl möglicher Unterbrechungen und Wiederanläufe. Die konkrete Balance bleibt konfigurierbar und wird in Tests über Invarianten statt über UI-Texte abgesichert.

Prioritäten gelten auf Ebene des Auftrags und werden auf noch nicht gestartete Lose übertragen. Warteschlangen sortieren nach Priorität \`high > normal > low\`; Gleichstände bleiben fair und stabil nach Eingangszeit, Routenposition und ID. Laufende Arbeit wird nicht ohne explizite Unterbrechungsentscheidung verdrängt.

Bei einer Wiederaufnahme gilt \`restartSetupMinutes = setupMinutes * interruptionSensitivity * restartSetupFraction\`, wobei \`restartSetupFraction\` konfigurierbar und höchstens \`0.5\` ist. Die UI muss die geschätzte Folge vor einer Unterbrechungsentscheidung zeigen. Für einfache Teile ist die Sensitivität niedrig; komplexe Präzisionsteile dürfen bis zu 30–50 % einer vollständigen Rüstzeit erneut benötigen.

## 5. Persistenz, Save-Migration und Zufall

Jedes Modul besitzt einen eigenen Top-Level-Zustand und eine Versionsnummer. Modulinitialisierung repariert fehlende Felder, migriert bekannte Altformen und darf bei zweimaligem Aufruf keine Duplikate erzeugen:

- \`state.productionFlow = { version, lots, queues, events }\`
- \`state.suppliers = { version, providers, jobs, history }\`
- \`state.customerProjects = { version, projects, decisions, nextProjectNumber }\`
- \`state.factorySituations = { version, active, history, randomState }\`
- \`state.employeeDevelopment = { version }\`; Spezialisierungsdaten liegen am Mitarbeiterobjekt unter \`specializations[]\`

Zeitabhängige Prozesse laufen in \`tick(state, absoluteGameMinutes)\`. Mehrfaches Ticken zum selben Zeitpunkt ist idempotent. Seed-basierter Zufall wird vollständig im JSON-Zustand gespeichert oder über eine injizierte Zufallsquelle reproduzierbar gemacht. Es darf keine globale Zufallsquelle mutiert werden.

Die Integrationsarbeit ruft Migrationen nach dem bestehenden Laden/Erstellen des Spielstands und vor der Simulation auf. Alte Spielstände ohne 2.0-Felder starten mit leeren Systemzuständen; laufende Legacy-Aufträge behalten ihre bestehende Bedeutung.

## 6. Modulgrenzen und öffentliche APIs

Jedes Modul erhält Tests, die seine API direkt über \`require('../systems/<name>.js')\` laden. Die genannten Signaturen sind verbindlich; Agenten dürfen optionale Parameter hinzufügen, aber Namen und Rückgabegrundform nicht ändern.

### Paket 1 – Produktionsketten: \`CNCModules.productionFlow\`

- \`ensureState(state)\`
- \`createPlan(order, options?)\` → normalisierter Routen-/Losplan, ohne den Eingabeauftrag zu mutieren
- \`setPriority(state, orderId, priority)\` → \`{ ok, code?, order? }\`
- \`interrupt(state, lotId, machineId, atMinute)\`
- \`resume(state, lotId, machineId, atMinute)\`
- \`completeStep(state, lotId, routeStepId, atMinute)\`
- \`tick(state, absoluteGameMinutes)\`
- \`getSnapshot(state)\`

Dieses Modul verwaltet Routen, Teillose, Warteschlangen, Priorität und Wiederanlauf-Schätzung. Es führt keine DOM-, Phaser-, Geld-, Anbieter- oder Mitarbeiteränderungen aus.

### Paket 2 – Zulieferer und Fremdvergabe: \`CNCModules.suppliers\`

- \`ensureState(state, options?)\`
- \`listProviders(state, operationType?)\`
- \`quote(state, providerId, order, options?)\` → Angebot mit Preis, Termin, Qualitätsrisiko und sichtbarer Zuverlässigkeitsbandbreite
- \`outsource(state, providerId, orderId, routeStepId, qty, atMinute)\`
- \`tick(state, absoluteGameMinutes)\`
- \`completeJob(state, jobId, outcome?)\`
- \`recordOutcome(state, jobId, outcome)\`

Unbekannte Anbieter zeigen anfangs nur eine Bandbreite; Auftragsresultate aktualisieren die bekannte Zuverlässigkeit. Qualitäts-/Verzugsrisiken bleiben spielbar, und Ruf schaltet bessere Anbieter frei. Geldbuchungen erfolgen durch Integrationscode über \`CNCModules.economy.book\`, niemals doppelt im Modul.

### Paket 3 – Kundenprojekte: \`CNCModules.customerProjects\`

- \`ensureState(state, options?)\`
- \`create(state, customerProfile, options?)\`
- \`getById(state, projectId)\`
- \`getAvailableDecision(state, projectId)\`
- \`chooseDecision(state, projectId, decisionId, atMinute)\`
- \`completePhase(state, projectId, phaseId, result, atMinute)\`
- \`tick(state, absoluteGameMinutes)\`

Phasenbeispiel: Prototyp → Vorserie → Serie. Hauptphasen sind sichtbar; mögliche Abzweigungen können verdeckt sein. Guter Verlauf verbessert Chancen, garantiert aber keinen Ausgang. Zufallswahrscheinlichkeiten sind gedeckelt und reproduzierbar. Kleine Projekte laufen mit wenig Unterbrechungen; große Projekte bieten mehrere Entscheidungen mit Konsequenzen für Produktion, Gewinn, Risiko und Kundenbeziehung.

### Paket 4 – Spezialaufträge und Betriebs-/Marktlagen: \`CNCModules.factorySituations\`

- \`ensureState(state, options?)\`
- \`generateSpecialOrder(state, customerProfile, options?)\`
- \`tick(state, absoluteGameMinutes, context?)\`
- \`getActiveModifiers(state, atMinute)\`
- \`applyModifiers(order, modifiers)\` → Kopie statt Mutation
- \`getSnapshot(state, atMinute)\`

Ein Spezialauftrag kombiniert typischerweise zwei oder drei erkennbare Mechaniken. Markt-/Betriebslagen sind selten, dauern mehrere Spieltage und haben klare Start-/Endzeit sowie Vorschau/Anzeige. Beispiele: Materialpreissprung, Werkzeugengpass, Nachfrageboom oder Personalausfall. Effekte sind begrenzt, sichtbar und wirken nur während des Ereignisses.

### Paket 5 – Mitarbeiterentwicklung, Integration und UI

Mitarbeitermodul: \`CNCModules.employeeDevelopment\`

- \`ensureState(state)\`
- \`getAvailableSpecializations(employee, progression)\`
- \`assignSpecialization(employee, specializationId, progression)\`
- \`getEffects(employee, context?)\`

Mitarbeiter erhalten maximal zwei Spezialisierungen; die erste wird früher, die zweite deutlich später freigeschaltet. Persönlichkeit beeinflusst die Auswahl. Boni sind merklich, aber keine Spezialisierung macht jemanden außerhalb des Gebiets unbrauchbar.

Der Integrationsanteil besitzt als einziger Paket 5 Änderungen an \`game.js\`, \`index.html\` und \`styles.css\` (falls vorhanden). Er lädt alle Module, migriert Spielstände, verbindet Produktionsabschlüsse, Geldbuchungen, Ruf, UI-Zustände und Eventanzeige und schützt bestehende Abläufe.

## 7. Zuständigkeiten, erlaubte Dateien und Konfliktregeln

| Paket | Eigentümerdateien |
| --- | --- |
| 1 Produktionsketten | \`systems/productionFlow.js\`, \`tests/productionFlow.test.js\` |
| 2 Zulieferer/Fremdvergabe | \`systems/suppliers.js\`, \`tests/suppliers.test.js\` |
| 3 Kundenprojekte | \`systems/customerProjects.js\`, \`tests/customerProjects.test.js\` |
| 4 Spezialaufträge/Lagen | \`systems/factorySituations.js\`, \`tests/factorySituations.test.js\` |
| 5 Entwicklung + UI/Integration | \`systems/employeeDevelopment.js\`, \`tests/employeeDevelopment.test.js\`, \`game.js\`, \`index.html\`, \`styles.css\` falls vorhanden, \`tests/gameIntegration.test.js\` |

Paket 1–4 dürfen nur ihre beiden Eigentümerdateien ändern. Änderungen an gemeinsamem Vertrag, Legacy-Modulen, Saveschlüssel und fremden Paketdateien sind ausgeschlossen. Ist ein Vertrag unzureichend, dokumentiert der Agent die benötigte Änderung und wartet auf Integration statt lokale inkompatible Felder einzuführen. Paket 5 darf die vier neuen Module konsumieren und UI-/Adaptercode ergänzen, aber ihre Kernlogik nicht duplizieren.

## 8. Branch- und Integrationsplan

\`main\` bleibt stabil und wird während der parallelen Entwicklung nicht direkt verändert.

1. Gemeinsame Spezifikation und Agentenaufträge liegen auf \`integration/cnc-factory-2.0\`.
2. Alle fünf Feature-Branches starten von genau demselben Architektur-Commit auf dieser Integrations-Branch.
3. Geplante Branches:
   - \`feature/cf2-production-flow\`
   - \`feature/cf2-suppliers-outsourcing\`
   - \`feature/cf2-customer-projects\`
   - \`feature/cf2-special-orders-situations\`
   - \`feature/cf2-employee-ui-integration\`
4. Jeder Feature-Branch wird per Pull Request in \`integration/cnc-factory-2.0\` integriert. Paket 5 kann gegen Stub-APIs arbeiten; es wird nach den anderen vier Paketen final aufgelöst.
5. Auf Integration laufen alle Modul-Tests und der bestehende \`node --test tests/*.test.js\`-Satz. Zusätzlich werden Save-Migration, gemeinsamer Auftrag durch mehrere Stationen, Fremdvergabe, Projektübergang, Situationseffekt und Spezialisierung über die UI abgenommen.
6. Erst nach grüner Gesamtabnahme geht ein Pull Request von \`integration/cnc-factory-2.0\` nach \`main\`. Die Branch wird nicht gelöscht, bis die nächste 2.0-Runde abgeschlossen ist.

Die ältere Branch \`integration/game-systems\` ist Repo-Historie und wird nicht als 2.0-Branch verwendet.

## 9. Gemeinsame Abnahme

- Kein neuer Agent bearbeitet \`game.js\` parallel zu anderen Paketen.
- Kein bestehender Auftrag oder Spielstand verliert Daten.
- Modulzustände lassen sich JSON-serialisieren und nach Reload weiterführen.
- Feste Seeds liefern reproduzierbare Angebote, Ereignisse und Projektverläufe.
- Fehlgeschlagene APIs ändern den Zustand nicht teilweise.
- UI zeigt Risiko, Termin-/Rüstzeitfolge und erforderliche Spielerentscheidung vor der Bestätigung.
- Invarianten (Mengen, Statuswechsel, Obergrenzen, eindeutige IDs) werden in automatisierten Tests geprüft.
- Die bestehenden Tests laufen unverändert mit \`node --test tests/*.test.js\`.
