# Immersive and Realistic Views

**Immersive and Realistic Views (IRV)** ist ein experimentelles Add-on für **Foundry Virtual Tabletop V14**. Es erweitert die tokenbasierte Wahrnehmungssteuerung um zusätzliche visuelle Effekte. Ziel ist es, Sicht nicht nur über eine Reichweite zu definieren, sondern auch den Übergang zwischen sichtbarer und nicht sichtbarer Umgebung sowie den Verlust von Details mit zunehmender Entfernung gestalten zu können.

IRV ergänzt Foundrys native Sichtmechanik. Es soll sie nicht ersetzen: Foundry bleibt für die eigentliche Sichtberechnung, Wände, Sichtblockaden und den Fog of War verantwortlich.

> **Projektstatus:** Alpha 0.4.3-alpha.1 – experimentelle Entwicklung. Funktionen und Rendering-Verhalten können sich noch ändern.

## Funktionen

### Eigenes Vision-Panel

Das Add-on stellt ein schwebendes, halbtransparentes Seitenfenster bereit. Es wird über ein Augen-Symbol in den Token-Szenensteuerungen geöffnet.

- Das Panel zeigt die aktuell ausgewählten Tokens an.
- Ein einzelner Token kann separat bearbeitet werden.
- Mehrere ausgewählte Tokens können gemeinsam aktualisiert werden.
- Bei einer Mehrfachauswahl dient das Profil des zuerst ausgewählten Tokens als Ausgangspunkt. Die angewendeten Einstellungen werden auf alle ausgewählten Tokens übertragen.

### Native Vision-Steuerung

IRV bietet direkten Zugriff auf die nativen Sichtdaten des ausgewählten Tokens:

- Vision aktivieren oder deaktivieren
- native Vision Mode auswählen
- Vision-Reichweite ändern
- verfügbare Detection Modes mit eigenen Reichweiten ein- oder ausschalten

Die Änderungen werden am Foundry-`TokenDocument` vorgenommen. Das Panel speichert daher nicht nur einen kosmetischen Reichweitenwert, sondern aktualisiert die entsprechenden Token-Sichtdaten.

### Weiche Übergangsschwelle

Die Sichtgrenze kann durch eine separate Übergangszone ergänzt werden:

- Übergang ein- oder ausschalten
- Breite der Zone einstellen, die in den eigentlichen Sichtbereich hineinreicht
- Schwarz-Deckkraft des Übergangs einstellen

Die Übergangszone ist unabhängig von der nativen Vision-Reichweite. Sie soll den harten visuellen Rand abmildern, ohne die eigentliche Reichweite des Tokens zu verändern.

### Realistic View – Detailverlust durch Entfernung

Realistic View reduziert die Bilddetails mit zunehmender Entfernung zum ausgewählten Token.

Einstellbar sind:

- Beginn des Detailverlusts
- minimale Pixelblockgröße für feinere Pixelierung
- maximale Pixelblockgröße für gröbere Pixelierung
- Streuung des Pixel-Auflösens (Pixel-Cell-Dissolve)

Die Pixelblöcke verwenden stabile, tokenbezogene Schwellenwerte. Dadurch soll der Effekt weniger wie ein gleichmäßiger Kreis oder eine wandernde Wellenkante wirken.

### Immersive View – periphere Wahrnehmung

Immersive View ist ein eigenständiger Effekt. Er kann unabhängig von Realistic View aktiviert werden.

Einstellbar sind:

- Beginn des peripheren Effekts
- Stärke des Effekts

### Darkness – Abdunklung außerhalb der Sicht

Darkness ist ebenfalls unabhängig von Realistic View und Immersive View.

Einstellbar sind:

- Aktivierung der Abdunklung
- Beginn der Abdunklung relativ zur Vision-Reichweite
- Stärke beziehungsweise Deckkraft der Abdunklung

Die Darkness-Einstellung ändert nicht die native Vision-Reichweite.

### Echo-Reflexionssicht bei Tremorsense

Wenn als native Vision Mode ein Tremorsense-Modus ausgewählt ist, erscheint eine zusätzliche Echo-Option.

In der aktuellen Alpha:

- kann die Echo-Darstellung aktiviert werden
- wird, sofern im Foundry-Setup registriert, der native Detection Mode `feelTremor` berücksichtigt
- wird eine expandierende, sonarähnliche Echo-Pulswelle dargestellt

Eine echte geometrische Reflexion an Wänden oder eine vollständige räumliche Echo-Ortung ist noch nicht implementiert.

