# CNC Factory 2.0 – gemeinsame Architektur

**Status:** Arbeitsgrundlage für fünf parallele Feature-Agenten  
**Repo:** `kevinspaeth89-cmyk/cnc-factory-phaser`<br>
**Zielplattform:** bestehendes Phaser-Browser-Spiel, JavaScript ohne Build-Schritt  
**Stand:** 1. Oktober 2026

## 1. Ziel und Grenzen

Diese Spezifikation legt Datenmodelle, Modulverträge, Zuständigkeiten, Branches und Abnahmeregeln für CNC Factory 2.0 fest. Sie implementiert keine der Spielmechaniken.

Die Umsetzung soll normale Aufträge übersichtlich halten und Abwechslung über gelegentliche Spezialfälle schaffen, die meist zwei oder drei Systeme verbinden. Komplexität wächst mit Firmenfortschritt und Ruf. Ein Fehler bei einem normalen Auftrag bleibt meist verkraftbar; große Projekte und risikoreiche Entscheidungen können stärkere, vorher sichtbare Folgen haben.

Zwischenlager bleiben unbegrenzt. Es gibt keinen künstlich festgelegten Engpass: Die aktuelle Warteschlange, Kapazität, Rüstzeit oder QS kann den Engpass bilden. Kundenprofile prägen die angebotenen Auftragsarten; normale Serien bleiben auch später relevant.

## 2. Repo-Konventionen und Integrationsregeln

Das Spiel lädt klassische Browser-Skripte aus `index.html`. Systemmodule liegen unter `systems/`, hängen ihre API als `CNCModules.<name>` an `globalThis` und exportieren dieselbe API über CommonJS. Tests laufen mit Node.js und `node --test`; es gibt keinen Build-Schritt als Voraussetzung.

Jedes neue Systemmodul muss:

- unter `systems/<name>.js` liegen und ohne DOM/Phaser importierbar sein;
- ausschließlich JSON-serialisierbaren Spielzustand speichern;
- Spielzeit in absoluten `state.gameMinutes` verwenden, nie reale Zeit;
- Migrationen idempotent ausführen und bestehende Spielstände erhalten;
- Zufall über injizierbare Seeds/Quellen reproduzierbar machen;
- Fehler als Rückgabewert wie `{ ok: false, code: '...' }` ausdrücken, statt halbe Zustandsänderungen zu hinterlassen;
- weder `game.js` noch `index.html` verändern, außer der Integrations-/UI-Agent in Paket 5;
- keine bestehenden Module oder deren öffentliche APIs umbenennen.

Die bestehenden orderMarket-Felder wie `id`, `customer`, `part`, `partKey`, `kind`, `qty`, `duration`, `reward`, `deadlineHours`, `materialType` und `materialAmountKg` bleiben gültig. Neue Felder ergänzen sie. Die persistente Save-ID `cnc_factory_save_v3` bleibt unverändert.

## 3. Gemeinsame Terminologie und Enumerationen

| Feld | Erlaubte Werte |
| --- | --- |
| `routing[].type` | `turning`, `milling`, `quality`, `assembly`, `external` |
| `routing[].status` | `blocked`, `queued`, `running`, `completed`, `cancelled` |
| `priority` | `low`, `normal`, `high` |
| `batchMode` | `auto`, `small`, `normal`, `large` |
| `lot.status` | `waiting`, `queued`, `running`, `completed`, `outsourced`, `cancelled` |
| `supplier.status` | `available`, `unknown`, `suspended` |
| `project.phaseStatus` | `locked`, `available`, `active`, `completed`, `skipped`, `failed` |
| `situation.status` | `scheduled`, `active`, `ended` |

IDs sind stabile Strings. Zeitfelder heißen `*AtMinute` oder `*Minutes` und sind Zahlen in der Spielzeitskala.

## 4. Gemeinsames Order- und Produktionsmodell

