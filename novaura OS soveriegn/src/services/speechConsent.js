/**
 * Voice input in Sovereign uses the web engine's speech recognition
 * (window.SpeechRecognition). In WebView2 that is Microsoft's online speech
 * service: the audio leaves this PC. Everything else in Sovereign stays local, so
 * this is asked once per profile, plainly, before the first use.
 */

const KEY = 'novaura_cloud_speech_ok';

export const CLOUD_SPEECH_NOTICE =
  "Voice input uses Microsoft's online speech recognition, built into Windows' web engine: what you say is sent to Microsoft to be turned into text. Nothing else you do in Sovereign is sent.\n\nUse voice input?";

/** True when voice input may start (asks the first time). */
export function cloudSpeechAllowed(confirm = (msg) => window.confirm(msg)) {
  try {
    if (localStorage.getItem(KEY) === 'yes') return true;
  } catch { /* storage unavailable: ask every time */ }
  const ok = confirm(CLOUD_SPEECH_NOTICE);
  if (ok) {
    try {
      localStorage.setItem(KEY, 'yes');
    } catch { /* asked again next time */ }
  }
  return ok;
}
