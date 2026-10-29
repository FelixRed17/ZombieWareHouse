import { HUD } from '../HUD';
import type { GameSnapshot } from '../../shared/types';

const ui = required<HTMLElement>('#ui');
const phaseInput = required<HTMLSelectElement>('#phase');
const healthInput = required<HTMLInputElement>('#health');
const ammoInput = required<HTMLInputElement>('#ammo');
const reserveInput = required<HTMLInputElement>('#reserve');
const timeInput = required<HTMLInputElement>('#time');
const killsInput = required<HTMLInputElement>('#kills');
const reloadingInput = required<HTMLInputElement>('#reloading');
const audioAvailableInput = required<HTMLInputElement>('#audio-available');
const audioMutedInput = required<HTMLInputElement>('#audio-muted');
const fixtureResult = required<HTMLOutputElement>('#fixture-result');
const fixtureTools = required<HTMLElement>('.fixture-tools');
const fixtureToggle = required<HTMLButtonElement>('#fixture-toggle');
let hud: HUD;
let longError = false;
let actionCount = 0;
let mounted = true;

function snapshot(): GameSnapshot {
  return {
    phase: phaseInput.value as GameSnapshot['phase'],
    health: healthInput.valueAsNumber,
    remainingSeconds: timeInput.valueAsNumber,
    kills: killsInput.valueAsNumber,
    weapon: {
      ammo: ammoInput.valueAsNumber,
      reserve: reserveInput.valueAsNumber,
      isReloading: reloadingInput.checked,
    },
  };
}

function render(): void {
  if (!mounted) return;
  hud.render(snapshot());
  hud.setAudioState({ muted: audioMutedInput.checked, available: audioAvailableInput.checked });
  hud.showNotice(longError
    ? 'Mouse capture failed. Please open this development preview directly in a desktop browser, confirm keyboard and mouse input are enabled, and retry the action. This fixture message is intentionally long so wrapping and visibility can be checked.'
    : 'FIXTURE · SAMPLE SNAPSHOT ONLY');
  for (const id of ['health', 'ammo', 'reserve', 'time', 'kills']) {
    const input = required<HTMLInputElement>(`#${id}`);
    required<HTMLOutputElement>(`#${id}-output`).value = input.value;
  }
}

function recordAction(action: string): void {
  actionCount++;
  fixtureResult.value = `Fixture action ${actionCount}: ${action}.`;
}

function createHUD(): HUD {
  return new HUD(ui, {
    onPlay: () => recordAction('onPlay'),
    onResume: () => recordAction('onResume'),
    onRestart: () => recordAction('onRestart'),
    onMenu: () => recordAction('onMenu'),
    onToggleMute: () => {
      audioMutedInput.checked = !audioMutedInput.checked;
      hud.setAudioState({ muted: audioMutedInput.checked, available: audioAvailableInput.checked });
      recordAction('onToggleMute');
    },
  });
}

hud = createHUD();
render();

for (const selector of ['#phase', '#health', '#ammo', '#reserve', '#time', '#kills', '#reloading']) {
  required<HTMLElement>(selector).addEventListener('input', render);
  required<HTMLElement>(selector).addEventListener('change', render);
}
for (const selector of ['#audio-available', '#audio-muted']) {
  required<HTMLInputElement>(selector).addEventListener('change', render);
}
required<HTMLButtonElement>('#long-error').addEventListener('click', () => {
  longError = !longError;
  render();
});
required<HTMLButtonElement>('#audit-listeners').addEventListener('click', () => {
  let detachedCalls = 0;
  for (let restart = 1; restart <= 3; restart++) {
    const detachedButton = ui.querySelector<HTMLButtonElement>('[data-play]');
    const beforeDispose = actionCount;
    hud.dispose();
    detachedButton?.click();
    detachedCalls += actionCount - beforeDispose;

    mounted = false;
    hud = createHUD();
    mounted = true;
    render();
  }

  const remountedButton = ui.querySelector<HTMLButtonElement>('[data-play]');
  const beforeClick = actionCount;
  remountedButton?.click();
  const freshCalls = actionCount - beforeClick;
  fixtureResult.value = `Three remounts: ${detachedCalls} detached callbacks; ${freshCalls} callback from the current button.`;
});
fixtureToggle.addEventListener('click', () => {
  const collapsed = fixtureTools.classList.toggle('is-collapsed');
  fixtureToggle.setAttribute('aria-expanded', String(!collapsed));
  fixtureToggle.textContent = collapsed ? 'SHOW FIXTURE' : 'HIDE FIXTURE';
});

function required<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing fixture control: ${selector}`);
  return element;
}
