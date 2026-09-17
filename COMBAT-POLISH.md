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
- A slide jump carries 92% of its current horizontal momentum once, ends the slide, and returns to standing/crouching only when the full body fits. The 7.1 jump impulse and existing gravity remain unchanged.
- Stair camera smoothing uses a short, bounded height offset for small grounded steps. It does not move the collision body, decays quickly in the air, and resets on respawn or teleport.
- Regression checks cover momentum preservation, speed bounds, unchanged jump apex, camera settling, and map collision/navigation.
