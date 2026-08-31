import { YZEC } from '@module/config';
import { MODULE_ID, SETTINGS_KEYS } from '@module/constants';

/**
 * Registers status effects, skipping any whose id the game system (or another
 * module) already claimed.
 *
 * Foundry v14 exposes `CONFIG.statusEffects` through a Proxy that is additionally
 * keyed by effect id. Its `ownKeys` trap emits one key per element id, so two
 * entries sharing an id break the Proxy invariant and make every
 * `Object.keys()` / `Object.values()` call over it throw — including core's
 * scene texture preloading, which is why *every scene draw after the first*
 * fails with "Texture loading failed: 'ownKeys' on proxy: trap returned
 * duplicate entries".
 *
 * The collision is real and shipping today: the Alien RPG system registers its
 * own `fastAction` and `slowAction` during `init`, and this module used to push
 * the same two ids unconditionally during `ready`.
 *
 * When a system already owns an id we defer to it rather than overwriting: the
 * system's icon and localisation are what its own sheets and macros expect, and
 * the combat tracker's fast/slow buttons do not read `CONFIG.statusEffects` at
 * all — they store a combatant flag — so nothing in this module regresses.
 *
 * @see https://github.com/fvtt-fria-ligan/yearzero-combat-fvtt/issues/93
 * @see https://github.com/pwatson100/alienrpg/issues/428
 * @param {object[]} effects Status effect configs to register
 * @returns {object[]} The effects that were actually added
 */
function registerStatusEffects(effects) {
  const claimed = new Set(CONFIG.statusEffects.map(e => e.id));
  const added = [];
  const skipped = [];

  for (const effect of effects) {
    // Guard against duplicates inside `effects` too, not just against
    // ids already present in CONFIG.statusEffects.
    if (claimed.has(effect.id)) {
      skipped.push(effect.id);
    }
    else {
      claimed.add(effect.id);
      added.push(effect);
    }
  }

  if (skipped.length) {
    logger.warn(
      `YZEC | Status effects already registered by "${game.system.id}", deferring to the system: ${skipped.join(', ')}`,
    );
  }
  if (added.length) CONFIG.statusEffects.push(...added);

  return added;
}

export function addSlowAndFastStatusEffects() {
  registerStatusEffects(YZEC.StatusEffects.slowAndFastActions);
}

export function addSingleActionStatusEffect() {
  registerStatusEffects(YZEC.StatusEffects.singleAction);
}

export function onRenderTokenHUD(_app, html, options) {
  const key = game.settings.get(MODULE_ID, SETTINGS_KEYS.ACTOR_SPEED_ATTRIBUTE);
  const speed = foundry.utils.getProperty(options.delta, key)
  || foundry.utils.getProperty(game.actors.get(options.actorId), key)
  || 1;

  // Remove unused single action status effects from HUD
  for (let i = 1 + speed; i <= 9; i++) {
    for (const effects of html.querySelectorAll(`.effect-control[data-status-id="action${i}"]`)) {
      effects.remove();
    }
  }
}
