---
workflow: hyperframes
flow: automation
storyboard: no
message: "Your AWS account, as a GTA-style building you can walk through — from Lambda to the Service Graveyard"
destination: youtube
aspect: 1920x1080
language: en
length: ~60s
audio: sfx-only
---

# Brief: Grand Theft Auto Scaling — trailer

## Request (user's words)

> use the hyperframes skill to create a trailer for this game.
> Use the demo mode and show things like Lambda, Eventbridge, CloudWatch, CloudFormation and walk into a well populated stack.
> Also show the graveyard and walk all the way down the retired AWS services

## Confirmed

- Length ~60 s, YouTube 16:9 1920×1080, 30 fps.
- Audio: music + SFX was chosen, but no music source is set up (no HeyGen sign-in, no local model), so the user picked **SFX only for now**.
- No storyboard review; automation.

## Inferred (receipts)

- Tone: GTA-style comedic trailer — the game is a GTA parody ("Grand Theft Auto Scaling"), its HUD and copy are jokes.
- Footage: real gameplay captured from `?demo` (demo account, eu-west-1), frame-stepped in Chrome so it is smooth at 30 fps. The game's HUD stays on screen; transient HUD pieces that animate on wall-clock time (area banner, MISSION PASSED, RESPECT +) are rebuilt in the edit in the game's own styling.
- Stack: `shipping-workflows` — the demo's most populated stack (27 resources, 10 services).
- Sound: the game's own synthesized sounds (server hum, graveyard wind, door whoosh, mission jingle, respect beep, pager beep) rendered offline from `public/js/audio.js`, plus one bass impact from the bundled SFX library on the title.
- Fonts: the game's own Anton + Rajdhani.
