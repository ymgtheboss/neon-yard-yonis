# Combat Operations / version 5

Run `npm start` and open http://localhost:8000. The Subzero map remains the default. This update changes movement, operators, weapons, equipment, menus and results.

## Movement and operators

- Ground acceleration/deceleration and air control replace instant full-speed movement. Client prediction reconciles against server snapshots; camera position, stance transitions and FOV changes are smoothed.
- **Left Ctrl:** hold to crouch. **Z:** toggle prone. **Shift + C:** slide after building sprint speed. Shift + Ctrl also initiates a slide.
- Slides last 0.8 seconds, preserve momentum and have a 1.65-second initiation cooldown. Low ceilings prevent standing. A blocked attempt to go prone retains the previous stance.
- **Space:** jump. A 120 ms input buffer and 90 ms ledge grace period make jumps less timing-sensitive. Holding Space does not repeatedly jump.
- Characters are uniformly scaled to two-thirds of their original size (1.5 times smaller). Server collision heights: standing approximately 1.147 m, crouching 0.747 m, prone 0.347 m, sliding 0.6 m. Camera height and bullet hitboxes use the same scale. Prone requires a conservative 1.04 m square clearance footprint; damage rays use the narrower oriented body and separate head.
- Twelve named cosmetic finishes, three helmet styles, tapered armor, articulated shoulders/elbows/hips/knees, stance animations and a live menu preview replace the previous characters. Cosmetic choices share hitbox rules.

The enhanced movement uses Subzero's triangle collision. The historical Mill District fallback retains its original movement for regression/rollback purposes.

## Ten distinct weapons

| Weapon | Design | Magazine | Fire mode |
| --- | --- | ---: | --- |
| VOLT pistol | Compact moving slide and iron sights | 12 | Semi-auto |
| HAVOC rifle | Bullpup chassis, rear magazine, carry handle | 30 | Auto |
| BREACH shotgun | Twin tubes, pump action, shell carrier | 6 | Semi-auto |
| GHOST sniper | Skeletal stock, long barrel, optic, bipod | 5 | Bolt action cadence |
| RUSH SMG | Top magazine, wire stock, suppressor | 36 | Auto |
| BASILISK revolver | Six-chamber cylinder, long barrel, wood grip | 6 | Semi-auto |
| ATLAS LMG | Belt feed, ammunition box, top cover, bipod | 70 | Auto |
| KESTREL DMR | Wood chassis, low optic, precision barrel | 15 | Semi-auto |
| WRAITH carbine | Integrated suppressor, angled magazine, side rails | 28 | Auto |
| MAUL automatic shotgun | Large drum and short vented muzzle | 12 | Auto |

Models include hardware, seams, grip detail, moving mechanisms, magazine animation and shared third-person counterparts. Static parts are merged by material (at most 12 meshes per standalone weapon). These are procedural stylized models, with no external model or sound downloads.

Each weapon has its own layered audio profile: initial crack, tonal low-frequency body, decay and mechanical action. Reload sounds vary by weapon; explosive grenades have separate blast layers. Spatial attenuation and wall occlusion remain active, and a compressor and voice cap control overlap. Sound design is synthesized rather than recorded firearm audio.

**R reloads. 1/2 or the mouse wheel switches between your two equipped weapons.** Once a round starts, changing the selected weapon pair, equipment or skin is rejected by the server until the round ends. This also prevents pending loadout changes from applying on respawn; joining a room mid-round still uses the initial selected loadout.

## Equipment

Choose two equipment slots in the armory; use them with **G/H**.

- **Frag grenade:** damaging explosion with distance falloff and wall occlusion. Can damage its owner; spawn shields are respected.
- **Medkit:** instantly restores up to 45 health, capped at 100. Using it at full health does not consume it.
- **Flashbang:** retains facing, range and line-of-sight checks.
- **Smoke:** retains the ten-second smoke cloud.

Each consumed slot independently replenishes after **15 seconds**. Cooldowns survive death and are reset at the start of a new round. Weapon magazines are not refilled by this timer; the existing weapon reload system remains separate. Remaining equipment cooldowns appear in the HUD.

## Presentation and validation

The armory has ten silhouette cards, named operator finishes and a live preview. Results show a podium (including joint-lead labels on ties), personal statistics, K/D, accuracy and a scrollable player table. The armory action bar stays visible on shorter screens.

`npm test` covers 64 automated checks: 18 legacy engine checks, 14 client/presentation checks, six Subzero geometry/movement checks, 12 new combat rules checks, two GLB loader/parity checks and 12 live network checks. The optional `node tests/browser.cjs` launches an isolated Chrome session, displays ten weapon types across ten players, and captures the armory and final results in `tests/artifacts/`.

Headless browser verification uses SwiftShader software rendering and is not a hardware FPS benchmark. Manual multiplayer playtesting is still useful for balance, movement feel and audio preference. Subzero has unlit map materials, so unused main-scene shadow rendering is disabled; the menu background is capped at four renders per second and the small operator preview at fifteen. Active gameplay is not frame-rate capped by this change.
