# Weapon roles and practice range

This is an initial tuning pass, not a claim of perfect competitive balance. Damage is applied by the server; the standalone practice range imports the same weapon table and damage/spread functions.

| Weapon | Role | Close body damage | Shot interval | Falloff starts → ends | Minimum damage multiplier |
|---|---|---:|---:|---:|---:|
| Glock 17 | Fast backup | 28 | 0.24 s | 12 → 38 m | 55% |
| AK-15 | Mid-range power | 26 | 0.125 s | 22 → 65 m | 72% |
| Mossberg 500 | Close burst | 13 × 8 pellets | 0.9 s | 7 → 26 m | 20% |
| AWP | Long-range precision | 100 | 1.35 s | 50 → 100 m | 85% |
| Colt Python | High-risk sidearm | 58 | 0.55 s | 18 → 50 m | 65% |
| M249 | Sustained support | 23 | 0.12 s | 25 → 70 m | 72% |
| M14 | Precision follow-up | 50 | 0.38 s | 35 → 90 m | 86% |
| M4A1 | Controllable all-rounder | 22 | 0.095 s | 18 → 60 m | 68% |
| AA-12 | Close pressure | 9 × 8 pellets | 0.4 s | 5 → 20 m | 18% |
| MP5 | Mobile close quarters | 18 | 0.075 s | 10 → 38 m | 45% |

Falloff is linear between the two distances, with integer damage rounded per pellet. Headshots multiply damage by 1.8, except shotguns use 1.25. ADS accuracy varies by weapon family; aiming no longer compresses shotgun spread like a rifle. Airborne sniper spread is four times grounded spread. Crouch/prone accuracy modifiers remain in place. The LMG retains its large magazine and slow reload, while the AWP trades one-shot body damage inside its full-damage range for a slow bolt cycle and poor hip accuracy.

## Practice

Open **Practice range** on the main Play page, or `/practice` on the running server. It is a separate local training session, with no WebSocket connection and no effect on multiplayer rooms or scores. Choose either loadout slot in setup, then enter the range. Esc returns to setup at any time; 1/2 switch slots, R reloads manually, and Q resets targets, ammo and session statistics.

Five target lanes are marked at 8, 15, 25, 40 and 50 metres downrange. Hit readouts show actual shot distance, damage, remaining health and first-hit-to-kill time. Accuracy counts shots that hit, not individual pellets. Targets return after 1.1 seconds. Enable moving targets in setup for lateral tracking practice. The range uses the supplied gun models, recorded shot sounds, shared movement collision, and saved FOV/sensitivity/volume preferences. Range loadout changes do not alter the saved multiplayer loadout.

## Feedback

Only confirmed multiplayer damage produces hit sounds, markers and target damage numbers. Short bursts accumulate damage per target; numbers are capped at eight live labels, fade promptly and respect reduced motion. Headshots have a higher two-tone sound and gold text; eliminations add a short chord and a KO label. Incoming hits show the health lost beside the existing directional warning.

Validation covers monotonic damage falloff, weapon-family tradeoffs, pellet/headshot rules, confirmed HUD feedback, the existing full regression suite, and Chrome checks for range loading, model selection, target hits/kills, reset and moving-target animation. Hardware performance and long-term competitive balance still require live playtesting.


## Hip-fire spread pass

Sniper hip spread is now 0.38 radians across, Mossberg spread 0.24, and AA-12 spread 0.30. Shots/pellets sample a uniformly distributed circular area instead of independent horizontal/vertical offsets. Scoped sniper spread stays approximately 0.0009 radians across; shotgun ADS retains 85% of hip spread. Airborne sniper spread multiplies hip spread by 1.6 and scoped spread by 4; other stance modifiers are unchanged.

The four-tick crosshair expands to the projected spread diameter for the current FOV, viewport height, weapon and stance. Snipers and shotguns show a faint boundary ring. This depicts the angular spread area, not a guarantee that every pellet lands on its edge or that recoil/nearby muzzle parallax is absent. Main game and range import the same sampling/projection helpers. Tests cover bounds, distribution, scoped accuracy, stance/FOV sizing and crosshair visibility.
