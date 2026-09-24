# Maschinenstörungen: Integration

Das Störungssystem liegt als unabhängiges Modul unter `systems/breakdowns.js`. Es ist in diesem Branch absichtlich noch nicht mit der Oberfläche oder der Produktionsschleife verbunden. Dadurch bleiben `game.js` und `index.html` frei von Änderungen während die anderen parallelen Spielsysteme entstehen.

## Neue Dateien

- `systems/breakdowns.js` – Browser-Modul und CommonJS-Modul mit Zustandsverwaltung, Risikoberechnung und Ereignissen.
- `tests/breakdowns.test.js` – Tests mit Node.js `node:test`.
- `INTEGRATION-BREAKDOWNS.md` – diese Integrationshinweise.

## State

`init(state)` erstellt und bereinigt ausschließlich diesen Namespace. Die Einträge sind einfache JSON-Daten und können mit dem vorhandenen Spielstand in LocalStorage gespeichert werden:

```js
state.breakdowns = {
  machines: {
    "2": {
      status: "warning",
      fault: "coolant_pressure",
      severity: 1,
      since: 1240,
      riskyContinue: false,
      scheduledRepair: false,
      operatingHours: 34.5,
      warningAgeMinutes: 0,
      repairRemainingMinutes: 0,
      plannedRepair: false
    }
  }
};
```

Der Schlüssel ist die Stellplatznummer als String. `init` erzeugt für vorhandene Maschinen einen Eintrag mit `status: "ok"` und entfernt verwaiste Einträge, wenn eine Maschine verkauft wurde. Das Modul ändert keine Felder in `state.machines`, kein Geld, keine Aufträge und keinen Lagerbestand.

Statuswerte:

| Status | Bedeutung für Produktion |
| --- | --- |
| `ok` | Maschine darf normal produzieren. |
| `warning` | Auf eine Entscheidung warten. Weiterproduktion ist nur nach `continueRisky` oder mit geplanter Reparatur bis zum Auftragsende erlaubt. |
| `major_failure` | Produktion stoppen, bis Reparatur gewählt wurde. |
| `repairing` | Produktion bis zum `repair_complete`-Event stoppen. |

## API und benötigte Hooks

Vor `game.js` muss `index.html` das Modul laden:

```html
<script src="systems/breakdowns.js"></script>
<script src="game.js"></script>
```

Nach Laden und Migration des Spielstands einmal initialisieren:

```js
CNCModules.breakdowns.init(state);
```

`tick(state, dt, context)` erwartet `dt` in **Spielminuten**, nicht in realen Sekunden. Rufe es pro Zeitschritt auf und übergib die Stellplätze, die in diesem Zeitschritt tatsächlich produzieren. So zählen Schichtpausen, fehlendes Personal, Spielpause und Leerlauf nicht als Maschinenlaufzeit:

```js
const runningBays = state.machines.filter(operating).map(machine => machine.bay);
const events = CNCModules.breakdowns.tick(state, step, { operatingBays: runningBays });
```

Der Hook sollte vor dem Produktionsfortschritt des Schritts laufen. Prüfe danach `canContinueProduction(state, machine.bay)`: Eine neu aufgetretene Warnung hält die Maschine an, bis der Spieler eine Entscheidung getroffen hat. `repairing` und `major_failure` halten sie immer an. Eine geplante Reparatur lässt einen bereits laufenden Auftrag fertig werden.

Wenn ein Auftrag abgeschlossen wurde, muss die nächste Störungsaktualisierung den nun leeren `activeId` sehen. Das Modul erkennt dann automatisch, dass die geplante Reparatur starten kann, und liefert `repair_started`.

Die Funktionen für die drei Entscheidungen liefern je ein Eventobjekt oder `null`, wenn die Aktion in diesem Zustand nicht möglich ist:

```js
const repairEvent = CNCModules.breakdowns.repairNow(state, bay);
const continueEvent = CNCModules.breakdowns.continueRisky(state, bay);
const scheduledEvent = CNCModules.breakdowns.scheduleRepair(state, bay);
```

Für die Anzeige:

- `getStatus(state, bay)` liefert den Status oder `null`, wenn der Stellplatz leer ist.
- `getFault(state, bay)` liefert die Fehler-ID oder `null`.
- `getFaultInfo(faultId)` liefert Bezeichnung, Grundkosten und Grundausfallzeit.
- `getRecord(state, bay)` liefert eine Kopie des Störungseintrags für Details wie Schweregrad und geplante Reparatur.
- `getRiskProfile(state, bay)` liefert die aktuellen Risikofaktoren zur Fehlersuche oder für eine spätere Anzeige.

## Ereignisse und Zuständigkeit der Economy

`tick` gibt ein Array mit null oder mehr Ereignissen zurück. Aktionsfunktionen geben ein einzelnes Eventobjekt zurück. Die Economy muss diese Ergebnisse verarbeiten; das Störungsmodul bucht **keine** Kosten selbst.

