import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';

export default function App() {
  const { status, setStatus, setLastTranscription, setError } = useStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(7).fill(0.2));
  const maxAudioLevelRef = useRef<number>(0); // Track max audio level during recording

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isTyping = status === 'typing';

  // Cleanup function
  const cleanupRecording = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    maxAudioLevelRef.current = 0;
    setAudioLevels(Array(7).fill(0.2));
  };

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
        // Clean up any previous recording first
        cleanupRecording();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        // Set up audio analyser for visualization
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Start animation loop
        const updateLevels = () => {
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

        audioChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(100);
        console.log('Recording started');
      } catch (error) {
        console.error('Failed to start audio capture:', error);
        setError('マイクへのアクセスに失敗しました');
      }
    });

    const unsubscribeStopCapture = window.electronAPI.onStopAudioCapture(async () => {
      console.log('Stop capture received, max audio level:', maxAudioLevelRef.current);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      console.log('Max audio level during recording:', maxAudioLevelRef.current);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const recorder = mediaRecorderRef.current;

        recorder.onstop = async () => {
          console.log('MediaRecorder stopped, chunks:', audioChunksRef.current.length);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('Audio blob size:', audioBlob.size);
          const arrayBuffer = await audioBlob.arrayBuffer();
          window.electronAPI.sendAudioData(arrayBuffer);

          // Cleanup
          recorder.stream.getTracks().forEach((track) => track.stop());
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
          mediaRecorderRef.current = null;
          analyserRef.current = null;
          audioChunksRef.current = [];
          maxAudioLevelRef.current = 0;
          setAudioLevels(Array(7).fill(0.2));
        };

        recorder.stop();
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
    };
  }, [setStatus, setLastTranscription, setError]);

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
      <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-full px-3 py-2 shadow-2xl border border-gray-700/50">
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="w-10 h-10 rounded-full bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center transition-colors"
          title="Cancel"
        >
          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Waveform visualization */}
        <div
          className="flex items-center gap-[3px] h-8 px-2 cursor-pointer"
          onClick={handleToggle}
        >
          {isProcessing || isTyping ? (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            audioLevels.map((level, i) => (
              <div
                key={i}
                className="w-[3px] bg-gray-300 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(8, level * 28)}px`,
                }}
              />
            ))
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!isRecording}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isRecording
              ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400'
              : 'bg-gray-700/50 text-gray-500'
          }`}
          title="Confirm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