Ein Marktauftrag ist weiterhin das bestehende Order-Objekt. Folgende Erweiterungen sind der gemeinsame Vertrag:

```js
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
```

Für jeden Schritt werden zusätzliche Fortschrittsfelder ergänzt, wenn sie gebraucht werden: `qtyTotal`, `qtyCompleted`, `queueEnteredAtMinute`, `startedAtMinute`, `completedAtMinute`, `setupMinutes` und `restartSetupMinutes`. Unbekannte Felder beim Laden bleiben erhalten.

Ein Teillos ist ein eigener persistenter Datensatz mit `id`, `orderId`, `routeStepId`, `sequence`, `qty`, `qtyCompleted`, `status`, `priority` und Spielzeitstempeln. Für jede Auftragsstufe gilt: Summe der Teillosmengen ist exakt `order.qty`; ein Teillos kann nur in die nächste Stufe wechseln, wenn seine aktuelle Stufe abgeschlossen ist. Die Aufteilung muss stabil und deterministisch sein; ein kleiner Rest wird dem letzten Los zugeschlagen.

`auto` wählt anhand von Auftragsmenge und Fabrikkapazität eine passende Größe. Der Spieler kann stattdessen `small`, `normal` oder `large` wählen. Kleine Lose verkürzen die Wartezeit bis zur ersten Folgeoperation, erhöhen aber die Zahl möglicher Unterbrechungen und Wiederanläufe. Die konkrete Balance bleibt konfigurierbar und wird in Tests über Invarianten statt über UI-Texte abgesichert.

Prioritäten gelten auf Ebene des Auftrags und werden auf noch nicht gestartete Lose übertragen. Warteschlangen sortieren nach Priorität `high > normal > low`; Gleichstände bleiben fair und stabil nach Eingangszeit, Routenposition und ID. Laufende Arbeit wird nicht ohne explizite Unterbrechungsentscheidung verdrängt.

Bei einer Wiederaufnahme gilt `restartSetupMinutes = setupMinutes * interruptionSensitivity * restartSetupFraction`, wobei `restartSetupFraction` konfigurierbar und höchstens `0.5` ist. Die UI muss die geschätzte Folge vor einer Unterbrechungsentscheidung zeigen. Für einfache Teile ist die Sensitivität niedrig; komplexe Präzisionsteile dürfen bis zu 30–50 % einer vollständigen Rüstzeit erneut benötigen.

## 5. Persistenz, Save-Migration und Zufall

Jedes Modul besitzt einen eigenen Top-Level-Zustand und eine Versionsnummer. Modulinitialisierung repariert fehlende Felder, migriert bekannte Altformen und darf bei zweimaligem Aufruf keine Duplikate erzeugen:

- `state.productionFlow = { version, lots, queues, events }`
- `state.suppliers = { version, providers, jobs, history }`
- `state.customerProjects = { version, projects, decisions, nextProjectNumber }`
- `state.factorySituations = { version, active, history, randomState }`
- `state.employeeDevelopment = { version }`; Spezialisierungsdaten liegen am Mitarbeiterobjekt unter `specializations[]`

Zeitabhängige Prozesse laufen in `tick(state, absoluteGameMinutes)`. Mehrfaches Ticken zum selben Zeitpunkt ist idempotent. Seed-basierter Zufall wird vollständig im JSON-Zustand gespeichert oder über eine injizierte Zufallsquelle reproduzierbar gemacht. Es darf keine globale Zufallsquelle mutiert werden.

