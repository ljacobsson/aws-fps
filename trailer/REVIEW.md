# Review — Grand Theft Auto Scaling trailer (60 s)

## Creative calls

- Built storyline A ("One night shift"): lobby → Lambda → EventBridge → CloudWatch → CFN hall → `shipping-workflows`
  (the demo's most populated stack, 27 resources) → fade to the Service Graveyard → tracking shots along the
  retired services → EC2-Classic, F to pay respects → title card. B (loading-screen character cards) and C (one
  continuous take) are in `STORYLINES.md`, not built.
- Footage is real gameplay from `?demo`, captured frame-by-frame in Chrome with a stepped clock
  (`../trailer-capture/`), driven through the game's own movement physics so head-bob, door opening, the portal
  swirl and the bird's-eye camera blend are the game's. HUD stays on; banner / RESPECT + / MISSION PASSED are rebuilt
  in the game's CSS styling because they animate on wall-clock time and would stutter in stepped capture.
- "WANTED" gag punches the footage 2.2x into the real HUD wanted stars (2 alarms in ALARM in the demo data).
- Sound is the game's own WebAudio soundscape rendered offline (hum, wind, door whoosh x3 takes, pager beep, respect
  beep, mission jingle) + one bundled bass impact on the title. No music: no source configured, user chose SFX only.
- Tombstone shots got a shadow lift (`media-treatment`: exposure 0.15, shadows 0.35, contrast 0.05) for legibility.

## Measured vs looked at

- `check`: ok, 0 errors. Kept warnings: `nested_media_start_basis_ambiguous` (footage host starts at 0, so local =
  root time, intended), `timeline_track_too_dense` (footage scene holds the 11 shots on one lane by design).
- Looked at: QA frames from SPEC.md, a strip across every cut (±0.1 s), review beat/phone sheets.
- Sound: levels measured per file (whoosh −20 LUFS, bed −22, wind −24.5, all ≤ −3 dBTP); the mix was measured on the
  render, not heard.

## Weakest shot / next

- No music bed: the piece leans on ambience. Adding a track (HeyGen catalog, MusicGen, or your own) is the biggest lift;
  cuts at 4.2 / 8.6 / 12.6 / 17.8 / 22.2 are where beats should land.
- MISSION PASSED (50.6–53.9) sits over the "Old Section" signpost during the crane-up (P2).
- Graveyard gate walk (31.2–39.2) is the slowest stretch; could lose ~1.5 s.

## Revision 2 (user feedback)

- Lambda: now walks the cold aisle (z −6.2) where rack fronts face each other; the old aisle was the hot aisle (backs).
- EventBridge: re-shot down the clear left lane so the cron timers, rule funnels and both event buses are in frame;
  banner sub now "2 event buses · 7 rules". The previous path ran into the front gauge row's colliders (camera snag).
  `capture.mjs` now reports any frame where the game's collision pushed the player off the path; all shots are clean.
- SQS Conveyor Floor added at 12.6–16.6 s (whip in from EventBridge, zoom-through out to CloudWatch).
  Graveyard gate walk trimmed 1.5 s; film is now 62.5 s.
- Sound: all audio clips were deleted in Studio by the user, so the render is silent (`film_silent` warning kept on purpose).
  The end card's "Demo account included" note was also removed in Studio.
