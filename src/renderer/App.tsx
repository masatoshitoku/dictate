import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './store';
import {
  BELL_CURVE,
  BAR_COUNT,
  INITIAL_AUDIO_LEVELS,
  computeBarHeight,
  computeAudioLevelsInto,
} from '../shared/waveform';

// ============================================================================
// Singleton stream manager - survives component remounts
// ============================================================================

let globalStream: MediaStream | null = null;
let streamInitPromise: Promise<MediaStream | null> | null = null;

/**
 * Close an AudioContext safely, ignoring errors if already closed.
 */
function closeAudioContext(ctx: AudioContext | null): void {
  if (!ctx) return;
  try { ctx.close(); } catch { /* already closed */ }
}

export default function App() {
  const { status, setStatus, setLastTranscription, setError } = useStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const currentSessionChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([...INITIAL_AUDIO_LEVELS]);
  const levelsBufferRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const barRefsArray = useRef<(HTMLDivElement | null)[]>([]);

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isTyping = status === 'typing';

  /** Reset audio visualization state to idle defaults. */
  const resetAudioState = useCallback(() => {
    analyserRef.current = null;
    dataArrayRef.current = null;
    mediaRecorderRef.current = null;
    currentSessionChunksRef.current = [];
    setAudioLevels([...INITIAL_AUDIO_LEVELS]);
  }, []);

  // Cleanup function — does NOT stop the global stream
  const cleanupRecording = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    closeAudioContext(audioContextRef.current);
    audioContextRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    resetAudioState();
  }, [resetAudioState]);

  // Initialize stream ONCE globally
  const initGlobalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (globalStream) {
      if (!globalStream.active) {
        globalStream = null;
      } else {
        const tracks = globalStream.getAudioTracks();
        const allTracksLive = tracks.length > 0 && tracks.every(track => track.readyState === 'live');
        if (allTracksLive) return globalStream;
        globalStream = null;
      }
    }

    if (streamInitPromise) return streamInitPromise;

    const hasPermission = await window.electronAPI.checkMicrophonePermission();
    if (!hasPermission) {
      setError('マイクの権限ダイアログが表示されています。「許可」をクリックしてから再度お試しください。');
      return null;
    }

    streamInitPromise = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        });
        globalStream = stream;
        stream.getAudioTracks().forEach(track => {
          track.onended = () => { globalStream = null; };
        });
        return stream;
      } catch (error) {
        console.error('[Dictate] Failed to get microphone stream:', error);
        globalStream = null;
        setError('マイクへのアクセスに失敗しました。');
        return null;
      } finally {
        streamInitPromise = null;
      }
    })();

    return streamInitPromise;
  }, [setError]);

  useEffect(() => {
    const unsubscribeStatus = window.electronAPI.onStatusChanged((newStatus) => {
      setStatus(newStatus);
    });

    const unsubscribeTranscription = window.electronAPI.onTranscriptionResult((result) => {
      setLastTranscription(result.formattedText);
    });

    const unsubscribeError = window.electronAPI.onError((message) => {
      setError(message);
    });

    const unsubscribeStartCapture = window.electronAPI.onStartAudioCapture(async () => {
      try {
        cleanupRecording();

        const stream = await initGlobalStream();
        if (!stream) return;

        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') await audioContext.resume();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        analyserRef.current = analyser;

        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        // rAF loop — self-terminates when refs are nulled by cleanup
        const updateLevels = () => {
          const currentAnalyser = analyserRef.current;
          const dataArray = dataArrayRef.current;
          if (!currentAnalyser || !dataArray) return;

          currentAnalyser.getByteFrequencyData(dataArray);
          computeAudioLevelsInto(dataArray, BAR_COUNT, levelsBufferRef.current);

          // Direct DOM update — bypasses React reconciliation at 60fps
          const bars = barRefsArray.current;
          for (let i = 0; i < BAR_COUNT; i++) {
            const bar = bars[i];
            if (bar) {
              bar.style.height = `${computeBarHeight(levelsBufferRef.current[i], BELL_CURVE[i])}px`;
            }
          }

          animationRef.current = requestAnimationFrame(updateLevels);
        };
        updateLevels();

        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

        mediaRecorder.onerror = () => {
          globalStream = null;
          cleanupRecording();
          setError('録音中にエラーが発生しました');
        };

        const sessionChunks: Blob[] = [];
        currentSessionChunksRef.current = sessionChunks;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) sessionChunks.push(event.data);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      } catch (error) {
        console.error('[Dictate] Failed to start audio capture:', error);
        cleanupRecording();
        setError('マイクへのアクセスに失敗しました');
      }
    });

    const unsubscribeStopCapture = window.electronAPI.onStopAudioCapture(async () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        window.electronAPI.sendAudioData(new ArrayBuffer(0));
        return;
      }

      const recorder = mediaRecorderRef.current;

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(currentSessionChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          window.electronAPI.sendAudioData(arrayBuffer);
        } catch {
          window.electronAPI.sendAudioData(new ArrayBuffer(0));
        } finally {
          closeAudioContext(audioContextRef.current);
          audioContextRef.current = null;
          resetAudioState();
        }
      };

      try {
        recorder.stop();
      } catch {
        // recorder.stop() failed — clean up AudioContext to avoid resource leak
        closeAudioContext(audioContextRef.current);
        audioContextRef.current = null;
        resetAudioState();
        window.electronAPI.sendAudioData(new ArrayBuffer(0));
      }
    });

    const unsubscribeCancelRecording = window.electronAPI.onCancelRecording(() => {
      cleanupRecording();
      // Status is set to 'idle' by the main process via STATUS_CHANGED IPC
    });

    const unsubscribeRequestInterim = window.electronAPI.onRequestInterimAudio(async () => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== 'recording') return;

      const stream = globalStream;
      if (!stream) return;

      // Stop-and-restart approach: stopping the recorder produces a complete, self-contained
      // WebM file (with its own EBML header). This is far more reliable than requestData()
      // which produces headerless continuation clusters that some decoders (including Gemini)
      // may struggle to parse correctly when concatenated across multiple requestData() calls.
      const interimChunks: Blob[] = [];
      const stopPromise = new Promise<void>(resolve => {
        recorder.onstop = () => resolve();
        // Override ondataavailable to collect only this window's audio into interimChunks.
        // sessionChunks continues to accumulate via the new recorder below.
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) interimChunks.push(event.data);
        };
      });

      try {
        recorder.stop();
      } catch {
        // If stop() fails the recorder is likely already inactive; proceed
      }

      await Promise.race([
        stopPromise,
        new Promise<void>(resolve => setTimeout(resolve, 2000)),
      ]);

      // Restart the recorder immediately so audio capture continues uninterrupted.
      // The new recorder's chunks go into the existing sessionChunks array for final transcription.
      const sessionChunks = currentSessionChunksRef.current;
      try {
        const newRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        newRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) sessionChunks.push(event.data);
        };
        newRecorder.onerror = () => {
          globalStream = null;
          cleanupRecording();
          setError('録音中にエラーが発生しました');
        };
        mediaRecorderRef.current = newRecorder;
        newRecorder.start();
      } catch {
        // If restart fails, mediaRecorderRef stays null; the next interim request
        // will hit the state guard and be skipped gracefully
      }

      // Send the complete interim audio blob (valid standalone WebM with EBML header)
      if (interimChunks.length > 0) {
        try {
          const audioBlob = new Blob(interimChunks, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          window.electronAPI.sendInterimAudioData(arrayBuffer);
        } catch {
          // Best-effort: ignore errors for interim audio
        }
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeTranscription();
      unsubscribeError();
      unsubscribeStartCapture();
      unsubscribeStopCapture();
      unsubscribeCancelRecording();
      unsubscribeRequestInterim();
      cleanupRecording();
    };
  }, [setStatus, setLastTranscription, setError, cleanupRecording, initGlobalStream, resetAudioState]);

  const handleCancel = () => {
    window.electronAPI.cancelRecording().catch(() => {
      // IPC failure during cancel — renderer cleanup already handled by cleanupRecording
    });
  };

  const handleConfirm = async () => {
    if (isRecording) {
      try {
        await window.electronAPI.stopRecording();
      } catch {
        setError('録音の停止に失敗しました');
      }
    }
  };

  const handleToggle = async () => {
    try {
      await window.electronAPI.toggleRecording();
    } catch {
      setError('録音の切り替えに失敗しました');
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-transparent">
      <div className="flex items-center gap-[8px] rounded-[12px] px-[8px] transition-colors duration-300 h-[44px] bg-noir-panel/[0.91]">
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="w-8 h-8 rounded-[8px] bg-transparent hover:bg-white/[0.05] flex items-center justify-center transition-colors duration-150 border border-white/[0.07] hover:border-white/[0.15] active:scale-95 flex-shrink-0"
          title="Cancel"
        >
          <svg className="w-[12px] h-[12px] text-white/[0.28]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Waveform visualization */}
        <div
          className="flex items-center gap-[3px] flex-1 h-8 cursor-pointer justify-center"
          onClick={handleToggle}
        >
          {isProcessing || isTyping ? (
            <div className="flex items-center gap-[5px]">
              <div className="w-1 h-1 bg-white/[0.55] rounded-full animate-fade-dot" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 bg-white/[0.35] rounded-full animate-fade-dot" style={{ animationDelay: '220ms' }} />
              <div className="w-1 h-1 bg-white/[0.18] rounded-full animate-fade-dot" style={{ animationDelay: '440ms' }} />
              <div className="w-1 h-1 bg-white/[0.08] rounded-full" />
              <div className="w-1 h-1 bg-white/[0.04] rounded-full" />
            </div>
          ) : (
            audioLevels.map((level, i) => (
              <div
                key={i}
                ref={el => { barRefsArray.current[i] = el; }}
                className={`w-[2px] rounded-[1px] transition-[height] duration-75 ${
                  isRecording ? 'bg-gold' : 'bg-white/[0.18]'
                }`}
                style={{ height: `${computeBarHeight(level, BELL_CURVE[i])}px` }}
              />
            ))
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!isRecording}
          className={`w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors duration-150 border flex-shrink-0 ${
            isRecording
              ? 'bg-gold/[0.08] border-gold/[0.55] hover:bg-gold/[0.12] active:scale-95'
              : 'bg-transparent border-white/[0.05] cursor-not-allowed'
          }`}
          title="Confirm"
        >
          <svg className={`w-[12px] h-[12px] ${isRecording ? 'text-gold' : 'text-white/[0.12]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
