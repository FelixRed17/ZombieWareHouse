import '../style.css';
import { Game } from './game/Game';

const viewport = document.querySelector<HTMLElement>('#viewport');
const ui = document.querySelector<HTMLElement>('#ui');
if (!viewport || !ui) throw new Error('Missing application containers.');

try {
  const game = new Game(viewport, ui);
  game.start();
  import.meta.hot?.dispose(() => game.dispose());
} catch (error) {
  console.error('Unable to start warehouse preview:', error);
  ui.innerHTML = '<section class="fatal"><h1>Unable to open the warehouse</h1><p>This preview needs a desktop browser with WebGL 2 and hardware acceleration enabled.</p><button type="button">TRY AGAIN</button></section>';
  ui.querySelector('button')?.addEventListener('click', () => window.location.reload());
}
