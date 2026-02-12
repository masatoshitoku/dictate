import { create } from 'zustand';
import type { RecordingState, AppSettings } from '../shared/types';

interface AppState {
  status: RecordingState['status'];
  lastTranscription: string;
  error: string | null;
  settings: AppSettings | null;

  setStatus: (status: RecordingState['status']) => void;
  setLastTranscription: (text: string) => void;
  setError: (error: string | null) => void;
  setSettings: (settings: AppSettings) => void;
}

export const useStore = create<AppState>((set) => ({
  status: 'idle',
  lastTranscription: '',
  error: null,
  settings: null,

  setStatus: (status) => set({ status, error: null }),
  setLastTranscription: (lastTranscription) => set({ lastTranscription }),
  setError: (error) => set({ error, status: 'error' }),
  setSettings: (settings) => set({ settings }),
}));