Sonderlagen wirken zeitabhängig. Die Integration fragt ihre Modifier mit der jeweiligen Spielminute ab. Materialkostenfaktoren gelten für Preisabfragen und Käufe zu diesem Zeitpunkt; der Nachfragefaktor geht an `orderMarket.tick` und beeinflusst die folgenden Angebotsintervalle. Der Kapazitätsfaktor bestimmt bei Annahme eines Auftrags die Kapazität des Losplans. Der Produktions-Zeitfaktor wird während der Simulation dynamisch abgefragt und gilt nur, solange die Lage aktiv ist; nach ihrem Ende gilt wieder der normale Wert. Die beim Annehmen gespeicherten `activeSituationModifierIds` und `situationEffects` dokumentieren die damalige Lage und versorgen Warnanzeige/Planung. Sie halten einen zeitabhängigen Produktionsfaktor nicht über das Ereignisende hinaus aktiv. Spezialauftragsmechaniken wie `order.mechanics[].durationFactor` bleiben auftragsbezogen.

Die Integrationsarbeit ruft Migrationen nach dem bestehenden Laden/Erstellen des Spielstands und vor der Simulation auf. Alte Spielstände ohne 2.0-Felder starten mit leeren Systemzuständen; laufende Legacy-Aufträge behalten ihre bestehende Bedeutung.

## 6. Modulgrenzen und öffentliche APIs

Jedes Modul erhält Tests, die seine API direkt über `require('../systems/<name>.js')` laden. Die genannten Signaturen sind verbindlich; Agenten dürfen optionale Parameter hinzufügen, aber Namen und Rückgabegrundform nicht ändern.

### Paket 1 – Produktionsketten: `CNCModules.productionFlow`

- `ensureState(state)`
- `createPlan(order, options?)` → `{ ok, order, route, lots, batchMode, effectiveBatchMode, batchSize }`; plant ohne Mutation des Eingabeauftrags
- `addOrder(state, order, options?)` → speichert Auftrag und Teillose; `options` unterstützt insbesondere `capacity` und `setupMinutes`
- `setPriority(state, orderId, priority)` → `{ ok, code?, order? }`
- `startNext(state, machineId, requiredMachineKind, atMinute)` → startet ein passendes wartendes Los
- `estimateRestartSetup(state, lotId)` → `{ ok, ..., estimatedRestartSetupMinutes }`
- `interrupt(state, lotId, machineId, atMinute)`
- `resume(state, lotId, machineId, atMinute)`
- `completeStep(state, lotId, routeStepId, atMinute)`
- `outsourceLot(state, lotId, supplierJobId, atMinute)`
- `completeOutsourcedStep(state, lotId, routeStepId, supplierJobId, deliveredAtMinute)`
- `tick(state, absoluteGameMinutes)`
- `getSnapshot(state)`

`addOrder` liefert nach erfolgreicher Persistierung `{ ok: true, order, lots }`. `estimateRestartSetup` ist eine reine Schätzung und liefert unter anderem `estimatedRestartSetupMinutes`. Nach `interrupt` steht das Los wieder auf `waiting` und speichert den Unterbrechungsfortschritt; `resume` weist es erneut zu und liefert `restartSetupMinutes`. Für Fremdvergabe nutzt die Integration nur explizite externe Routenschritte im Format `{ type: 'external', operationType: 'turning'|'milling'|'quality'|'assembly', requiredMachineKind: null }`. Nach erfolgreichem Anbieterauftrag ruft sie `outsourceLot` auf; nach erfolgreicher Lieferung desselben Jobs ruft sie `completeOutsourcedStep` auf. Dieser Abschluss gibt dasselbe Los für die Folgestation frei oder schließt den Auftrag ab.

Dieses Modul verwaltet Routen, Teillose, Warteschlangen, Priorität und Wiederanlauf-Schätzung. Es führt keine DOM-, Phaser-, Geld-, Anbieter- oder Mitarbeiteränderungen aus.

### Paket 2 – Zulieferer und Fremdvergabe: `CNCModules.suppliers`

