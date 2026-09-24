# CNC Factory

Spielbare Browser- und Android-Version mit einer Nexora NX-350 Maschinenzelle. Das eigenständige Godot-Projekt liegt in einem anderen Repository.

## Spielen

Die [GitHub-Pages-Version](https://kevinspaeth89-cmyk.github.io/cnc-factory-phaser/) im Browser öffnen. Einen Auftrag in der Auftragsbörse starten; die Maschine produziert automatisch. Im Reiter **Maschine** lassen sich Rohmaterial kaufen, Werkzeug wechseln, Wartung durchführen und Upgrades erwerben. Unten stehen Pause sowie 1×/2×/5×/10× zur Verfügung. Der Spielstand wird lokal im Browser gespeichert.

## Entwicklung

`index.html` enthält die adaptive Bedienoberfläche. `game.js` enthält Spielstand, Ökonomie und Phaser-Szene. `cell-nexora.jpg` zeigt die fiktionale Maschinenzelle. Eine lokale Vorschau lässt sich mit `python3 -m http.server` starten.
