# SPEC — Grand Theft Auto Scaling trailer

GOAL:    the viewer laughs at "WANTED: 2 in ALARM" and "F to pay respects", and wants to run `npm start` on their own account.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    60.0 s x 30 = 1800 frames. No music (user chose SFX only); the game's own hum/wind are the bed.

LOOK:    the game itself. Footage = real gameplay with its HUD (minimap, money = account id, wanted stars, objective).
         Ground for the end card = the game's title screen: #05070b solid, radial #ff9900 at 35% from lower-left,
         radial #8c4fff at 35% from upper-right, 64 px grid lines at 2.5% white.
         Display: Anton 400, uppercase, hard shadow 5px 5px 0 #000 + -2px -2px 0 #000 (the game's h1/banner shadow scaled 1.6x).
         Sub-lines: Rajdhani 700, 30-36 px, letter-spacing 2-10 px, #d6e0ec, shadow 2px 2px 0 #000.
         Accent #ff9900 only on: "GRAND THEFT", the `npm start` button. Area banners glow in the area's own game colour.
         Game-UI rebuilds (banner, RESPECT +, MISSION PASSED) use the game's CSS values x1.6-2.
OBJECTS: AWS-logo (the game's canvas logo, exported), tombstones (real footage), wanted stars (real HUD).
MOTION:  arrivals expo.out / power4.out; camera punch power3.out 0.4 s; exits power3.in 0.15-0.25 s.
         Titles: hook lines blur-in 8 px → 0 in 0.18 s, no translate; banners use the game's own banner keyframe
         (opacity 0→1, y 12→0 in 0.44 s, hold, fade 0.4 s). MISSION PASSED = game's keyframe (scale 1.4→1 in 0.4 s).
SHOTS (root time):
  0.00-4.20   lobby walk to the AWS logo. "YOUR AWS ACCOUNT." 0.35-1.95, "NOW IT'S A BUILDING." 2.05-3.95. → zoom-through.
  4.20-8.60   Lambda aisle, banner LAMBDA FUNCTION HALL / 46 resources. → game dip to black.
  8.60-12.60  EventBridge cron gauges, banner. → whip left.
  12.60-17.80 CloudWatch walls, banner; 15.55 pager beep + punch into the wanted stars, "2 IN ALARM". → dip.
  17.80-22.20 CFN hall, walk into shipping-workflows door; portal swirl whites out. → white flash.
  22.20-31.20 stack walk-in (banner shipping-workflows) → bird's-eye crane; "27 RESOURCES. ONE STACK." 26.6-30.8. → fade to black.
  31.20-39.20 graveyard gate walk under the moon; "NOT EVERY SERVICE MAKES IT." 31.9-33.6; banner SERVICE GRAVEYARD 33.8-38.8. → hard cut.
  39.20-44.40 tracking shot: QLDB, Snowmobile, CodeStar, CodeCommit. → hard cut, matched motion.
  44.40-49.00 tracking shot: Cloud9, OpsWorks, Honeycode, WorkDocs. → dip.
  49.00-52.00 EC2-Classic mausoleum; F at 50.00 → "RESPECT +" 50.03; MISSION PASSED 50.63-53.9.
  52.00-54.60 crane up over the graveyard. → blur swap.
  54.60-60.00 end card: logo 54.75, GRAND THEFT 55.00, AUTO SCALING 55.15 (+impact), edition 55.6, CTA 56.3, hold.
SOUND:   game hum 0-31.2 (fade out 0.6), game wind 31.2-60 (fade in 0.8, out 1.5); game whoosh (3 takes rotated) on each
         area change; game pager beep 15.55; game respect beep 50.0; game jingle 50.63; bass impact 55.15.
BANNED:  defaults list in spec.md; plus: captions repeating what the HUD already says; invented UI; music written in code.
QA:      0.5 (hook + lobby), 6 (Lambda banner), 16.5 (WANTED punch), 22.2 (white flash), 28 (crane + payoff line),
         33 (graveyard line), 41 / 46 (tombstones legible), 50.4 (RESPECT +), 51.5 (MISSION PASSED), 57 (end card).
