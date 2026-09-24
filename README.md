# CNC Factory

Spielbare Browser-Version mit einer Nexora NX-350 und vier Stellplätzen in der Produktionshalle. Das eigenständige Godot-Projekt liegt in einem anderen Repository.

## Spielen

Die [GitHub-Pages-Version](https://kevinspaeth89-cmyk.github.io/cnc-factory-phaser/) im Browser öffnen. In der Halle ist die Nexora links oben antippbar; dadurch öffnet sich die vergrößerte Maschinenansicht. Die anderen drei markierten Stellplätze sind für eine spätere Erweiterung frei. Über **Aufträge** lässt sich eine Produktion starten. **Maschine** öffnet Einkauf, Werkzeugwechsel, Wartung und Upgrade. **Tempo** enthält 1×/2×/5×/10×. Der Spielstand wird lokal im Browser gespeichert.

## Entwicklung

`index.html` enthält die adaptive Bedienoberfläche. `game.js` enthält Spielstand, Ökonomie und Phaser-Szene. `hall-four-bays.jpg` zeigt die Hallenübersicht, `cell-nexora.jpg` die fiktionale Maschinenzelle. Eine lokale Vorschau lässt sich mit `python3 -m http.server` starten.
