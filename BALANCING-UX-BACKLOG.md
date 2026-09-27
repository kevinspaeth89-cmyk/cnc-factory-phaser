# Balance- und Bedienungsstand

Stand: 27. September 2026. Der Spielcode liegt lokal auf `main`, synchron mit `origin/main` bei `01fc64a` („Give orders a more deliberate pace“). Dieses Backlog-Update ändert keine Spielmechanik.

## Im aktuellen Spielstand enthalten

- Maschinenpreise und Hallenausbau wurden angehoben; die Halle bleibt auf acht Maschinenplätze begrenzt.
- Kreditangebote, monatliche Raten, Zinsen und Sondertilgung sind im Betriebsbereich verfügbar.
- Die Auftragsbörse läuft ruhiger: Angebote bleiben länger verfügbar, der Auffüllrhythmus liegt bei 12–18 Spielstunden und die Bearbeitungsdauer der Aufträge wurde verlängert.
- Auftragskarten zeigen eine grobe Materialmarge und den Maschinenzeitbedarf; das ersetzt noch keine vollständige Kostenrechnung mit Löhnen, Energie und Verschleiß.
- Das Auftragsbüro kann innerhalb einstellbarer Grenzen Material einkaufen und passende Aufträge annehmen.
- Mitarbeiter-Schulungen zeigen Kosten und Fortschritt; Aufträge lassen sich nach Annahme einer Maschine zuweisen und in der Warteschlange sortieren.
- Stammkunden können nach einem abgeschlossenen Auftrag einen Eilauftrag anbieten. Das Ereignisfenster pausiert die Simulation und zeigt Zuschlag, Lieferfrist und Bearbeitungszeit; Annahme öffnet Material- oder Maschinenauswahl.

## Drei priorisierte Spielspaß-Ideen

### 1. Eilaufträge mit echten Planungsfolgen

Die erste Umsetzungsstufe ist jetzt im Spielcode enthalten: Ein gemeinsames Ereignisfenster pausiert für den Anruf eines Stammkunden. Zusage bringt 20 % Zuschlag und startet eine kürzere Frist; Ablehnung, Verspätung oder das Verstreichenlassen des angenommenen Angebots wirken sich auf das Vertrauen aus. Bei Zusage folgt die bestehende Material- und Maschinenauswahl. Der Spielablauf wartet noch auf Rückmeldung zum Tempo und zur Balance.

### 2. Neuteile programmieren

Neue Teile brauchen vor dem Fertigungsstart ein Programm; der Aufwand richtet sich nach der Komplexität. Der Bediener kann das Programm an seiner Maschine erstellen, währenddessen pausiert dort die Produktion. Ein eingestellter Programmierer kann ein bereits eingeplantes Teil vorab programmieren; dafür bekommt das Programm eine aufwandsabhängige Vorlaufzeit, während die Maschine weiterarbeitet.

### 3. Qualitätssicherung und Reklamationen

Qualifikation, Maschinen- und Werkzeugzustand, Toleranz und Zeitdruck beeinflussen das Fehlerrisiko. Prüfungen können Fehler vor der Lieferung erkennen. Bei einer Reklamation folgen je nach Schwere Nacharbeit, Neuproduktion oder Ausschuss sowie Kosten- und Rufauswirkungen. Das Ereignisfenster aus Priorität 1 kann diese Fälle ebenfalls tragen.

## Weitere vorgemerkte Themen

- Schichtleiter und schrittweise Automatisierung der Planung.
- Rahmenverträge und stärkere Kundenbeziehungen.
- Hallenausbau mit Messbereich, Recycling und detaillierteren Kennzahlen.
- Weitere Betriebsverbesserungen wie CAM, Werkzeugvoreinstellung und Prozessüberwachung.

Die beiden folgenden Ideen bleiben die nächsten Ausbauziele. Die Umsetzung erfolgt schrittweise, damit jede Stufe erst gespielt und abgestimmt werden kann.
