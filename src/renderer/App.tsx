import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './store';

// Singleton stream manager - survives component remounts
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
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(7).fill(0.2));
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
    setAudioLevels(Array(7).fill(0.2));
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
      // Tracks ended but stream still marked active - reset
      console.log('[Dictate] Audio tracks ended, resetting stream...');
      globalStream = null;
      permissionRequested = false;
    }

    // Stream became inactive - reset and retry
    if (globalStream && !globalStream.active) {
      console.log('[Dictate] Stream became inactive, resetting...');
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
      console.log('[Dictate] Microphone permission not yet granted');
      // Show appropriate message: if this is first time, dialog has been shown by main process.
      // User needs to click Allow in the macOS permission dialog.
      setError('マイクの権限ダイアログが表示されています。「許可」をクリックしてから再度お試しください。');
      // Do NOT set permissionRequested = true here - allow retry after user grants permission
      return null;
    }

    // Permission already granted by main process - safe to call getUserMedia
    permissionRequested = true;
    streamInitPromise = (async () => {
      try {
        console.log('[Dictate] Getting microphone stream (permission already granted)');
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
            console.log('[Dictate] Audio track ended unexpectedly');
            globalStream = null;
            permissionRequested = false;
          };
        });

        console.log('[Dictate] Microphone stream acquired');
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
      console.log('[Renderer] ====== onStartAudioCapture received ======');
      console.log('[Renderer] Current globalStream:', globalStream);
      console.log('[Renderer] globalStream active:', globalStream?.active);
      console.log('[Renderer] Current mediaRecorderRef:', mediaRecorderRef.current?.state);

      try {
        // Clean up any previous recording first
        console.log('[Renderer] Calling cleanupRecording...');
        cleanupRecording();

        // Get or reuse global media stream (never requests permission more than once)
        console.log('[Renderer] Getting global stream...');
        const stream = await initGlobalStream();
        console.log('[Renderer] Got stream:', !!stream, 'active:', stream?.active);
        if (!stream) {
          console.log('[Renderer] No stream returned, aborting');
          return; // Error already set by initGlobalStream
        }

        // Set up audio analyser for visualization
        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        audioContextRef.current = audioContext;

        // Monitor AudioContext state changes
        audioContext.onstatechange = () => {
          console.log('[Dictate] AudioContext state changed:', audioContext.state);
          if (audioContext.state === 'suspended' || audioContext.state === 'closed') {
            console.error('[Dictate] AudioContext suspended/closed during recording');
          }
        };

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Start animation loop with state monitoring
        let monitorCounter = 0;
        const updateLevels = () => {
          // Periodic state check (every ~60 frames = ~1 second)
          monitorCounter++;
          if (monitorCounter % 60 === 0) {
            // Check stream state
            if (globalStream && !globalStream.active) {
              console.error('[Dictate] DETECTED: Stream became inactive during recording!');
            }
            const tracks = globalStream?.getAudioTracks() || [];
            tracks.forEach((track, i) => {
              if (track.readyState === 'ended') {
                console.error(`[Dictate] DETECTED: Track ${i} ended during recording!`);
              }
            });
            // Check MediaRecorder state
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
              console.error('[Dictate] DETECTED: MediaRecorder became inactive during recording!');
            }
            // Check AudioContext state
            if (audioContextRef.current && audioContextRef.current.state !== 'running') {
              console.error('[Dictate] DETECTED: AudioContext not running:', audioContextRef.current.state);
            }
          }

          if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Calculate average level
            const avgLevel = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
            // Track max level during recording
            if (avgLevel > maxAudioLevelRef.current) {
              maxAudioLevelRef.current = avgLevel;
            }

            const levels = Array(7).fill(0).map((_, i) => {
              const idx = Math.floor((i / 7) * dataArray.length);
              return Math.max(0.15, dataArray[idx] / 255);
            });
            setAudioLevels(levels);
          }
          animationRef.current = requestAnimationFrame(updateLevels);
        };
        updateLevels();

        console.log('[Renderer] Creating MediaRecorder...');

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        console.log('[Renderer] MediaRecorder created, state:', mediaRecorder.state);

        mediaRecorder.onerror = (event) => {
          console.error('[Dictate] MediaRecorder error:', event);
          // Reset stream on error
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
        console.log('[Renderer] Starting MediaRecorder (no timeslice)...');
        mediaRecorder.start();
        console.log('[Renderer] MediaRecorder started, state:', mediaRecorder.state);
        console.log('[Renderer] ====== Recording started successfully ======');
      } catch (error) {
        console.error('Failed to start audio capture:', error);
        setError('マイクへのアクセスに失敗しました');
      }
    });

    const unsubscribeStopCapture = window.electronAPI.onStopAudioCapture(async () => {
      console.log('[Renderer] ====== onStopAudioCapture received ======');
      console.log('[Renderer] max audio level:', maxAudioLevelRef.current);
      console.log('[Renderer] globalStream:', globalStream);
      console.log('[Renderer] globalStream active:', globalStream?.active);
      console.log('[Renderer] mediaRecorderRef:', mediaRecorderRef.current);
      console.log('[Renderer] mediaRecorderRef state:', mediaRecorderRef.current?.state);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      console.log('[Renderer] Max audio level during recording:', maxAudioLevelRef.current);

      // If no active recorder, send empty data to prevent timeout
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        console.log('[Renderer] No active recorder, sending empty audio data');
        console.log('[Renderer] mediaRecorderRef.current:', mediaRecorderRef.current);
        console.log('[Renderer] state:', mediaRecorderRef.current?.state);
        window.electronAPI.sendAudioData(new ArrayBuffer(0));
        return;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const recorder = mediaRecorderRef.current;
        console.log('[Renderer] Recorder state before stop:', recorder.state);

        recorder.onstop = async () => {
          console.log('[Renderer] ====== recorder.onstop fired ======');
          try {
            console.log('[Renderer] MediaRecorder stopped, chunks:', currentSessionChunksRef.current.length);
            const audioBlob = new Blob(currentSessionChunksRef.current, { type: 'audio/webm' });
            console.log('[Renderer] Audio blob size:', audioBlob.size);
            const arrayBuffer = await audioBlob.arrayBuffer();
            console.log('[Renderer] Sending audio data to main process, size:', arrayBuffer.byteLength);
            window.electronAPI.sendAudioData(arrayBuffer);
            console.log('[Renderer] Audio data sent!');
          } catch (error) {
            console.error('[Renderer] Error in onstop handler:', error);
            window.electronAPI.sendAudioData(new ArrayBuffer(0));
          } finally {
            // Cleanup - but keep the stream alive for reuse
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
            currentSessionChunksRef.current = [];
            maxAudioLevelRef.current = 0;
            setAudioLevels(Array(7).fill(0.2));
            console.log('[Renderer] Cleanup complete');
          }
        };

        try {
          console.log('[Renderer] Calling recorder.stop()...');
          recorder.stop();
          console.log('[Renderer] recorder.stop() called, state now:', recorder.state);
        } catch (error) {
          console.error('[Renderer] Error stopping recorder:', error);
          window.electronAPI.sendAudioData(new ArrayBuffer(0));
        }
      }
    });

    const unsubscribeCancelRecording = window.electronAPI.onCancelRecording(() => {
      console.log('Cancel recording');
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
      // The stream is only stopped when the app process exits
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
      <div className={`flex items-center gap-3 backdrop-blur-xl rounded-2xl px-4 py-3 border transition-all duration-300 ${
        isRecording
          ? 'bg-rose-500/10 border-rose-400/30 shadow-[0_8px_32px_rgba(244,63,94,0.3)]'
          : isProcessing || isTyping
            ? 'bg-violet-500/10 border-violet-400/30 shadow-[0_8px_32px_rgba(139,92,246,0.3)]'
            : 'bg-white/10 border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
      }`}>
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 border border-white/10 hover:border-white/30 hover:scale-105 active:scale-95"
          title="Cancel"
        >
          <svg className="w-5 h-5 text-white/70 hover:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Waveform visualization */}
        <div
          className="flex items-center gap-[4px] h-10 px-3 cursor-pointer rounded-xl bg-white/5 border border-white/10"
          onClick={handleToggle}
        >
          {isProcessing || isTyping ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-violet-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-violet-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-violet-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            audioLevels.map((level, i) => (
              <div
                key={i}
                className={`w-[4px] rounded-full transition-all duration-100 ${
                  isRecording
                    ? 'bg-gradient-to-t from-rose-500 to-orange-400'
                    : 'bg-gradient-to-t from-violet-400/60 to-cyan-400/60'
                }`}
                style={{
                  height: `${Math.max(10, level * 32)}px`,
                }}
              />
            ))
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!isRecording}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border ${
            isRecording
              ? 'bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/40 hover:to-cyan-500/40 border-emerald-400/30 hover:border-emerald-400/50 text-emerald-300 hover:scale-105 active:scale-95'
              : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
          }`}
          title="Confirm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