- `ensureState(state, options?)`
- `listProviders(state, operationType?)`
- `quote(state, providerId, order, options?)` → Angebot mit `quoteId`, `providerId`, `orderId`, `routeStepId`, `lotId`, `operationType`, `qty`, `totalCost`, `leadTimeMinutes`, `quotedAtMinute`, `dueAtMinute`, `expiresAtMinute`, `qualityRisk` und `reliabilityRange`
- `outsource(state, providerId, orderId, routeStepId, qty, atMinute, options?)` → Job mit Anbieter-, Auftrags-, Routen- und Losreferenzen
- `tick(state, absoluteGameMinutes)`
- `completeJob(state, jobId, outcome?)`
- `recordOutcome(state, jobId, outcome)`

Für einen externen Routenschritt muss das Angebot die zugrunde liegende Anbieterleistung als `operationType` angeben, zum Beispiel `milling`; `external` ist kein Anbieter-Arbeitsgang. `quote`-Optionen unterstützen `routeStep` oder `routeStepId`, `lotId`, `operationType`, `qty` und `atMinute`. Das Angebot wird unter `quoteId` gespeichert. Die lotbezogene Integration erteilt den Auftrag mit `outsource(state, providerId, orderId, routeStepId, qty, atMinute, { quoteId, lotId })`. Der Job enthält mindestens `id`, `quoteId`, `providerId`, `orderId`, `routeStepId`, `lotId`, `operationType`, `qty`, `cost`, `qualityRisk`, `outsourcedAtMinute`, `dueAtMinute` und `status`. Jobstatus sind `in_progress`, `due`, `overdue` und `completed`. Die Integration übergibt den Job an `productionFlow.outsourceLot`; nach erfolgreichem `completeJob` gibt `productionFlow.completeOutsourcedStep` dasselbe Los frei. Falls die Flow-Freigabe fehlschlägt, muss die Integration den ausstehenden Übergang sichern und wiederholen.

Unbekannte Anbieter zeigen anfangs nur eine Bandbreite; Auftragsresultate aktualisieren die bekannte Zuverlässigkeit. Qualitäts-/Verzugsrisiken bleiben spielbar, und Ruf schaltet bessere Anbieter frei. Geldbuchungen erfolgen durch Integrationscode über `CNCModules.economy.book`, niemals doppelt im Modul.

### Paket 3 – Kundenprojekte: `CNCModules.customerProjects`

- `ensureState(state, options?)`
- `create(state, customerProfile, options?)`
- `getById(state, projectId)`
- `getAvailableDecision(state, projectId)`
- `chooseDecision(state, projectId, decisionId, atMinute)`
- `completePhase(state, projectId, phaseId, result, atMinute)`
- `tick(state, absoluteGameMinutes, context?)`; `context.blockedProjectIds` nimmt optionale Projekt-IDs auf, deren automatische Kleinprojektphasen pausieren sollen

Phasenbeispiel: Prototyp → Vorserie → Serie. Hauptphasen sind sichtbar; mögliche Abzweigungen können verdeckt sein. Guter Verlauf verbessert Chancen, garantiert aber keinen Ausgang. Zufallswahrscheinlichkeiten sind gedeckelt und reproduzierbar. Kleine Projekte laufen mit wenig Unterbrechungen; große Projekte bieten mehrere Entscheidungen mit Konsequenzen für Produktion, Gewinn, Risiko und Kundenbeziehung. Ein Projekt mit verknüpftem Produktionsauftrag darf seine automatische Phase nicht vor Abschluss aller Auftragslose wechseln. Die Integration übergibt solche Projekt-IDs in `blockedProjectIds`; nach Abschluss oder Abbruch aller Lose kann die Automatik weiterlaufen. Die Projektuhr `customerProjects.now` wird auch für blockierte Projekte auf die aktuelle Spielminute fortgeschrieben.

### Paket 4 – Spezialaufträge und Betriebs-/Marktlagen: `CNCModules.factorySituations`

