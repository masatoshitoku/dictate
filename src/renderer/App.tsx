import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './store';

// ============================================================================
// Waveform visualization constants
// ============================================================================

const BAR_COUNT = 7;
/** Bell curve weights for center-emphasized waveform bars */
const BELL_CURVE = [0.35, 0.62, 0.85, 1.0, 0.85, 0.62, 0.35] as const;
const WAVEFORM_MAX_HEIGHT_PX = 28;
const WAVEFORM_MIN_HEIGHT_SCALE = 10;
const DEFAULT_AUDIO_LEVEL = 0.2;
const AUDIO_LEVEL_FLOOR = 0.15;

// ============================================================================
// Singleton stream manager - survives component remounts
// ============================================================================

let globalStream: MediaStream | null = null;
let streamInitPromise: Promise<MediaStream | null> | null = null;
let permissionRequested = false;

export default function App() {
  const { status, setStatus, setLastTranscription, setError } = useStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentSessionChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(BAR_COUNT).fill(DEFAULT_AUDIO_LEVEL));
  const maxAudioLevelRef = useRef<number>(0);

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isTyping = status === 'typing';

  // Cleanup function - does NOT stop the global stream
  const cleanupRecording = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    // Stop MediaRecorder if still recording before nulling
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore errors when stopping
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    currentSessionChunksRef.current = [];
    maxAudioLevelRef.current = 0;
    setAudioLevels(Array(BAR_COUNT).fill(DEFAULT_AUDIO_LEVEL));
  }, []);

  // Initialize stream ONCE globally - only if main process has granted permission
  const initGlobalStream = useCallback(async (): Promise<MediaStream | null> => {
    // Already have a valid stream - also check track state
    if (globalStream && globalStream.active) {
      const tracks = globalStream.getAudioTracks();
      const allTracksLive = tracks.length > 0 && tracks.every(track => track.readyState === 'live');
      if (allTracksLive) {
        return globalStream;
      }
      globalStream = null;
      permissionRequested = false;
    }

    // Stream became inactive - reset and retry
    if (globalStream && !globalStream.active) {
      globalStream = null;
      permissionRequested = false;
    }

    // Already requesting - wait for it
    if (streamInitPromise) {
      return streamInitPromise;
    }

    // Check if main process has granted permission (only true when macOS TCC status is 'granted')
    const hasPermission = await window.electronAPI.checkMicrophonePermission();
    if (!hasPermission) {
      setError('マイクの権限ダイアログが表示されています。「許可」をクリックしてから再度お試しください。');
      return null;
    }

    // Permission already granted by main process - safe to call getUserMedia
    permissionRequested = true;
    streamInitPromise = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        globalStream = stream;

        // Monitor track ended events
        stream.getAudioTracks().forEach(track => {
          track.onended = () => {
            globalStream = null;
            permissionRequested = false;
          };
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

        // Set up audio analyser for visualization
        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Allocate Uint8Array once for reuse across animation frames
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Start animation loop
        const updateLevels = () => {
          const currentAnalyser = analyserRef.current;
          const dataArray = dataArrayRef.current;
          if (currentAnalyser && dataArray) {
            currentAnalyser.getByteFrequencyData(dataArray);

            const avgLevel = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
            if (avgLevel > maxAudioLevelRef.current) {
              maxAudioLevelRef.current = avgLevel;
            }

            const levels = Array(BAR_COUNT).fill(0).map((_, i) => {
              const idx = Math.floor((i / BAR_COUNT) * dataArray.length);
              return Math.max(AUDIO_LEVEL_FLOOR, dataArray[idx] / 255);
            });
            setAudioLevels(levels);
          }
          animationRef.current = requestAnimationFrame(updateLevels);
        };
        updateLevels();

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });

        mediaRecorder.onerror = () => {
          globalStream = null;
          permissionRequested = false;
          cleanupRecording();
          setError('録音中にエラーが発生しました');
        };

        // Per-session local array captured in closure.
        // Each recording session gets its own array, so stale ondataavailable
        // events from cancelled sessions write to their own old array and
        // never contaminate the current session's data.
        const sessionChunks: Blob[] = [];
        currentSessionChunksRef.current = sessionChunks;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            sessionChunks.push(event.data);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      } catch (error) {
        console.error('Failed to start audio capture:', error);
        setError('マイクへのアクセスに失敗しました');
      }
    });

    const unsubscribeStopCapture = window.electronAPI.onStopAudioCapture(async () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // If no active recorder, send empty data to prevent timeout
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        window.electronAPI.sendAudioData(new ArrayBuffer(0));
        return;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const recorder = mediaRecorderRef.current;

        recorder.onstop = async () => {
          try {
            const audioBlob = new Blob(currentSessionChunksRef.current, { type: 'audio/webm' });
            const arrayBuffer = await audioBlob.arrayBuffer();
            window.electronAPI.sendAudioData(arrayBuffer);
          } catch {
            window.electronAPI.sendAudioData(new ArrayBuffer(0));
          } finally {
            if (audioContextRef.current) {
              try {
                audioContextRef.current.close();
              } catch {
                // Ignore close errors
              }
              audioContextRef.current = null;
            }
            mediaRecorderRef.current = null;
            analyserRef.current = null;
            dataArrayRef.current = null;
            currentSessionChunksRef.current = [];
            maxAudioLevelRef.current = 0;
            setAudioLevels(Array(BAR_COUNT).fill(DEFAULT_AUDIO_LEVEL));
          }
        };

        try {
          recorder.stop();
        } catch {
          window.electronAPI.sendAudioData(new ArrayBuffer(0));
        }
      }
    });

    const unsubscribeCancelRecording = window.electronAPI.onCancelRecording(() => {
      cleanupRecording();
      setStatus('idle');
    });

    return () => {
      unsubscribeStatus();
      unsubscribeTranscription();
      unsubscribeError();
      unsubscribeStartCapture();
      unsubscribeStopCapture();
      unsubscribeCancelRecording();
      cleanupRecording();
      // NOTE: Do NOT stop globalStream here - it survives component remounts
    };
  }, [setStatus, setLastTranscription, setError, cleanupRecording, initGlobalStream]);

  const handleCancel = () => {
    window.electronAPI.cancelRecording();
  };

  const handleConfirm = async () => {
    if (isRecording) {
      await window.electronAPI.stopRecording();
    }
  };

  const handleToggle = async () => {
    await window.electronAPI.toggleRecording();
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
            audioLevels.map((level, i) => {
              const bell = BELL_CURVE[i];
              const minH = bell * WAVEFORM_MIN_HEIGHT_SCALE;
              return (
                <div
                  key={i}
                  className={`w-[2px] rounded-[1px] transition-[height] duration-75 ${
                    isRecording
                      ? 'bg-gold'
                      : 'bg-white/[0.18]'
                  }`}
                  style={{
                    height: `${Math.max(minH, level * WAVEFORM_MAX_HEIGHT_PX * bell)}px`,
                  }}
                />
              );
            })
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
