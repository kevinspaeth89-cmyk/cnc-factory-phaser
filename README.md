# CNC Factory

Spielbare Browser-Version mit vier Stellplätzen in der Produktionshalle. Das eigenständige Godot-Projekt liegt in einem anderen Repository.

## Spielen

Die [GitHub-Pages-Version](https://kevinspaeth89-cmyk.github.io/cnc-factory-phaser/) im Browser öffnen. Die Nexora links oben öffnet die Maschinenansicht. Über **Betrieb** lassen sich weitere Drehmaschinen für drei freie Plätze kaufen, Bediener für zwei Schichten einstellen und zuweisen sowie das Materiallager ausbauen. **Aufträge** erlaubt die Auswahl einer Maschine und parallele Aufträge auf unterschiedlichen Maschinen. **Maschine** bietet Material, Werkzeugwechsel, Wartung und Upgrade für die gewählte Maschine. **Tempo** enthält 1×/2×/5×/10×; **Pause** hält die gesamte Spielzeit an.

Die Schichten laufen Montag bis Freitag von 06:00–14:00 und 14:00–22:00. Außerhalb oder ohne Bediener steht die Produktion. Einstellungen kosten 150 €, Löhne fallen während der jeweiligen Schicht an und werden am Monatsanfang abgebucht. Gelagertes Material kostet 0,08 € je kg und Spieltag; das Lager fasst zuerst 300 kg und kann für 4.000 € um 200 kg erweitert werden. Maschinen verbrauchen Strom, wenn sie produzieren. Das Spiel speichert lokal im Browser und übernimmt ältere Phaser-Spielstände aus Version 2 beim ersten Start der neuen Version.

## Entwicklung

`index.html` enthält die adaptive Bedienoberfläche. `game.js` enthält Spielstand, Ökonomie und Phaser-Szene. `hall-four-bays.jpg` zeigt die Hallenübersicht, `cell-nexora.jpg` die Maschinenzelle in der Nahansicht. Gekaufte Maschinen verwenden vorerst dieselbe Nahansicht mit ihrem eigenen Namen und Status; in der Halle erscheinen sie als stilisierte Maschinen. Eine lokale Vorschau lässt sich mit `python3 -m http.server` starten.