- `ensureState(state, options?)`
- `generateSpecialOrder(state, customerProfile, options?)`
- `tick(state, absoluteGameMinutes, context?)`
- `getActiveModifiers(state, atMinute)`
- `applyModifiers(order, modifiers)` → Kopie statt Mutation
- `getSnapshot(state, atMinute)`

Ein Spezialauftrag kombiniert typischerweise zwei oder drei erkennbare Mechaniken. Markt-/Betriebslagen sind selten, dauern mehrere Spieltage und haben klare Start-/Endzeit sowie Vorschau/Anzeige. Beispiele: Materialpreissprung, Werkzeugengpass, Nachfrageboom oder Personalausfall. Effekte sind begrenzt, sichtbar und wirken nur während des Ereignisses.

### Paket 5 – Mitarbeiterentwicklung, Integration und UI

Mitarbeitermodul: `CNCModules.employeeDevelopment`

- `ensureState(state)` und `ensureEmployee(employee)` für idempotente Save-Migration
- `getProgress(employee, progression?)` für Karrierelevel, besetzte Produktionsminuten, nächste Arbeitsschwelle und offene Level-up-Auswahlen
- `getAvailableSpecializations(employee, progression?)`
- `assignSpecialization(employee, specializationId, progression?)` verbraucht genau eine verdiente Auswahl
- `awardSpecialEvent(employee, eventType, progression?)` für einmalige, qualifizierte Ereignis-Level-ups
- `getEffects(employee, context?)`

Mitarbeiter starten im neuen Fortschrittsmodell ohne offene Spezialisierungsauswahl; bei Altspielständen bleiben bereits verdiente, ungenutzte Freischaltungen erhalten. Die Schwellen basieren auf besetzter Produktionszeit (7.200/18.000 Minuten), nicht auf lernbonusverstärkter XP; damit entspricht die Anzeige der tatsächlich geleisteten Arbeit. Eine erfolgreiche Selbstreparatur kann nach mindestens 3.600 Produktionsminuten einmalig ein zusätzliches Level-up verdienen. Migrationen bewahren ungenutzte Alt-Freischaltungen bei 240/1.920 XP. Maximal zwei Spezialisierungen. Persönlichkeit begrenzt die Auswahl.

Der Integrationsanteil besitzt als einziger Paket 5 Änderungen an `game.js`, `index.html` und `styles.css` (falls vorhanden). Paket 5 darf zusätzlich `systems/recruitment.js` ausschließlich in `normalizeEmployee` ändern, damit `specializations[]` und `development`-Level-up-Daten nach Speichern und Neuladen erhalten bleiben; `tests/recruitment.test.js` deckt diese Migration ab. Als weitere klar begrenzte Integrationsausnahme besitzt Paket 5 die optionale Nachfragefaktor-Erweiterung in `systems/orderMarket.js` und deren Test in `tests/orderMarket.test.js`: `orderMarket.tick(state, gameMinutes, { demandFactor })`. Der Standardfaktor ist `1` und erhält das bisherige Verhalten; ein Faktor innerhalb `0.8–1.3` skaliert nur das nächste Angebotsintervall durch Division der normalen Intervalllänge durch den Faktor. Paket 5 darf keine weiteren Kernmodule aus den Paketen 1–4 ändern. Es lädt alle Module, migriert Spielstände, verbindet Produktionsabschlüsse, Geldbuchungen, Ruf, UI-Zustände und Eventanzeige und schützt bestehende Abläufe.

## 7. Zuständigkeiten, erlaubte Dateien und Konfliktregeln

