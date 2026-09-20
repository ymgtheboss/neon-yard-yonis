# Combat presentation upgrade

Run `npm start`, open http://localhost:8000, and start a round.

- First-person reloads now have timed reach, extraction, insertion and chambering phases; shotgun shell-loading and AWP bolt-hand motions use separate poses. Gloves have cuffs, forearms and knuckle pads. The supplied Colt cylinder, AA-12 drum and MP5 magazine now move independently. A small held grenade accompanies the throw gesture. Reloading temporarily leaves ADS.
- Server-confirmed feedback shows damage dealt, a distinct headshot marker, elimination text and an incoming-damage direction arc. Headshot kills are counted by the server and reset each round.
- Ten recorded firearm clips replace the synthetic gunshots once downloaded and decoded. Reload foley follows animation timing, snow/wood/concrete/grass footsteps have three variations, and gunshots use different reflection timing beneath roofs. Positional sound, wall muffling, a voice limit and a compressor remain enabled. Crouched/prone footsteps are quieter.
- Character leg cadence follows movement speed and stops in the air. Strafing turns the hips while the torso keeps aiming; landing compression and stance/limb transitions blend smoothly.
- Results preserve the completed round, show the leading player's actual skin and gun, headshot kills, personal medals and map voting. Each player can change one vote. The host applies the winning vote (ties favor the current map), waits for everyone to load, and starts the next match. The host can still choose another map.

Audio sources and licenses are linked from the menu and saved in `public/audio/CREDITS.txt`. The firearm samples are CC0 recordings of similar weapon families, not exact recordings of all ten supplied models. The final audio payload is under 1 MB; the full source library is not shipped. Synthetic sound remains a fallback during audio loading or if a download fails. Animations are procedural, using the supplied models and constructed arms rather than motion capture.

Subzero footstep materials are derived from render/collision triangle matches; Bellhaven uses stone with wooden elevated-platform zones. These cues do not affect collision or damage. Rebuild Subzero's tags with `node scripts/build-surface-audio.cjs` after rebuilding its GLB/collision.

Rebuild audio with `python3 scripts/build-combat-audio.py /path/to/extracted/sources`. The source folder should contain `Prepared SFX Library/`, Kenney's `Audio/`, `clipload2.wav`, and `singlebullet1.wav`; download links are in the credits.

Validation: engine, client, combat, Subzero/Bellhaven collision, weapon-asset and multiplayer checks; `node tests/browser.cjs --presentation` captures actual reload poses and checks audio decoding, the winner preview and voting UI. Browser screenshots use software rendering and are not hardware FPS measurements.

## Handling and sight fitting

- Weapon-specific sight widths, heights, housing shapes and eye relief; compact reflex sights for sidearms and SMGs, chamfered holographic sights for rifles, and a fitted M14 tube. The AWP retains its imported scope. Magnified masks use viewport-relative dimensions, with separate AWP/M14 sizes.
- Confirmed hit markers pulse and fade; short bursts accumulate actual damage per target ID. Headshots and eliminations have distinct tones, with audio overlap limited during rapid fire. Player impacts use small spark streaks.
- Ground acceleration and braking are more responsive, with slightly more forgiving jump buffering and coyote time. Slides allow gentle steering without adding speed. Weapon bob blends in and out; airborne camera tracking is tighter and landing motion respects the motion setting.
- Verified with combat/client checks, movement consistency at 30/60/120 Hz, and real Chrome rendering of all ten weapons plus a multiplayer round.

## Human operators, Subzero scale and killcam

- Twelve human outfits replace the armored alien-like operators. Hats, hairstyles, hoods, packs, coats, pouches, medic markings, and exposed forearms vary by outfit. First-person sleeves/skin also follow the selected operator. Cosmetic choices share gameplay dimensions.
- Subzero characters use the previous scale divided by 1.3 (about 77% of the previous size); Bellhaven remains unchanged. Server hitboxes, movement prediction, eye height, muzzle origins and remote models share the replicated scale. Jump velocity and gravity are unchanged.
- Enemy eliminations show up to 2.6 seconds of buffered killer-view replay followed by a short hold. Space or the Skip button ends it. Respawn, map changes, disconnects and round endings terminate playback. Self/environment deaths do not start a killer replay.
- The killcam reconstructs received player snapshots and shooter traces; it is not a frame-perfect video or full replay of smoke/grenade simulations. It uses a separate scene sharing map assets, with bounded history and disposal of replay rigs.
- Validation: full logic/collision/network suite, identical jump apex at both scales, map-switch scale replication, replay/skip/respawn checks, and Chrome outfit/replay visual checks.

