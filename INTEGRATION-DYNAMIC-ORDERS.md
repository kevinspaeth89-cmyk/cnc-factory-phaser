# Integration: dynamischer Auftragsmarkt

## Neue Dateien

- `systems/orderMarket.js` – eigenständiges Marktmodul. Im Browser stellt es `CNCModules.orderMarket` bereit; für Node.js ist es als CommonJS-Modul testbar.
- `tests/orderMarket.test.js` – automatisierte Tests mit dem eingebauten Node-Testläufer.

Dieses Feature ändert `game.js` und `index.html` noch nicht. Es führt auch keine Finanzbuchhaltung, Lager-, Maschinen-, Hallen- oder Störungslogik aus.

## Spielstand

Das Modul hängt seinen Zustand an `state.orderMarket`. Alle Werte sind einfache JSON-Daten und können mit dem bestehenden Spielstand serialisiert werden:

- `available`: aktuell auswählbare Angebote
- `pendingFollowUps`: geplante Folgeaufträge mit ihrem frühesten Angebotszeitpunkt
- `completedCustomers`: abgeschlossene Aufträge je Kundenname
- `completedOrderIds`: Schutz vor doppelter Abschlussmeldung
- `now`, `nextRefreshAt`: Marktzeit und nächster regulärer Angebotszeitpunkt, in absoluten Spielminuten
- `nextOrderNumber`, `nextKind`, `rngState`: fortlaufende IDs, ausgeglichene Verteilung zwischen Drehen/Fräsen und gespeicherter Zufallszustand
- `version`, `initialized`: Versions- und Initialisierungsmarkierung

`state.gameMinutes` bleibt die Spielzeituhr. Der Parameter `gameMinutes` von `tick` ist der **absolute aktuelle Spielzeitstand in Minuten**, kein Zeitdelta.

## Aufrufe in `game.js`

1. Das Skript `systems/orderMarket.js` vor `game.js` laden.
2. Nach Wiederherstellung oder Erstellung des Spielstands `CNCModules.orderMarket.init(state)` aufrufen. Das ist idempotent; vorhandene Marktdaten bleiben erhalten.
3. Beim Fortschreiben der Spielzeit `CNCModules.orderMarket.tick(state, state.gameMinutes)` aufrufen. Danach den bestehenden Speichervorgang ausführen.
4. Angebote über `CNCModules.orderMarket.getAvailable(state)` lesen.
5. Beim Annehmen `const order = CNCModules.orderMarket.accept(state, orderId)` aufrufen. Der Rückgabewert ist eine Kopie des Auftrags; `null` bedeutet, dass das Angebot nicht mehr verfügbar ist.
6. Den angenommenen Auftrag als vollständigen, serialisierbaren Datensatz bei der laufenden Maschinenproduktion speichern. Derzeit löst `game.js` `activeId` über die statische `orders`-Liste auf. Für dynamische IDs muss diese Auflösung erweitert werden; die Angebote dürfen nicht allein durch eine ID ersetzt werden, nachdem sie aus `available` entfernt wurden.
7. Nach erfolgreichem Produktionsabschluss `CNCModules.orderMarket.onCompleted(state, order)` aufrufen. Das Modul aktualisiert den Kundenverlauf und kann einen Folgeauftrag vormerken. Auszahlung, Fristabzug und Materialverbrauch bleiben Aufgaben der jeweiligen Spielsysteme.

## Benötigte UI-Hooks

- Die bestehende Auftragsliste kann weiter als Container dienen; pro Angebot sollten Kunde/Kundenprofil, Teil, Drehen oder Fräsen, Stückzahl, Material und kg, Vergütung, Schwierigkeit, Produktionsdauer, Frist sowie Restgültigkeit angezeigt werden.
- Die Angebotsaktion ruft `accept` auf und startet nur dann, wenn ein Datensatz zurückgegeben wird. Die Maschinenkompatibilität wird anhand von `order.kind` angezeigt bzw. geprüft.
- Nach `tick`, Annahme oder Abschluss die Liste neu rendern. Für Ablaufzeiten die Restzeit aus `order.expiresAt - state.gameMinutes` berechnen.
- Ein eigener CSS-Block kann später Kundenprofile, Schwierigkeit und Expressfrist markieren. Dieses Modul benötigt selbst keine Styles.

Der Markt startet mit sechs Angeboten, hält mindestens vier und höchstens acht sichtbar. Neue Angebote kommen im Mittel alle zwei bis drei Spielstunden; typische Angebotsgültigkeit liegt je nach Kundenprofil zwischen sieben und dreißig Spielstunden. Der Kundenmix gewichtet normale, Premium-, Serien- und Expressaufträge unterschiedlich. Für neue Speicherstände wird der Zufallszustand mitgespeichert, damit ein Reload nicht jedes Angebot neu auswürfelt.

## Beim Zusammenführen beachten

- Der Branch basiert auf dem unveränderten Phaser-`main` und enthält nur das Modul, dessen Tests und diese Dokumentation. `game.js`, `index.html` und das Godot-Repo sind unverändert.
- Vor der späteren UI-Anbindung mit den parallelen Änderungen an Störungen, Economy/Lager und Hallenerweiterung auf den dann aktuellen Phaser-Stand bringen. Dieses Feature hat derzeit keine inhaltlichen Konfliktbereiche mit diesen Systemen.
- `systems/orderMarket.js` vor `game.js` laden und danach die aktive-Auftrags-Auflösung gemeinsam mit der UI integrieren. Den Branch nicht direkt in `main` mergen.