| Paket | Eigentümerdateien |
| --- | --- |
| 1 Produktionsketten | `systems/productionFlow.js`, `tests/productionFlow.test.js` |
| 2 Zulieferer/Fremdvergabe | `systems/suppliers.js`, `tests/suppliers.test.js` |
| 3 Kundenprojekte | `systems/customerProjects.js`, `tests/customerProjects.test.js` |
| 4 Spezialaufträge/Lagen | `systems/factorySituations.js`, `tests/factorySituations.test.js` |
| 5 Entwicklung + UI/Integration | `systems/employeeDevelopment.js`, `tests/employeeDevelopment.test.js`, `game.js`, `index.html`, `styles.css` falls vorhanden, `systems/recruitment.js` (nur Save-Normalisierung), `tests/recruitment.test.js` (Erweiterungstest), `systems/orderMarket.js` (nur `demandFactor`-Erweiterung), `tests/orderMarket.test.js` (Erweiterungstest), `tests/gameIntegration.test.js` |

Paket 1–4 dürfen nur ihre beiden Eigentümerdateien ändern. Änderungen an gemeinsamem Vertrag, Legacy-Modulen, Saveschlüssel und fremden Paketdateien sind ausgeschlossen. Ist ein Vertrag unzureichend, dokumentiert der Agent die benötigte Änderung und wartet auf Integration statt lokale inkompatible Felder einzuführen. Paket 5 darf die vier neuen Module konsumieren und UI-/Adaptercode ergänzen, aber ihre Kernlogik nicht duplizieren. Die freigegebenen Änderungen an bestehenden Systemmodulen sind auf Paket 5s oben beschriebene optionale `demandFactor`-Erweiterung von `orderMarket.tick` samt Test und das reine Save-Erhalten von Mitarbeiter-Spezialisierungen und Level-up-Feldern in `recruitment.normalizeEmployee` samt Test beschränkt; weitere Änderungen an Paket-1–4-Modulen erfordern eine gemeinsame Vertragsänderung.

## 8. Branch- und Integrationsplan

`main` bleibt stabil und wird während der parallelen Entwicklung nicht direkt verändert.

1. Gemeinsame Spezifikation und Agentenaufträge liegen auf `integration/cnc-factory-2.0`.
2. Alle fünf Feature-Branches starten von genau demselben Architektur-Commit auf dieser Integrations-Branch.
3. Geplante Branches:
   - `feature/cf2-production-flow`
   - `feature/cf2-suppliers-outsourcing`
   - `feature/cf2-customer-projects`
   - `feature/cf2-special-orders-situations`
   - `feature/cf2-employee-ui-integration`
4. Jeder Feature-Branch wird per Pull Request in `integration/cnc-factory-2.0` integriert. Paket 5 kann gegen Stub-APIs arbeiten; es wird nach den anderen vier Paketen final aufgelöst.
5. Auf Integration laufen alle Modul-Tests und der bestehende `node --test tests/*.test.js`-Satz. Zusätzlich werden Save-Migration, gemeinsamer Auftrag durch mehrere Stationen, Fremdvergabe, Projektübergang, Situationseffekt und Spezialisierung über die UI abgenommen.
6. Erst nach grüner Gesamtabnahme geht ein Pull Request von `integration/cnc-factory-2.0` nach `main`. Die Branch wird nicht gelöscht, bis die nächste 2.0-Runde abgeschlossen ist.

Die ältere Branch `integration/game-systems` ist Repo-Historie und wird nicht als 2.0-Branch verwendet.

## 9. Gemeinsame Abnahme

- Kein neuer Agent bearbeitet `game.js` parallel zu anderen Paketen.
- Kein bestehender Auftrag oder Spielstand verliert Daten.
- Modulzustände lassen sich JSON-serialisieren und nach Reload weiterführen.
- Feste Seeds liefern reproduzierbare Angebote, Ereignisse und Projektverläufe.
- Fehlgeschlagene APIs ändern den Zustand nicht teilweise.
- UI zeigt Risiko, Termin-/Rüstzeitfolge und erforderliche Spielerentscheidung vor der Bestätigung.
- Invarianten (Mengen, Statuswechsel, Obergrenzen, eindeutige IDs) werden in automatisierten Tests geprüft.
- Die bestehenden Tests laufen unverändert mit `node --test tests/*.test.js`.
