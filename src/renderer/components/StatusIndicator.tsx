import type { RecordingState } from '../../shared/types';

interface StatusIndicatorProps {
  status: RecordingState['status'];
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  const getStatusText = () => {
    switch (status) {
      case 'recording':
        return 'Recording...';
      case 'processing':
        return 'Processing...';
      case 'typing':
        return 'Typing...';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'recording':
        return 'text-red-400';
      case 'processing':
        return 'text-yellow-400';
      case 'typing':
        return 'text-green-400';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getDotColor = () => {
    switch (status) {
      case 'recording':
        return 'bg-red-400';
      case 'processing':
        return 'bg-yellow-400';
      case 'typing':
        return 'bg-green-400';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const shouldAnimate = status === 'recording' || status === 'processing';

  return (
    <div className="flex items-center gap-2 mt-4">
      <div
        className={`w-2 h-2 rounded-full ${getDotColor()} ${
          shouldAnimate ? 'animate-pulse' : ''
        }`}
      />
      <span className={`text-sm ${getStatusColor()}`}>{getStatusText()}</span>
    </div>
  );
}
