# NEON YARD — Subzero

Subzero is now the default map. See [SUBZERO.md](SUBZERO.md) for startup, optimization, collision, attribution, and validation details. The Mill District instructions below describe the retained legacy arena (`WORLD_MAP=mill npm start`).

# NEON YARD — Mill District

Your complete upgraded game, based on the project you uploaded.

## Start on your Mac

1. In the terminal running your old game, press **Control+C**.
2. Extract this ZIP. Keep the new **neon-yard-mill-district** folder together.
3. Open Terminal in that folder. In Finder, you can right-click the folder and choose **Services → New Terminal at Folder**.
4. Run:

   ```bash
   node server.cjs
   ```

5. Open **http://localhost:8000** on the hosting Mac.
6. Friends on the same network open the local address printed in your terminal. Everyone should refresh their browser after an update.
7. Choose two weapons and your grenades, enter the arena, then the first player to join presses **Start 3:30 Round**.

Keep Terminal open. **Control+C** stops the server. `npm start` does the same thing as `node server.cjs`.

The ZIP includes the exact Three.js and ws dependencies from your uploaded project, so no installation is needed. If you remove `node_modules`, run `npm ci` before launching. Do not run your old `upgrade-map.cjs` against this version.

`Start-Game.command` is also included as a convenience launcher. If macOS does not open it, use the Terminal command above.

## Controls

| Action | Default control |
| --- | --- |
| Move | W A S D |
| Sprint | Left Shift |
| Jump / climb stairs | Space / walk forward |
| Fire | Left mouse |
| Aim | Right mouse |
| Reload | R |
| Select weapon | 1 / 2 or mouse wheel |
| Throw grenade | G / H |
| Scoreboard | Hold Tab |
| Release mouse / menu | Escape |

Rebind keyboard controls in Settings. Weapons and both grenades refill on respawn; reload ammunition is unlimited, as in your original game. Switching cancels the current reload. Changing the loadout during a round applies on the next respawn.

## Explore the map

- **North Mill:** the tan timber building in the northwest; wide loading doors and interior crates.
- **Red Barn:** the red timber building in the southwest; grass approaches and several entrances.
- **Foundry A:** the northeast building; interior stairs, upper rooms, a balcony and roof access.
- **Workshop B:** the southeast building with the same clear stair layout.
- **Tank Court:** the central wreck, approached through four offset lanes.
- **Service lanes:** tiled streets, flank routes, utility fences, loading gates and staggered cover.

Inside the eastern buildings, the stairs are along the western wall. The outdoor roof stairs run along each building's north side: enter at the low western end, climb east, then turn toward the roof through the parapet opening. Upstairs balconies face south.

## Graphics and audio

Start with **Balanced**. For an older iMac, choose **Performance / older Mac** to disable shadows and lower resolution. High detail uses higher resolution and 2048-pixel shadows. You can adjust shadows independently, reduce weapon motion, change FOV and sensitivity, and hide the FPS/ping display.

Sounds are generated locally: distinct weapon reports, reload clicks, footsteps, jump/landing sounds, throws, bounces, impacts, smoke and flashbangs. Remote sounds use stereo positioning and distance falloff; walls reduce their volume. Headphones help. Background ambience has its own slider, and the main volume controls all audio.

## Backup and restore

Your original server, client and package files are in **original-backup**. Your existing game folder on your Mac is also unchanged when you run this upgrade from its separate folder.

To restore the original game inside this folder, first stop the server, then run:

```bash
node restore-original.cjs
node server.cjs
```

The restore script saves the upgraded files in a timestamped backup folder before restoring anything.

## Validation and limitations

**37 checks passed:** 18 engine/gameplay checks, 9 live HTTP/WebSocket checks, and 10 client logic checks. The live network checks included 15 simultaneous clients, host transfer, round completion and rematch. Run them again with `npm test`.

Client tests execute the actual geometry and animation code with a DOM/renderer double. They do **not** establish visual rendering, audible quality, actual browser input capture or frame rate. The remote test browser was unable to open this workspace's local server, so visual/browser playtesting and performance on your iMac remain unverified. No specific FPS is promised.

This is a custom map inspired by the screenshots' blocky art direction, with procedurally built graphics and sounds. It does not use the original screenshots' game assets. Collision follows the major solid structures and props; tiny trim and scattered grass are decorative so players do not get stuck on them.

The agreed 15 upgrade sections are covered in **UPGRADE-CHECKLIST.md**. The optional ideas listed afterward—bots, teams, extra modes, crouching, sliding, minimap, destructible objects and additional maps—were not part of those 15 sections and are not included. Existing weapon and armor selection remain available.
