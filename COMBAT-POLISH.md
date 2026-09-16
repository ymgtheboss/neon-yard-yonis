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
