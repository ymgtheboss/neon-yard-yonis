# Imported weapons and handling

All ten supplied GLBs replace the procedural fallback models in first person, on remote operators, and in the armory preview. The fallback remains available while assets load or if a download fails.

| Slot | Supplied model |
|---|---|
| VOLT | Glock 17 |
| HAVOC | AK-15 |
| BREACH | Mossberg 500 |
| GHOST | AWP |
| BASILISK | Colt Python |
| ATLAS | M249 |
| KESTREL | M14 |
| WRAITH | M4A1 |
| MAUL | AA-12 |
| RUSH | MP5 |

The compiler normalizes muzzle direction and dimensions, bakes transforms, groups identical materials, removes AK/M4 display extras, replaces the opaque M249 optic, and limits textures to 1024 pixels. Source files total 39.37 MB; compiled models total 13.38 MB, or 9.1 MB over gzip. Two concurrent downloads limit loading pressure; GPU meshes and textures are shared between instances. This is an asset reduction, not a hardware FPS guarantee.

Reflex and holographic sights use physical housings, coated glass and illuminated geometric reticles. The AWP and M14 use a magnified world view with a lens mask and graduated reticle. Magnification uses one world render, avoiding a second full scene render for the scope. Muzzle flashes use additive geometry with a brief light pulse and capped sparks; the scope view has a brief flash reflection.

Each weapon has its own recoil impulse, lateral variation, recovery speed and muzzle-flash size. Aiming, crouching and prone reduce recoil. Recoil changes the transmitted aim direction. Shells eject after the pump/bolt cycle on the shotgun/AWP; the revolver retains cases. Glock slides lock back on an empty magazine. Separable moving geometry animates on the Glock, AK, Mossberg, AWP, M14 and M4; the M249 box, Colt cylinder, AA-12 drum and MP5 magazine are detachable. Some source models are rigid, so not every trigger or internal component has a separate animation. Original animation names remain in the manifest for provenance; the game uses procedural action/reload timing rather than playing the original clips.

Shot sounds now use compact CC0 firearm recordings with per-weapon tuning, spatial positioning, wall muffling, indoor/outdoor reflection timing and a voice cap. Synthetic layers remain a loading fallback. Reload foley and varied footstep recordings are included; see [Combat polish](COMBAT-POLISH.md) and `public/audio/CREDITS.txt`.

Movement uses responsive grounded acceleration and braking, faster direction reversal, momentum-preserving air movement, and velocity-driven weapon bob. Landing motion uses predicted vertical velocity. Aim reduces sway; reduced-motion settings disable walking camera shake. Collision, jump buffering, coyote time, crouch, prone, slide and the previous character scale remain in place. Equipment still refreshes independently of weapon magazines; round loadouts remain locked.

## Credits and rebuilding

The menu links to `/weapon-credits.html`. Embedded source author, license and source links are retained in each GLB and `public/weapons/manifest.json`. The supplied Colt Python identifies its license as **CC-BY-NC-4.0**; the other supplied model metadata identifies **CC-BY-4.0**.

To rebuild assets from the original filenames in a directory:

```sh
node scripts/build-weapons.mjs /path/to/source/files
```

The offline build requires Python 3 with Pillow as well as installed project dependencies. Normal game startup does not require Python or the original downloads.

Validation: `node tests/weapons.cjs`, the client/combat/Subzero tests, and the network tests check asset integrity, action parts, motion, collision, and compressed asset delivery. `node tests/browser.cjs` loads all ten textured models in Chrome, renders hip-fire and ADS contact sheets, checks shared-resource reuse, and exercises multiplayer/results. Screenshots are saved under `tests/artifacts/`; headless SwiftShader telemetry is not a hardware benchmark.
