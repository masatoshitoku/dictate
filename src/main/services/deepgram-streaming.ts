import WebSocket from 'ws';
import * as fs from 'fs';
import * as os from 'os';
import { createLogger, logCriticalError } from '../utils/logger';

const debugLog = createLogger('deepgram');

// Direct file logging for production debugging
const DG_LOG = require('path').join(os.homedir(), 'dictate-interim-debug.log');
function dgLog(msg: string): void {
  try {
    fs.appendFileSync(DG_LOG, `[${new Date().toISOString()}] [deepgram] ${msg}\n`);
  } catch { /* ignore */ }
}

// ============================================================================
// Types
// ============================================================================

export interface DeepgramTranscript {
  text: string;
  isFinal: boolean;
}

interface DeepgramCallbacks {
  onTranscript: (transcript: DeepgramTranscript) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

// ============================================================================
// DeepgramStreaming
// ============================================================================

export class DeepgramStreaming {
  private ws: WebSocket | null = null;
  private callbacks: DeepgramCallbacks;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private pendingChunks: Buffer[] = [];  // Buffer chunks while WebSocket is connecting

  constructor(callbacks: DeepgramCallbacks) {
    this.callbacks = callbacks;
  }

  connect(apiKey: string, language: string = 'ja'): void {
    if (this.ws) {
      this.close();
    }
    this.pendingChunks = [];

    // Do NOT specify encoding/container/sample_rate when sending WebM container.
    // Deepgram auto-detects codec and sample rate from the WebM/EBML header.
    // Specifying them explicitly can cause silent failures.
    const params = new URLSearchParams({
      model: 'nova-3',
      language,
      interim_results: 'true',
      punctuate: 'true',
      smart_format: 'true',
    });

    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    debugLog(`Connecting to Deepgram: ${url}`);

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });

    this.ws.on('open', () => {
      dgLog('WebSocket OPEN — connected to Deepgram');
      debugLog('WebSocket connected to Deepgram');

      // Flush any audio chunks that arrived while the WebSocket was connecting.
      // The first chunk contains the WebM EBML header — losing it makes all
      // subsequent chunks undecodable, causing Deepgram to timeout and close.
      if (this.pendingChunks.length > 0) {
        dgLog(`Flushing ${this.pendingChunks.length} pending chunks (${this.pendingChunks.reduce((s, c) => s + c.length, 0)} bytes)`);
        for (const chunk of this.pendingChunks) {
          this.ws!.send(chunk);
        }
        this.pendingChunks = [];
      }

      this.keepAliveInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, 10_000);
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const raw = data.toString();
        const response = JSON.parse(raw);
        dgLog(`WS message: type=${response.type} is_final=${response.is_final} transcript="${response.channel?.alternatives?.[0]?.transcript ?? ''}"`);
        if (response.type === 'Results') {
          const transcript = response.channel?.alternatives?.[0]?.transcript || '';
          const isFinal = response.is_final === true;
          if (transcript) {
            this.callbacks.onTranscript({ text: transcript, isFinal });
          }
        } else if (response.type === 'Error') {
          dgLog(`API error: ${JSON.stringify(response)}`);
          logCriticalError('deepgram', `API error: ${JSON.stringify(response)}`);
          this.callbacks.onError(new Error(response.message || 'Deepgram API error'));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        dgLog(`Parse error: ${msg}`);
      }
    });

    this.ws.on('error', (error: Error) => {
      dgLog(`WebSocket ERROR: ${error.message}`);
      logCriticalError('deepgram', error);
      this.callbacks.onError(error);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      dgLog(`WebSocket CLOSED: code=${code} reason=${reason.toString()}`);
      this.stopKeepAlive();
      this.callbacks.onClose();
    });
  }

  sendAudio(chunk: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
      // Buffer chunks while WebSocket handshake is in progress.
      // These will be flushed (in order) once the 'open' event fires.
      this.pendingChunks.push(chunk);
    }
  }

  close(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send CloseStream message for graceful Deepgram shutdown
      try {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch { /* ignore */ }
    }
    this.cleanup();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private cleanup(): void {
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.terminate();
      }
      this.ws = null;
    }
  }
}
