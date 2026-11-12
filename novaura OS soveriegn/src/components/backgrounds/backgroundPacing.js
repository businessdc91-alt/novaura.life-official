/**
 * Shared pacing for the animated desktop backgrounds.
 *
 * - The simulation steps at most 60 times a second, whatever the screen's refresh rate.
 * - Behind open windows ("calm") it eases down to half pace under a dimming veil.
 * - It stops while the app is minimized. While another app has focus it keeps moving,
 *   unless the "pause when another app is in front" setting is on. It picks up again
 *   when the app comes back.
 */

// Pace and veil (alpha of the background colour laid over each frame) behind open windows
export const CALM_PACE = 0.5;
export const CALM_VEIL = 0.45;

const STEP_MS = 1000 / 60;

// Visible, and focused too when pauseUnfocused is set. Focus inside an iframe on the
// page still counts as the app's.
export function isAppActive(pauseUnfocused = false) {
  return !document.hidden && (!pauseUnfocused || document.hasFocus());
}

/**
 * Runs step(time, veil) through requestAnimationFrame, at most 60 times a second.
 * `time` is the simulation clock in seconds; `veil` is 0 normally and eases toward
 * CALM_VEIL while getCalm() is true, for step() to lay over the frame it drew.
 * getPauseUnfocused() true also stops the loop while another app has focus.
 * Returns a function that stops the loop and removes its listeners.
 */
export function runPacedLoop(step, getCalm, getPauseUnfocused = () => false) {
  let raf = 0;
  let last = 0;
  let budget = 1; // steps owed
  let pace = 1;
  let veil = 0;
  let time = Date.now() * 0.001;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const elapsed = last ? Math.min(now - last, 50) : STEP_MS;
    last = now;
    const calm = getCalm();
    pace += ((calm ? CALM_PACE : 1) - pace) * 0.05;
    veil += ((calm ? CALM_VEIL : 0) - veil) * 0.05;
    budget += (elapsed / STEP_MS) * pace;
    if (budget < 1) return; // the canvas keeps the last frame
    budget = Math.min(budget - 1, 1); // a slow machine runs slower rather than catching up
    time += 1 / 60;
    step(time, veil);
  };

  // While stopped, a slow check catches focus coming back by a route that fires no event
  // on this window, such as a click straight into an iframe
  let poll = 0;
  const start = () => {
    clearInterval(poll);
    poll = 0;
    if (raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!poll) poll = setInterval(sync, 1000);
  };
  const sync = () => (isAppActive(getPauseUnfocused()) ? start() : stop());
  // A blur can mean focus only moved into an iframe on the page; check once it has settled
  let blurTimer = 0;
  const onBlur = () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(sync, 0);
  };

  document.addEventListener('visibilitychange', sync);
  window.addEventListener('focus', sync);
  window.addEventListener('blur', onBlur);
  // Always draw one frame, so a background started while the app is inactive isn't blank
  step(time, veil);
  sync();

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(poll);
    clearTimeout(blurTimer);
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('focus', sync);
    window.removeEventListener('blur', onBlur);
  };
}
