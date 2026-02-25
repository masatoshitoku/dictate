import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import { createLogger, logCriticalError } from '../utils/logger';
import {
  getMimeType,
  createTranscriptionError,
  parseGeminiError,
  type TranscriptionError,
} from '../../shared/gemini-errors';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000; // 1 minute

const GEMINI_SYSTEM_PROMPT = `あなたは音声を文字起こしするアシスタントです。

## 最重要ルール
1. 音声に含まれる内容のみを文字起こしする
2. 音声に含まれていない内容は絶対に出力しない
3. 推測や補完は絶対にしない

## 無音・ノイズの判定（必須）
以下の場合は必ず [NO_SPEECH] とだけ出力してください：
- 音声が無音またはほぼ無音
- 背景ノイズのみで人の声がない
- 聞き取れる発話がない
- 意味のある単語が聞き取れない

## 処理ルール（明確な発話がある場合のみ適用）

### フィラーワードの削除
削除対象: 「えっと」「えー」「あー」「うーん」「あの」「その」「なんか」「まあ」

### 言い直しの処理
話者が言い直した場合、最終意図のみ保持

### 文法補正
- 助詞の誤りを修正
- 句読点を適切に挿入

## 出力ルール
- 発話がない場合: [NO_SPEECH] とだけ出力
- 発話がある場合: 聞き取った内容のみを出力（説明や前置きは不要）
- 辞書は参考情報であり、音声に含まれていない単語を出力してはいけない`;

const NO_SPEECH_MARKER = '[NO_SPEECH]';
const debugLog = createLogger('gemini');

// ============================================================================
// Types
// ============================================================================

interface GeminiServiceConfig {
  apiKey: string;
  model?: string;
}

import { sleep } from '../../shared/sleep';

// ============================================================================
// GeminiService Class
// ============================================================================

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private cachedModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(config: GeminiServiceConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model || DEFAULT_MODEL;
  }

  /**
   * Transcribe audio from a file path
   */
  async transcribeAudio(audioFilePath: string): Promise<string> {
    // Check if file exists
    try {
      await fs.access(audioFilePath);
    } catch {
      throw createTranscriptionError(
        `Audio file not found: ${audioFilePath}`,
        'FILE_NOT_FOUND',
        false
      );
    }

    // Read file
    let audioBuffer: Buffer;
    try {
      audioBuffer = await fs.readFile(audioFilePath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw createTranscriptionError(
        `Failed to read audio file: ${message}`,
        'FILE_READ_ERROR',
        false
      );
    }

    const mimeType = getMimeType(audioFilePath);
    return this.transcribeAudioBuffer(audioBuffer, mimeType);
  }

  /**
   * Transcribe audio from a buffer with retry logic
   */
  async transcribeAudioBuffer(
    audioBuffer: Buffer,
    mimeType: string = 'audio/wav',
    dictionaryPrompt: string = ''
  ): Promise<string> {
    // Circuit breaker: reject immediately if too many consecutive failures
    if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && Date.now() < this.circuitOpenUntil) {
      throw createTranscriptionError(
        'Gemini API temporarily unavailable. Please try again in a moment.',
        'CIRCUIT_OPEN',
        false
      );
    }

    let lastError: TranscriptionError | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.doTranscription(audioBuffer, mimeType, dictionaryPrompt);
        this.consecutiveFailures = 0; // Reset on success
        return result;
      } catch (error: unknown) {
        lastError = parseGeminiError(error);

        // Don't retry non-retryable errors
        if (!lastError.isRetryable) {
          this.consecutiveFailures++;
          if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
          }
          throw lastError;
        }

        // Log retry attempt (only in development)
        if (attempt < MAX_RETRIES) {
          debugLog(`Transcription attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
        }
      }
    }

    // All retries exhausted
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    }

    const finalError = lastError || createTranscriptionError('Transcription failed after all retries', 'MAX_RETRIES', false);
    logCriticalError('gemini', finalError);
    throw finalError;
  }

  /**
   * Internal transcription method
   */
  private async doTranscription(
    audioBuffer: Buffer,
    mimeType: string,
    dictionaryPrompt: string
  ): Promise<string> {
    // Cache model instance to avoid recreating it on every call
    if (!this.cachedModel) {
      this.cachedModel = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: GEMINI_SYSTEM_PROMPT,
      });
    }
    const model = this.cachedModel;

    const audioBase64 = audioBuffer.toString('base64');

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            // Include dictionary prompt inline if present; otherwise just audio
            ...(dictionaryPrompt ? [{ text: dictionaryPrompt }] : []),
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
    });

    const response = result.response;
    const text = response.text().trim();

    // Check for no speech marker
    if (text === NO_SPEECH_MARKER || text.includes(NO_SPEECH_MARKER)) {
      return '';
    }

    return text;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let geminiService: GeminiService | null = null;

export function initGeminiService(apiKey: string): GeminiService {
  geminiService = new GeminiService({ apiKey });
  return geminiService;
}

export function getGeminiService(): GeminiService {
  if (!geminiService) {
    throw new Error('GeminiService not initialized. Please configure your API key in Settings.');
  }
  return geminiService;
}

export function isGeminiServiceInitialized(): boolean {
  return geminiService !== null;
}
