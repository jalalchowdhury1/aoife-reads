export function speechAvailable(): boolean { return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"; }
export function speak(text: string, rate = 0.9): Promise<void> {
  return new Promise(resolve => {
    if (!speechAvailable()) return resolve();
    const u = new SpeechSynthesisUtterance(text); u.rate = rate; u.lang = "en-US";
    const voice = window.speechSynthesis.getVoices().find(v => v.lang === "en-US" && /Samantha|Google US|Aria/.test(v.name)); if (voice) u.voice = voice;
    let done = false; const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish; u.onerror = finish;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    setTimeout(finish, 1000 + text.length * 120);   // iOS sometimes never fires onend
  });
}
export async function speakSequence(parts: string[], gapMs = 1000): Promise<void> {
  for (const p of parts) { const t0 = Date.now(); await speak(p, 0.8); const wait = gapMs - (Date.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait)); }
}
export function warmUpSpeech() { if (speechAvailable()) { window.speechSynthesis.getVoices(); speak(" "); } }
