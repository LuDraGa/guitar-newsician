export function createBrowserAudioContext() {
  const AudioContextCtor =
    window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not available in this browser');
  }

  return new AudioContextCtor();
}
