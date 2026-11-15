import { Directive, ElementRef, Injectable, effect, inject, input } from '@angular/core';
import { Camera, MediaType, MediaTypeSelection, type MediaResult } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { newId } from './format';

export interface SavedMedia {
  path: string;
  kind: 'photo' | 'video';
  /** A still frame saved next to a video. */
  thumb?: string;
}

export type MediaSource = 'camera' | 'gallery';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp', webm: 'video/webm',
};

export const mimeOf = (path: string) => MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

const PHOTO_OPTIONS = { quality: 75, targetWidth: 1600, targetHeight: 1600, correctOrientation: true, webUseInput: true };

/** A multiple of 3 bytes, so each chunk's base64 can simply be appended to the last. */
const CHUNK = 3 * 1024 * 1024;

/**
 * Photos and videos are copied into the app's own private folder, so they stay
 * even if you delete them from the gallery. Nothing is uploaded anywhere.
 */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private dataUri?: Promise<string>;
  private readonly webUrls = new Map<string, string>();

  async photo(source: MediaSource, folder: string): Promise<SavedMedia | null> {
    const result = await this.pick(() => source === 'camera'
      ? Camera.takePhoto(PHOTO_OPTIONS)
      : Camera.chooseFromGallery({ ...PHOTO_OPTIONS, mediaType: MediaTypeSelection.Photo }).then((r) => r.results[0]));
    if (!result) return null;
    const path = `${folder}/${newId()}.jpg`;
    await this.store(result, path);
    return { path, kind: 'photo' };
  }

  async video(source: MediaSource, folder: string): Promise<SavedMedia | null> {
    const result = await this.pick(() => source === 'camera' && Capacitor.isNativePlatform()
      ? Camera.recordVideo({ isPersistent: false, includeMetadata: true })
      : Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Video, includeMetadata: true, webUseInput: true }).then((r) => r.results[0]));
    if (!result) return null;
    const id = newId();
    const ext = (result.metadata?.format || result.uri?.split('.').pop() || 'mp4').toLowerCase().replace('quicktime', 'mov');
    const path = `${folder}/${id}.${MIME[ext] ? ext : 'mp4'}`;
    await this.store(result, path);
    let thumb: string | undefined;
    if (result.thumbnail) {
      thumb = `${folder}/${id}.thumb.jpg`;
      await Filesystem.writeFile({ path: thumb, data: result.thumbnail, directory: Directory.Data, recursive: true });
    }
    return { path, kind: 'video', thumb };
  }

  /** Base64 of a saved file — what the AI and the backup need. */
  async readBase64(path: string): Promise<string> {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    return typeof file.data === 'string' ? file.data : blobToBase64(file.data);
  }

  /** The file's full device path, for the text reader and the video player. */
  async fileUri(path: string): Promise<string> {
    return `${await this.baseUri()}/${path}`;
  }

  /** Something an <img> or <video> can load. */
  async src(path: string): Promise<string> {
    if (Capacitor.isNativePlatform()) return Capacitor.convertFileSrc(await this.fileUri(path));
    // In a desktop browser (testing only) the files live in IndexedDB.
    let url = this.webUrls.get(path);
    if (!url) {
      url = `data:${mimeOf(path)};base64,${await this.readBase64(path)}`;
      this.webUrls.set(path, url);
    }
    return url;
  }

  async playVideo(path: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    await Camera.playVideo({ uri: await this.fileUri(path) });
    return true;
  }

  async remove(...paths: (string | undefined)[]): Promise<void> {
    for (const path of paths) {
      if (!path) continue;
      this.webUrls.delete(path);
      await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => undefined);
    }
  }

  private baseUri(): Promise<string> {
    this.dataUri ??= Filesystem.getUri({ path: '', directory: Directory.Data }).then((r) => r.uri.replace(/\/$/, ''));
    return this.dataUri;
  }

  private async pick(open: () => Promise<MediaResult | undefined>): Promise<MediaResult | null> {
    try {
      return (await open()) ?? null;
    } catch (e) {
      // Backing out of the camera or gallery is not an error.
      if (/cancel|no image|no media|not selected|dismiss/i.test(String((e as Error)?.message ?? e))) return null;
      throw e;
    }
  }

  private async store(result: MediaResult, path: string): Promise<void> {
    const folder = path.slice(0, path.lastIndexOf('/'));
    await Filesystem.mkdir({ path: folder, directory: Directory.Data, recursive: true }).catch(() => undefined);
    if (Capacitor.isNativePlatform() && result.uri) {
      try {
        await Filesystem.copy({ from: result.uri, to: path, toDirectory: Directory.Data });
        return;
      } catch {
        // Some gallery apps hand out URIs that can't be copied directly; read them instead.
      }
    }
    if (result.type === MediaType.Photo && result.thumbnail && !Capacitor.isNativePlatform()) {
      // On the web the "thumbnail" of a photo is the full image.
      await Filesystem.writeFile({ path, data: result.thumbnail, directory: Directory.Data, recursive: true });
      return;
    }
    const source = result.webPath ?? (result.uri ? Capacitor.convertFileSrc(result.uri) : undefined);
    if (!source) throw new Error('The photo could not be read.');
    await this.writeBlob(path, await (await fetch(source)).blob());
  }

  private async writeBlob(path: string, blob: Blob): Promise<void> {
    for (let offset = 0; offset < blob.size || offset === 0; offset += CHUNK) {
      const data = await blobToBase64(blob.slice(offset, offset + CHUNK));
      if (offset === 0) await Filesystem.writeFile({ path, data, directory: Directory.Data, recursive: true });
      else await Filesystem.appendFile({ path, data, directory: Directory.Data });
      if (blob.size === 0) break;
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** `<img [fwSrc]="meal.photo">` — loads a saved photo or video from the app's folder. */
@Directive({ selector: '[fwSrc]' })
export class MediaSrcDirective {
  readonly fwSrc = input<string | null | undefined>();
  private readonly el = inject<ElementRef<HTMLImageElement | HTMLVideoElement>>(ElementRef);
  private readonly media = inject(MediaService);
  private ask = 0;

  constructor() {
    effect(() => {
      const path = this.fwSrc();
      const ticket = ++this.ask;
      if (!path) {
        this.el.nativeElement.removeAttribute('src');
        return;
      }
      this.media.src(path).then((url) => {
        // Only the latest request may set the source, if the path changed meanwhile.
        if (ticket === this.ask) this.el.nativeElement.src = url;
      }).catch(() => undefined);
    });
  }
}
