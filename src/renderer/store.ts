import { create } from 'zustand';
import type { RecordingState, AppSettings } from '../shared/types';

interface AppState {
  status: RecordingState['status'];
  lastTranscription: string;
  interimText: string;
  error: string | null;
  settings: AppSettings | null;

  setStatus: (status: RecordingState['status']) => void;
  setLastTranscription: (text: string) => void;
  setInterimText: (text: string) => void;
  setError: (error: string | null) => void;
  setSettings: (settings: AppSettings) => void;
}

export const useStore = create<AppState>((set) => ({
  status: 'idle',
  lastTranscription: '',
  interimText: '',
  error: null,
  settings: null,

  setStatus: (status) => set({ status, error: null }),
  setLastTranscription: (lastTranscription) => set({ lastTranscription }),
  setInterimText: (interimText) => set({ interimText }),
  setError: (error) => set({ error, status: 'error' }),
  setSettings: (settings) => set({ settings }),
}));