## Technischer Ansatz

IRV ist ein eigenständiges Foundry-Modul und verändert keine Dateien des verwendeten Spielsystems.

- **Foundry TokenDocument:** Native Sichtaktivierung, Vision Mode, Reichweite und Detection Modes werden über die Token-Daten aktualisiert.
- **Token-Flags:** Die visuellen IRV-Profile werden pro Token gespeichert.
- **ApplicationV2:** Das Einstellungsfenster verwendet Foundrys ApplicationV2-Framework.
- **Canvas-/PixiJS-Filter:** Realistic View, Immersive View, Darkness, Übergangsschwelle und Echo-Puls werden als grafischer Post-Processing-Effekt umgesetzt.
- **Lokalisierung:** Deutsch und Englisch sind vorbereitet.

## Bekannte Einschränkungen

IRV befindet sich in einer frühen Alpha-Phase. Bitte vor dem Einsatz in einer laufenden Spielrunde mit einer Kopie der Welt beziehungsweise einer Testszene prüfen.

- Der grafische Post-Processing-Filter arbeitet derzeit im Screen Space. Er ist noch nicht exakt auf Foundrys wandbegrenztes Sichtpolygon zugeschnitten. Grafische Effekte können deshalb Bereiche betreffen, die durch Wände verdeckt sind. Die maßgebliche Sicht- und Fog-of-War-Berechnung bleibt bei Foundry.
- Die Echo-Funktion verwendet derzeit – sofern verfügbar – `feelTremor` und eine visuelle Pulswelle. Eine echte Wandreflexion ist noch nicht vorhanden.
- Bei einer Mehrfachauswahl wird das IRV-Profil des zuerst ausgewählten Tokens als Vorlage auf alle ausgewählten Tokens übertragen. Unterschiedliche Profile werden bei diesem Sammelvorgang nicht individuell beibehalten.
- Die aktuelle Filter-Implementierung verfolgt bis zu zehn ausgewählte Tokens gleichzeitig.
- Die Alpha wurde paket- und syntaxseitig geprüft, aber noch nicht umfassend in jeder Foundry-Konfiguration und mit jedem Spielsystem zur Laufzeit getestet.

## Installation

1. Foundry VTT beenden.
2. Den Ordner `immersive-and-realistic-views` in das Foundry-Verzeichnis `Data/modules/` kopieren.
3. Prüfen, dass die Datei `Data/modules/immersive-and-realistic-views/module.json` direkt im Modulordner liegt und der Ordner nicht doppelt verschachtelt ist.
4. Foundry starten und **Immersive and Realistic Views** im Bereich „Add-on Modules“ aktivieren.
5. Eine Szene öffnen, einen oder mehrere Tokens auswählen, die Token-Szenensteuerungen öffnen und das Augen-Symbol anklicken.

## Kompatibilität

- **Foundry Virtual Tabletop:** V14
- **Entwicklungsziel / verifizierte Manifest-Version:** 14.369
- **Modul-ID:** `immersive-and-realistic-views`

IRV greift auf Foundrys native Token-Vision- und Canvas-Schnittstellen zu. Das Modul ändert keine Dateien von *How to be a Hero* oder anderen Spielsystemen. Das tatsächliche Verhalten kann dennoch davon abhängen, wie ein Spielsystem die nativen Foundry-Sichtdaten verarbeitet.

## Mitwirken und Fehler melden

Feedback, reproduzierbare Fehlerberichte und Verbesserungsvorschläge sind willkommen. Bei einem Fehler helfen folgende Angaben:

- Foundry-Version
- verwendetes Spielsystem und dessen Version
- aktive Module, die für den Fehler relevant sein könnten
- Schritte, mit denen sich der Fehler reproduzieren lässt
- Konsolenfehler und möglichst ein Screenshot

Bitte Alpha-Versionen zunächst in einer Testwelt ausprobieren.

## Lizenz und Hinweise

Dieses Projekt steht unter der MIT-Lizenz. Foundry VTT und PixiJS werden zur Laufzeit über die Foundry-Umgebung bereitgestellt; IRV bündelt keinen fremden Foundry- oder PixiJS-Quellcode.

IRV ist ein unabhängiges Community-Projekt und kein offizielles Foundry-Produkt.

<img width="3423" height="1372" alt="Capture" src="https://github.com/user-attachments/assets/0e0bbee4-a669-471e-9c75-978a6a6d0194" />