| Event | Wann | Daten für spätere Systeme |
| --- | --- | --- |
| `warning` | Eine Störung ist aufgetreten. | `bay`, `fault`, `faultLabel`, `severity`, `since`, `costEstimate`, `downtimeEstimate` |
| `continue_risky` | Spieler wählt riskante Weiterproduktion. | `bay`, `fault`, `severity`, `riskFactor` |
| `repair` | Sofortreparatur startet. | `bay`, `fault`, `cost`, `downtime`, `blocksProduction` |
| `repair_scheduled` | Geplante Reparatur wurde ausgewählt. | `bay`, `fault`, `cost`, `downtime`, `scheduledAfterJob`, `blocksProduction` |
| `repair_started` | Die geplante Reparatur startet nach dem Auftrag. | `bay`, `fault`, `downtime`, `cost: 0`; die geplanten Kosten wurden bereits im `repair_scheduled`-Event gemeldet. |
| `major_failure` | Riskantes Weiterfahren hat einen größeren Schaden ausgelöst. | `bay`, `fault`, `cost`, `downtime`, `scrapParts`, `blocksProduction` |
| `repair_complete` | Die Ausfallzeit ist vorbei. | `bay`, `fault`, `blocksProduction: false` |

Economy-Hooks sollten die Kosten einmalig beim `repair`, `repair_scheduled` oder `major_failure`-Event buchen. `repair_started` enthält bewusst `cost: 0`, um eine doppelte Buchung zu verhindern. `scrapParts` ist nur eine Ausschussmeldung; die spätere Lager-/Produktionslogik entscheidet, wie sie den Auftrag und Materialbestand anpasst.

`downtime` und `repairRemainingMinutes` sind Spielminuten. Nach Ablauf gibt `tick` `repair_complete` zurück. Die Kosten- und Ausfallwerte stehen im Modul und können später anhand des Economy-Balancings angepasst werden.

## Balancing

Die Grundrate für eine neue Warnung beträgt `0,006` pro Maschinenlaufstunde vor den Zustandsfaktoren. Das entspricht bei guter Wartung einer sehr geringen Wahrscheinlichkeit. Die Rate steigt stufenweise mit dem Wartungszustand:

| Wartungszustand | Risikofaktor |
| --- | ---: |
| 80–100 % | 0,25 |
| 50–79 % | 0,7 |
| 20–49 % | 1,7 |
| Unter 20 % | 3,5 |

Verschleiß des Werkzeugs multipliziert das Risiko linear von `0,7` bei 100 % Werkzeugzustand bis `2,2` bei 0 %. Laufzeit erhöht es ab 24, 80 und 200 angesammelten Maschinenstunden weiter. Eine Störungsmeldung selbst erzeugt keinen weiteren Schaden. Erst `continueRisky` schaltet die zusätzliche Folgeschadenrate frei; sie steigt mit der Zeit, in der die Maschine trotz Warnung weiterläuft. Ein Folgeschaden liefert höhere Kosten, längere Ausfallzeit und gegebenenfalls ein Ausschussteil.

Maschinenklassen können ohne Umbau des Katalogs über `machine.reliability` oder `state.catalog[type].reliability` berücksichtigt werden. `1.0` ist der Basiswert, `1.2` senkt das Risiko und `0.8` erhöht es. Alternativ kann `tick` im Context `reliabilityForMachine(machine, state)` bekommen. Werte werden intern auf `0.5–1.5` begrenzt.

## Testen

Im Repo ausführen:

```sh
node --test tests/breakdowns.test.js
```

Die Tests prüfen störungsfreien Betrieb, Einfluss der Zustände, Warnung, Sofortreparatur, riskante Weiterproduktion mit Folgeschaden, geplante Reparatur, mehrere Maschinen, leere Stellplätze und JSON/LocalStorage-Serialisierung.

## Integration in CNC Factory

`index.html` lädt das Modul vor `game.js`; der bestehende Spielstand wird bei jedem Start und neuen Spiel mit `breakdowns.init` ergänzt. Kauf und Verkauf synchronisieren die Stellplätze, sodass ein verkaufter Stellplatz keinen Störungseintrag behält. Vor jedem Produktionsschritt aktualisiert die Simulation die Störungen für tatsächlich besetzte, betreute und produktionsbereite Maschinen und prüft `canContinueProduction`. Eine Warnung unterbricht den Fortschritt bis zur Entscheidung im Maschinenmenü. Sofortreparatur und geplanter Service belasten `finance` genau beim jeweiligen Entscheidungsereignis; das spätere `repair_started` kostet nichts. Ein schwerer Folgeschaden wird unmittelbar belastet und gemeldeter Ausschuss setzt den Auftragsfortschritt um ein Teil zurück. Das bei Annahme bereits reservierte Rohmaterial bleibt verbraucht; ein zusätzlicher Lagerabzug wäre eine doppelte Entnahme. Unbezahlbare freiwillige Reparaturen werden zurückgenommen. Warnungen, Reparaturen und Entscheidungen werden mit dem normalen Spielstand gespeichert. Die Statusanzeige und Hallenplatzmarkierung zeigen Störungen an.