## Controls, reload presentation and surface detail

- Settings now expose independent aim/sniper sensitivity multipliers and hold/toggle right-click aiming. The default multipliers preserve the previous aim sensitivity.
- Reload hands articulate their fingers during reach and replacement. Empty detachable-magazine reloads release one visible magazine; tactical reloads retain it. Dropped magazines are capped at six and removed after four seconds. Reload cues align with extraction, seating and chambering phases.
- First-person weapons have softer fill, a warm key and a cool edge light. Grounded characters get a soft contact shadow when shadows are enabled; Subzero's baked materials remain intact.
- Collision-triangle material labels distinguish snow, wood, metal, masonry and plaster. Impacts use different particle shapes, and surface-normal-aligned bullet marks fade after ten seconds (24 marks on Performance, 64 otherwise). Unmatched simplified collision faces use concrete as a fallback.
- Rebuild material labels after regenerating either map with `node scripts/build-impact-surfaces.cjs`. The small `*-impacts.bin` files are server assets and must ship with the maps.
- Validation includes actual mouse-event sensitivity/toggle tests, single-magazine-drop and cleanup checks, the full test suite, and Chrome reload-pose/multiplayer rendering checks.

## Movement flow

- Air input rotates horizontal velocity at a limited rate instead of blending it toward a new direction and losing speed. Air acceleration is bounded by the ordinary movement speed; carried slide momentum cannot be multiplied by circling.
- A slide jump carries its current horizontal momentum without a takeoff penalty, ends the slide, and returns to standing/crouching only when the full body fits. The 7.1 jump impulse and existing gravity remain unchanged.
- Stair camera smoothing uses a short, bounded height offset for small grounded steps. It does not move the collision body, decays quickly in the air, and resets on respawn or teleport.
- Regression checks cover momentum preservation, speed bounds, unchanged jump apex, camera settling, and map collision/navigation.

## Immediate firing and direct movement response

- The browser predicts its own recoil, muzzle flash, casing, sound and ammo display immediately. Explicit, increasing shot IDs connect each cosmetic shot to authoritative server confirmation; confirmed tracers, impacts, hit markers and damage still come from the server.
- The server validates spawn/map/slot, readiness, life, reload, ammo, muzzle obstruction and weapon cooldown. It permits only one request to wait up to 50 ms for a cooldown, and rejects duplicates. Existing clients without the predicted-fire protocol retain the previous firing path.
- Ammo prediction stays pending until an authoritative snapshot acknowledges it. Rejections restore the local ammo display. Accepted confirmations never restart the local automatic-fire timer. Switching waits for the server's selected slot; reload/switch delays also block local firing effects.
- Movement prediction now runs on each rendered frame, sampling current controls. Both client and server split collision movement into steps no longer than 1/120 second. Network input and state updates remain at 30 Hz.
- The camera follows current predicted horizontal movement and jump position directly. Only network correction offsets, stair transitions and stance eye-height changes are smoothed; large corrections snap instead of dragging the camera across the map. Velocity extrapolation through walls has been removed.

Validation: client VM tests cover immediate effects, delayed confirmation deduplication, ammo reconciliation, semi-auto/reload/switch gating and camera response before a network send. Server and real WebSocket tests cover shot identity, cooldown, stale spawn/slot, reload/death and duplicate held-fire suppression. Shared physics tests cover collision and movement/jump agreement at 30/60/120 Hz. Hardware frame pacing and subjective movement feel still need playtesting on the player's device.


## Momentum, weapon framing and contact polish

