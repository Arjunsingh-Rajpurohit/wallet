import { Injectable, inject } from '@angular/core';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { Capacitor } from '@capacitor/core';
import { AiError, AiService } from './ai.service';
import { parseBill, type BillGuess, type OcrLine } from './bill-parser';
import { MediaService } from './media.service';
import { SettingsService } from './settings.service';

export interface BillReading extends BillGuess {
  /** Who read it: the phone's own text reader (offline) or Gemini (with a free key). */
  readBy: 'phone' | 'ai';
  note: string;
}

@Injectable({ providedIn: 'root' })
export class BillScanService {
  private readonly media = inject(MediaService);
  private readonly ai = inject(AiService);
  private readonly settings = inject(SettingsService);

  /**
   * With a Gemini key the AI reads the bill (best at messy bills). Without one, or when the
   * AI is out of reach, Google's on-phone text reader does it — free and fully offline.
   */
  async read(path: string): Promise<BillReading> {
    if (this.settings.aiReady()) {
      try {
        const out = await this.ai.readBill(await this.media.readBase64(path), 'image/jpeg');
        return {
          total: out.total || null,
          date: /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : null,
          merchant: out.merchant || null,
          category: out.category,
          payment: out.payment === 'other' ? null : out.payment,
          readBy: 'ai',
          note: out.note,
        };
      } catch (e) {
        if (!Capacitor.isNativePlatform()) throw e;
        // Offline or over the free limit: fall through to the phone's own reader.
        if (!(e instanceof AiError)) throw e;
      }
    }

    if (!Capacitor.isNativePlatform()) {
      throw new AiError('To read bills, add the free AI key in Settings. Or type the amount.');
    }
    const result = await TextRecognition.processImage({ path: await this.media.fileUri(path) });
    const lines: OcrLine[] = result.blocks.flatMap((block) => block.lines.map((line) => ({
      text: line.text,
      top: line.boundingBox?.top,
      bottom: line.boundingBox?.bottom,
      left: line.boundingBox?.left,
    })));
    const guess = parseBill(lines);
    return {
      ...guess,
      readBy: 'phone',
      note: guess.total === null ? "Couldn't find the total — please type it." : 'Check the amount before saving.',
    };
  }
}
