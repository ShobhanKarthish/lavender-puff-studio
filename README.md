# Lavender Puff Studio

An interactive expression tool for a face-only procedural mascot. Pick a feeling,
gently adjust the face, and watch Lavender Puff respond with spring-driven,
squash-and-stretch motion — then settle and hold until you choose again.

Built with semantic HTML, modern CSS, vanilla JavaScript and Canvas 2D.
No dependencies, no build step, no external assets.

## Run

Serve the folder with any static HTTP server, e.g.:

```sh
python3 -m http.server 8642
```

then open <http://localhost:8642>.

## Features

- 10 named expressions, each with a one-shot handcrafted entrance that settles and holds
- Performances — scripted one-shot shows (Say hello, Look around, Mood swing, Party bounce, Drift to sleep), each with its own motion feel, fully interruptible
- Face controls: 2D gaze pad, face placement, eye spacing, expression size, rotation, head turn and perspective
- Motion personalities (Gentle / Bouncy / Snappy) plus friendly tuning sliders mapped onto spring stiffness and damping
- Optional ambient life, all off by default: natural blinking, pointer gaze, idle breathing
- Render-until-settled lifecycle: `requestAnimationFrame` stops when every spring has settled
- Keyboard accessible, screen-reader labelled, respects `prefers-reduced-motion`

## Public API

```js
lavenderPuff.setExpression('shy');
lavenderPuff.setGaze(0.5, -0.3);
lavenderPuff.setFacePosition(0, 0.2);
lavenderPuff.setFaceRotation(-8);
lavenderPuff.setHeadTurn(0.4);
lavenderPuff.blink();
lavenderPuff.play('party');
lavenderPuff.reset();
lavenderPuff.listExpressions();
lavenderPuff.listPerformances();
lavenderPuff.getConfig();
```
