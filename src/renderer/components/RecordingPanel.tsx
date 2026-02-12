import { useStore } from '../store';

export default function RecordingPanel() {
  const { status, lastTranscription, error } = useStore();

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isTyping = status === 'typing';
  const isIdle = status === 'idle';
  const isError = status === 'error';

  const handleClick = async () => {
    if (isProcessing || isTyping) return;
    await window.electronAPI.toggleRecording();
  };

  const getButtonClass = () => {
    const baseClass = 'w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none';

    if (isRecording) {
      return `${baseClass} bg-red-500 animate-pulse-ring shadow-lg shadow-red-500/50`;
    }
    if (isProcessing || isTyping) {
      return `${baseClass} bg-yellow-500 cursor-wait`;
    }
    if (isError) {
      return `${baseClass} bg-red-700`;
    }
    return `${baseClass} bg-primary-500 hover:bg-primary-400 hover:scale-105 active:scale-95`;
  };

  const getIcon = () => {
    if (isRecording) {
      return (
        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      );
    }
    if (isProcessing) {
      return (
        <svg className="w-12 h-12 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      );
    }
    if (isTyping) {
      return (
        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      );
    }
    return (
      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={handleClick}
        disabled={isProcessing || isTyping}
        className={getButtonClass()}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {getIcon()}
      </button>

      {lastTranscription && isIdle && (
        <div className="max-w-xs text-center">
          <p className="text-sm text-gray-400 mb-1">Last transcription:</p>
          <p className="text-sm text-white truncate">{lastTranscription}</p>
        </div>
      )}

      {error && (
        <div className="max-w-xs text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
