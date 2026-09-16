# JK-vippa · Laboration 7

Static Swedish study tool: https://edvin9000.github.io/jk-vippa/

## Edit

- `index.html`: page, controls and short laboratory explanations.
- `style.css`: reference palette, layout and responsive rules.
- `script.js`: fixed-purpose state model, SVG diagrams, event history and controls.

No install or build step. Open index.html directly, or serve the directory with
`python -m http.server 8000`. Edit the three files in Visual Studio Code.
GitHub Pages serves the root of the main branch.

## Model

`evaluateJK(j,k,q)` is the truth-table function. `setClock` handles the rising
edge in IC mode and the single educational operation in normal mode. Race mode
uses a 250 ms interval while CLK=J=K=1. Outputs are always complementary.
CLR/PRE override clocking asynchronously; simultaneous activation is prevented.
Mode changes and reset discard history and stop all timers. Hidden tabs stop
clocking. Auto-clock uses 500 ms half-periods. Signal-path highlights use 120 ms
stages without changing logic. History stores event steps, not linear time.

Normal mode deliberately suppresses repeated feedback. Internal input-gate
values are combinational snapshots alongside the stored latch outputs; they are
not a settled physical gate network in the Toggle state. The race view explains
that physical distinction. The 40 ns / 12,500 loop calculation is a laboratory
reference only, not a device timing guarantee or a simulation parameter.

The IC drawing represents one of the two flip-flops. It is a functional diagram,
not a pinout. CLR/PRE use persistent on/off controls for easy observation.
The race button is a persistent click/touch toggle. L or C toggles race CLK.
J/K toggle inputs; C pulses normal JK or toggles IC CLK; V toggles signal paths;
A auto-clock; R reset; D clear; P preset; F fullscreen; 1–3 select modes.
Shortcuts ignore key repeat, browser/OS modifier chords and text-entry fields.
Signal paths work in all modes, including IC asynchronous controls. The race
path has three 70 ms stages so every 250 ms toggle can show the entire loop.

## Sources

Laboration7_JK-vippa.pdf (Laboration 7, Digitalteknik), supplied by the user.
Visual tokens and NAND geometry follow the user's Master–Slave site:
https://edvin9000.github.io/masterslav-1hz/
The source lab PDF is not published with the site.
