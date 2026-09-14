# Upgrade coverage

| Agreed section | Delivered behavior |
| --- | --- |
| 1. Overall graphics | Warm block-inspired palette; pixel-pattern brick, plaster, wood, concrete, metal, tiles, dirt and grass; directional sun, shadows, hemisphere lighting and distance fog. |
| 2. Complete map rebuild | Mill District layout with four enterable landmarks, central tank court, intersecting streets, courtyard walls, flank routes and 12 validated spawn locations; spawn selection scores distance and cover. |
| 3. Buildings and interiors | Multi-room eastern buildings, interior stairs and landings, upper floors, open shooting windows, window/door framing, beams, roof trim, south balconies, outdoor rooftop stairs, ventilation units and work cabinets. |
| 4. Ground and scenery | Tile roads and pavements, dirt and grass courts, patterned ground variation, small debris, low hedges, grass clusters, trees, and buildings beyond the perimeter. |
| 5. Props and cover | Braced wooden crates, banded barrels, pallets, dumpsters, workbench, utility fences, fixed loading gates, signs, streetlights and detailed tank wreck; solid major cover stops bullets. |
| 6. Movement and collisions | Walking, sprinting, jumping, substepped movement, shallow step climbing, ceiling checks, floor/roof support and solid walls; clear stair and balcony access verified by movement tests. |
| 7. Weapon graphics | Five distinct detailed first-person weapons with magazines, barrels, sights, grips, stocks, hardware, gloved hands and block-shaped sleeves; owned weapon materials cleaned up on switching. |
| 8. Weapon animations | Idle and walking motion, sprint/aim blending, recoil, magazine reloads, shotgun pump and shell-loading gestures, weapon switching, muzzle flashes, muzzle-aligned trails, casings and surface-colored impact particles. |
| 9. Player models | Articulated operators with gear, walking/running leg motion, jumping pose, aim/reload motion, selected weapon silhouette, muzzle flash, visible health/name labels with wall/smoke checks, brief death fall and respawn shield. |
| 10. Grenades and effects | Detailed flash/smoke models, authoritative throw inventory, throwing gesture, substepped bounce collision and bounce sounds; timed smoke expansion/fade and inside-cloud effect; flash checks distance, facing and walls. |
| 11. Game interface | Matching menus/HUD, health/ammo/utility displays, crosshair, hit/headshot/kill feedback, kill feed, scoreboard, timer, results, area names, compass, reload progress/prompt, bindings and control help. |
| 12. Sound | Distinct synthesized weapon profiles, timed reload clicks, surface-aware footsteps, jumping/landing, impacts, grenade throw/bounce/detonation; directional remote audio, distance falloff, obstruction muffling and separate ambient slider. |
| 13. Multiplayer and rounds | Server-authoritative hits, damage and inventory; interpolated remote motion; timed respawn and shields; lobby/start/end/rematch; late joins, disconnect cleanup, host transfer, input timeout and ping replies. |
| 14. Performance and settings | Static boxes merged by material, instanced tree foliage, shared geometry/materials, bounded particles/casings, low-resolution local textures; three presets, adjustable shadows/resolution/FOV/mouse/audio/motion and optional FPS/ping. |
| 15. Combined delivery | Full compatible server/client/map/style/dependency folder, original backups, restore script with backup-first behavior, Mac launcher, quick-start guide and 37 reproducible checks. |

## Validation detail

- Engine: 18 checks covering clear spawns, both indoor stairs and roof stairs, balconies, ceilings/walls, window/roof rays, damage and cover, shields, fire rate, reload, obstructed muzzles, grenade inventory/collisions, flash visibility, smoke lifetime and round reset.
- Network: 9 checks covering served assets, source-file isolation, host authorization, ping, round/switch state, grenade inventory, timed results/rematch, host transfer and snapshots with 15 clients.
- Client logic: 10 checks covering initialization, finite geometry, all weapon builds, presets, HUD/remote models/labels, trails/casings/impacts, smoke/grenade cleanup, reload/throw animation, label visibility and disconnect cleanup.
- Browser visual output, actual audio quality, manual multiplayer play and iMac FPS could not be verified in this environment. The client harness uses renderer/DOM doubles and is not a replacement for that playtest.
