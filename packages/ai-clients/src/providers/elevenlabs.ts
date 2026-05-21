import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { VoiceProvider, VoiceRequest, VoiceResult } from '../index.js';

const MAX_CHARS = 1500;
const CHARS_PER_SECOND = 15;
const COST_PER_CHAR = 0.00003;

interface ElevenLabsOptions {
  apiKey?: string;
  cacheDir?: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export class ElevenLabsVoiceProvider implements VoiceProvider {
  private readonly apiKey: string;
  private readonly cacheDir: string;
  private cacheDirReady: Promise<void> | undefined;

  constructor(opts: ElevenLabsOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env['ELEVENLABS_API_KEY'] ?? '';
    this.cacheDir =
      opts.cacheDir ?? process.env['ELEVENLABS_CACHE_DIR'] ?? join(tmpdir(), 'gtarp-tts-cache');
    // Lazy-init: defer mkdir to first speak() so the constructor stays sync
    // and never performs blocking I/O.
  }

  private async ensureCacheDir(): Promise<void> {
    if (this.cacheDirReady === undefined) {
      this.cacheDirReady = mkdir(this.cacheDir, { recursive: true }).then(() => undefined);
    }
    await this.cacheDirReady;
  }

  async speak(req: VoiceRequest): Promise<VoiceResult> {
    if (req.text.length > MAX_CHARS) {
      throw new Error(
        `ElevenLabs: text exceeds ${MAX_CHARS} character hard cap (got ${req.text.length})`,
      );
    }

    await this.ensureCacheDir();

    const cacheKey = createHash('sha256').update(`${req.voiceId}:${req.text}`).digest('hex');
    const cachePath = join(this.cacheDir, `${cacheKey}.mp3`);

    if (await pathExists(cachePath)) {
      const audio = await readFile(cachePath);
      // Cache hit → no external API call → no incremental cost. Track avoided
      // spend separately if needed; costUsd here reflects actual outlay.
      return {
        audio,
        durationSeconds: req.text.length / CHARS_PER_SECOND,
        costUsd: 0,
        cacheHit: true,
      };
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: req.text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);

    await writeFile(cachePath, audio);

    return {
      audio,
      durationSeconds: req.text.length / CHARS_PER_SECOND,
      costUsd: req.text.length * COST_PER_CHAR,
      cacheHit: false,
    };
  }
}
