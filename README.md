# CNC Factory

Spielbare Browser-Version mit vier, sechs oder acht Stellplätzen in der Produktionshalle.

## Spielen

Die [GitHub-Pages-Version](https://kevinspaeth89-cmyk.github.io/cnc-factory-phaser/) im Browser öffnen. Ein neues Spiel startet ohne Maschinen oder Material. Über **Betrieb** lassen sich Maschinen kaufen, Bediener einstellen und zuweisen sowie die Halle ausbauen. Der erste Tipp auf eine Maschine in der Halle öffnet eine kleine Vorschau direkt über ihrem Stellplatz; ein zweiter Tipp auf dieselbe Maschine zeigt die Maschinenansicht. Ein Tipp auf eine andere Maschine wechselt die Vorschau. **Aufträge** bietet wechselnde Angebote für Drehen und Fräsen. Das **Materiallager** ist als Regal in der Halle sichtbar und öffnet beim Antippen den Bestand, Einkauf und Lagerausbau; eine Übersicht zeigt für jede Sorte den schwankenden Kilopreis und dessen Abweichung vom Grundpreis (günstig, normal, teuer). Die Materialsorte wird direkt in der Kursübersicht gewählt; darunter steht nur noch die Kaufmenge. Die Kurse ändern sich alle 24 Spielstunden. **Maschine** bietet Werkzeugwechsel, Wartung, Upgrades und Entscheidungen bei Störungen. **Tempo** enthält 1×/2×/5×/10×; **Pause** hält die gesamte Spielzeit an.

Die Schichten laufen Montag bis Freitag von 06:00–14:00 und 14:00–22:00. Außerhalb oder ohne Bediener steht die Produktion. Einstellungen kosten 150 €, Löhne fallen während der jeweiligen Schicht an und werden am Monatsanfang abgebucht. Gelagertes Material kostet 0,08 € je kg und Spieltag; das Lager fasst zuerst 300 kg und kann für 4.000 € um 200 kg erweitert werden. Maschinen verbrauchen Strom, wenn sie produzieren. Das Spiel speichert lokal im Browser und übernimmt ältere Phaser-Spielstände aus Version 2 beim ersten Start der neuen Version.

## Entwicklung

`index.html` enthält die adaptive Bedienoberfläche; `game.js` verbindet Spielstand, Simulation und Phaser-Szene mit den Modulen unter `systems/` und der Hallenerweiterung. Alle drei Hallenbasen sind ohne Maschinen; gekaufte Dreh- und Fräsmaschinen werden pro festem Platz separat eingeblendet. Beim Verkauf bleibt genau dieser Platz frei. Die Nahansicht bietet auf dem Handy zunächst eine kompakte Statusanzeige und über **Details** zusätzliche Informationen. Eine lokale Vorschau lässt sich mit `python3 -m http.server` starten; die automatisierten Prüfungen laufen mit `node --test tests/*.test.js`.