- Sprinting while firing targets 8.4 rather than 6 units/second (normal sprint remains 9). Slides recover after 0.6 seconds (an active slide cannot refresh itself), lose speed more gradually, and carry their takeoff speed into a jump. Forward landings bleed excess momentum gently; aiming, releasing movement and reversing still brake promptly. Jump impulse, gravity and maximum slide boost remain unchanged.
- Hip poses are fitted by weapon family. Reloads lower the gun instead of lifting it into the sightline, sprint rotations are smaller, and recoil is applied directly after pose smoothing. Turning sway is normalized for frame duration; landing dip is smaller and settles faster. Existing per-model ADS fitting is preserved.
- Wall contact advances to a bounded safe fraction of the blocked axis step, while allowing movement along the other axis. Contact refinement stops within 4 mm and at three probes; stance-clearance checks run only when changing stance. Doorway, slope, ceiling, thin-wall and both-map traversal regression checks cover the changes.
- Both world-animation passes share one interpolated player list each frame. Optional telemetry includes the rolling 95th-percentile frame interval to expose stutter hidden by average FPS. It measures the browser's actual frame interval, including stalls; it is not server ping. Hardware GPU performance still requires testing on the target device.
- Validation: momentum/braking and takeoff tests, immediate weapon-kick and reload-framing checks, full regression suite, and real Chrome weapon/reload rendering and multiplayer smoke test. Chrome uses software rendering here, so its FPS is not a hardware performance estimate.


## FOV and live controls

- Default/reset FOV is 110. Saved settings at the former 85 default migrate once; other customized values remain intact.
- Hold Tab to view the scoreboard while moving, sprinting, jumping and looking around. It keeps pointer lock, uses a lighter overlay and closes on release or input reset. Settings/pause/results screens retain their normal behavior.
- Jump presses are latched separately for local prediction and network input so a quick Space tap while sprinting is not lost between updates. Jump height and momentum rules are unchanged.
- Validated with client input-event tests, short-tap delivery, scoreboard/reset behavior and saved-FOV migration checks.

## Real weapon images in the armory

Weapon cards and both selected loadout slots now use transparent WebP renders of the actual textured GLB models and fitted optics. The ten images are static assets, so the menu does not create extra WebGL scenes or render loops. Rebuild after changing models or optics with `node tests/browser.cjs --build-weapon-previews`; validate desktop/mobile layouts with `node tests/browser.cjs --menu`.

## Reliable sprint-jump presses

A short jump press could still be overwritten by its release when both network inputs arrived before a server physics tick. Each press now has a monotonic ID, retained in subsequent input packets and acknowledged in movement snapshots. Client prediction and server physics consume each ID once, preserving sprint momentum without repeating the jump on landing. Respawn seeds the consumed ID from the last received request, and a new connection resets the client's ID counter. Legacy clients retain button-edge support. Regression coverage includes the formerly failing press/release-overwrite case, local input sampling, and real WebSocket sprint-jump delivery.

## Hit feedback, weapon roles and standalone training

- Confirmed hits now add bounded, fading damage numbers over the victim, with gold headshots and green KO labels. Body/headshot sounds have distinct two-tone signatures; eliminations add a short chord. Incoming hits display the actual health lost alongside the directional indicator.
- Ten weapon profiles now have class-specific damage falloff and ADS spread. Shotguns retain broad patterns while aiming; rifles, sidearms, sustained-fire weapons and precision guns have explicit roles shown in the armory. See `WEAPON-BALANCE.md` for values and tradeoffs.
- The Play page links to `/practice`: a separate range with five target distances, optional lateral movement, actual GLBs and shot recordings, target health/damage/kill-time feedback, session accuracy, manual reloads and unrestricted setup loadout changes. It uses shared damage/spread and collision code and does not join or modify multiplayer rooms.
- Validation: shared-rule and feedback tests, full regression suite including network game modes, and Chrome target-hit/reset/motion/model-selection checks. Balance remains a first tuning pass to refine through playtesting.

### Slide-jump chaining and air steering

- Jump and slide presses buffer for 180 ms, with sequence IDs preserving quick taps between server ticks. A slide tapped before landing can carry into a buffered jump.
- Landing preserves forward momentum for 120 ms; releasing movement and aiming still brake. Air steering turns at a bounded rate without adding speed beyond the 11-unit/second cap. Jump impulse and gravity remain unchanged.
