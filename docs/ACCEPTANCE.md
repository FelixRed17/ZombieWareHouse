# Core game acceptance checklist

This is the **future MVP release gate**, not a claim that the scaffold implements or passes these items. The scaffold is ready for team work when dependencies install, TypeScript/build checks pass, and the warehouse preview renders.

## Scaffold smoke check

- [ ] `npm ci` succeeds from the committed lockfile.
- [ ] `npm run typecheck` and `npm run build` succeed.
- [ ] Main menu renders the warehouse without application errors.
- [ ] Enter captures the mouse, hides the panel, shows a crosshair, and starts the timer.
- [ ] WASD/sprint move on the ground; walls and the central crates block movement.
- [ ] Esc/focus loss pauses; waiting on the pause panel does not consume round time.
- [ ] Resume recaptures the mouse without resetting the run.
- [ ] Main menu then Enter resets the position, round time, and stats.
- [ ] The UI clearly explains that combat, enemies, pickups, and sound are unfinished.

## Combat and round lifecycle · Person 1

- [ ] Normalized diagonal movement; pitch does not change movement speed.
- [ ] Shoot costs one round on both hits and misses; cooldown rejects extra attempts.
- [ ] Empty magazine, reloading, pause, and menus reject shots.
- [ ] Cover blocks a shot even when the zombie is directly behind it.
- [ ] Child-mesh hits resolve to the correct zombie; a dead zombie cannot award another kill.
- [ ] Reload takes 1.5 active seconds; reserve transfer is limited by available ammo.
- [ ] Full-magazine reload, zero reserve, partial reserve, repeated reload, pause mid-reload, and restart mid-reload behave correctly.
- [ ] Fatal damage ends the run; health cannot drop below zero or heal above 100.
- [ ] A round wins at 300 simulated active seconds; death wins a same-frame tie.

## Enemies · Person 2

- [ ] Zombies appear in valid positions at least 8 units from the player.
- [ ] Zombies pursue on XZ; crates/walls block their motion.
- [ ] Navigation works around both central crates rather than permanently sticking.
- [ ] Attack damage happens only within range and with the configured cooldown.
- [ ] No attacks/spawns/mixer progression during pause or after an outcome.
- [ ] Three 34-damage hits kill a 100-HP zombie; death occurs exactly once.
- [ ] Spawn pressure increases, never exceeds 24 living enemies, and resets on restart.
- [ ] Missing model/animation clips leave a working procedural enemy.

## World, pickups, presentation · Person 3

- [ ] Visible cover, movement collision, and raycast blockers agree.
- [ ] Player and spawn points are reachable and not inside obstacles.
- [ ] Targets are readable under the dark industrial lighting.
- [ ] Health and ammo pickups are distinct and collect once per item.
- [ ] Health is capped at 100; ammo goes to reserve and does not refill the magazine instantly.
- [ ] Controlled respawns support the full five-minute round without duplicate pickups.
- [ ] HUD shows real health/ammo/timer/kills/reload state; menu buttons work.
- [ ] Main, pause, death, and victory screens are legible at 1366×768.
- [ ] Audio begins only after a user gesture; mute and pause work; missing sound files do not stop play.
- [ ] Every third-party asset has a source URL, author/license record, and required attribution.

## Combined run · all three

- [ ] Complete one real five-minute run in a desktop browser; do not replace this with a shortened test.
- [ ] Use a temporary development configuration to quickly verify death/victory/restart, then restore release tuning.
- [ ] Restart three times without duplicate enemies, pickups, input handlers, audio, or animation loops.
- [ ] No stale asynchronous asset loads add objects from a previous run.
- [ ] Check console errors and excessive rendering cost; record the tested browser/device and observed frame rate rather than promising universal performance.
- [ ] Production preview works, including asset URLs under a repository subdirectory if that hosting option is selected.
