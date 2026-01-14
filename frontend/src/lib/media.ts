export async function getMediaStream(video: boolean, audio: boolean): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 373 }, height: { ideal: 280 }, facingMode: "user" } : false,
      audio: audio,
    });
    return stream;
  } catch (err) {
    console.error("Error accessing media devices:", err);
    throw err;
  }
}

export function createAudioAnalyzer(stream: MediaStream): {
  audioContext: AudioContext;
  analyser: AnalyserNode;
  dataArray: Uint8Array;
} {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser); // Note: Don't connect to destination to avoid feedback loop
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  return { audioContext, analyser, dataArray };
}
