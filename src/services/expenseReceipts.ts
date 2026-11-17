// Receipt photos on expenses and stock imports (migrations 20261117090000_expense_receipts
// and 20261117120000_import_receipts).
//
// Files live in the PRIVATE bucket `expense-receipts` at {business_id}/{record_id}/{file}.jpg,
// where the record is an expense or an inventory batch, and the record's receipt_paths lists
// them. The record is always saved first with its named columns (old builds do the same and
// never touch receipt_paths); receipts are uploaded afterwards and recorded with a separate
// update, so a failed upload never loses the record.

import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';

export const RECEIPTS_BUCKET = 'expense-receipts';
/** Also enforced by the *_receipt_paths_valid CHECKs. */
export const MAX_RECEIPTS_PER_EXPENSE = 5;

// A receipt stays readable at 1600 px on its long edge; JPEG 0.6 lands around 150-300 KB.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.6;
const SIGNED_URL_SECONDS = 60 * 60;

/** A photo taken or picked in this session, shrunk and not uploaded yet. */
export interface LocalReceipt {
  uri: string;
  base64: string;
}

async function shrink(uri: string, width?: number, height?: number): Promise<LocalReceipt> {
  const w = width || 0;
  const h = height || 0;
  const actions =
    Math.max(w, h) > MAX_EDGE
      ? [w >= h ? { resize: { width: MAX_EDGE } } : { resize: { height: MAX_EDGE } }]
      : [];
  const out = await manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!out.base64) throw new Error('Could not read the photo');
  return { uri: out.uri, base64: out.base64 };
}

/**
 * Take or pick one photo and shrink it. Null when cancelled or refused.
 * Only the camera asks for permission: the system photo picker returns just the chosen
 * photo, so the app never needs access to the whole library.
 */
export async function pickReceipt(source: 'camera' | 'library'): Promise<LocalReceipt | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access in Settings to photograph receipts.');
      return null;
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false, // receipts are long; a square crop would cut them
    quality: 1, // compression happens once, in shrink()
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return shrink(asset.uri, asset.width, asset.height);
}

function newObjectPath(businessId: string, recordId: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${businessId}/${recordId}/${Date.now()}-${rand}.jpg`;
}

/**
 * Upload local receipts for a saved expense. Returns the paths that uploaded and how many failed;
 * one failure does not stop the others.
 */
export async function uploadReceipts(
  businessId: string,
  recordId: string,
  receipts: LocalReceipt[]
): Promise<{ paths: string[]; failed: number }> {
  const paths: string[] = [];
  let failed = 0;
  for (const receipt of receipts) {
    const path = newObjectPath(businessId, recordId);
    const { error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, decode(receipt.base64), { contentType: 'image/jpeg', upsert: false });
    if (error) {
      console.error('Receipt upload failed:', error.message);
      failed += 1;
    } else {
      paths.push(path);
    }
  }
  return { paths, failed };
}

/** Tables whose rows carry receipt_paths. */
export type ReceiptTable = 'expenses' | 'inventory_batches';

/** Record a row's receipts. Only this column is written. */
export async function saveReceiptPaths(table: ReceiptTable, recordId: string, paths: string[]): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ receipt_paths: paths.length ? paths : null })
    .eq('id', recordId);
  if (error) throw error;
}

/** What a receipt picker holds: stored paths the user keeps, and new photos not uploaded yet. */
export interface ReceiptDraft {
  kept: string[];
  added: LocalReceipt[];
}

/**
 * Bring a saved row's receipts in line with the draft: upload new photos, write the final list,
 * then delete the files the user removed. Returns how many new photos did not make it.
 */
export async function syncReceipts(opts: {
  table: ReceiptTable;
  businessId: string;
  recordId: string;
  original: string[];
  draft: ReceiptDraft;
}): Promise<{ paths: string[]; notUploaded: number }> {
  const { table, businessId, recordId, original, draft } = opts;
  const removed = original.filter((p) => !draft.kept.includes(p));
  if (!draft.added.length && !removed.length) return { paths: original, notUploaded: 0 };

  const { paths: uploaded, failed } = draft.added.length
    ? await uploadReceipts(businessId, recordId, draft.added)
    : { paths: [], failed: 0 };
  const finalPaths = [...draft.kept, ...uploaded];
  try {
    await saveReceiptPaths(table, recordId, finalPaths);
  } catch (error) {
    console.error('Saving receipt list failed:', error);
    await removeReceiptFiles(uploaded);
    return { paths: original, notUploaded: draft.added.length };
  }
  await removeReceiptFiles(removed);
  return { paths: finalPaths, notUploaded: failed };
}

/** Best effort: a file left behind is only storage, and the cleanup job removes it. */
export async function removeReceiptFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove(paths);
  if (error) console.warn('Receipt delete failed:', error.message);
  paths.forEach((p) => urlCache.delete(p));
}

// Signed URLs are cached until shortly before they expire, so reopening an expense
// does not ask the server again.
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getReceiptUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of paths) {
    const hit = urlCache.get(p);
    if (hit && hit.expiresAt > now) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length) {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_SECONDS);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) {
        out[item.path] = item.signedUrl;
        urlCache.set(item.path, { url: item.signedUrl, expiresAt: now + (SIGNED_URL_SECONDS - 300) * 1000 });
      }
    }
  }
  return out;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, 'data:image/jpeg;'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function downloadAsDataUri(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).download(path);
  if (error || !data) {
    console.warn('Receipt download failed:', path, error?.message);
    return null;
  }
  return blobToDataUri(data);
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface ReceiptsPdfOptions {
  businessName: string;
  periodLabel: string;
  expenses: any[];
  formatPrice: (amount: number) => string;
  formatDate: (iso: string) => string;
}

/**
 * One PDF for a period: a summary table of every expense, then each receipt on its own page.
 * Images are embedded (downloaded once), because the print view cannot be relied on to wait
 * for remote images.
 */
export async function buildReceiptsPdfHtml(opts: ReceiptsPdfOptions): Promise<{ html: string; receiptCount: number; missing: number }> {
  const sorted = [...opts.expenses].sort(
    (a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
  );
  const total = sorted.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const rows = sorted
    .map((e) => {
      const n = e.receipt_paths?.length ?? 0;
      return `<tr>
        <td class="nowrap">${esc(opts.formatDate(e.expense_date))}</td>
        <td>${esc(e.description)}</td>
        <td>${esc(e.expense_categories?.name ?? '')}</td>
        <td class="r nowrap">${esc(opts.formatPrice(Number(e.amount)))}</td>
        <td class="r">${n ? n : '<span class="none">–</span>'}</td>
      </tr>`;
    })
    .join('');

  let receiptCount = 0;
  let missing = 0;
  const pages: string[] = [];
  for (const e of sorted) {
    const paths: string[] = e.receipt_paths ?? [];
    for (let i = 0; i < paths.length; i++) {
      const dataUri = await downloadAsDataUri(paths[i]);
      if (!dataUri) {
        missing += 1;
        continue;
      }
      receiptCount += 1;
      const part = paths.length > 1 ? ` (${i + 1} of ${paths.length})` : '';
      pages.push(`<section class="receipt">
        <div class="cap"><b>${esc(e.description)}</b>${esc(part)} · ${esc(opts.formatDate(e.expense_date))} · ${esc(opts.formatPrice(Number(e.amount)))}</div>
        <img src="${dataUri}" />
      </section>`);
    }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  @page { margin: 14mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { color: #6b7280; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; color: #6b7280; }
  .r { text-align: right; }
  .nowrap { white-space: nowrap; }
  .none { color: #6b7280; }
  tfoot td { font-weight: 700; border-bottom: none; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .receipt { page-break-before: always; break-before: page; page-break-inside: avoid; break-inside: avoid; text-align: center; }
  .cap { text-align: left; margin-bottom: 8px; color: #374151; }
  /* A4 minus margins and the caption, so a tall receipt never spills onto an empty page */
  .receipt img { display: block; margin: 0 auto; max-width: 100%; max-height: 225mm; object-fit: contain; }
</style></head><body>
<h1>${esc(opts.businessName || 'Expenses')}</h1>
<div class="meta">Expense receipts · ${esc(opts.periodLabel)} · Expenses: ${sorted.length} · Receipt photos: ${receiptCount}</div>
<table>
  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="r">Amount</th><th class="r">Receipts</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td></td><td>Total</td><td></td><td class="r nowrap">${esc(opts.formatPrice(total))}</td><td></td></tr></tfoot>
</table>
${pages.join('')}
</body></html>`;

  return { html, receiptCount, missing };
}

/** Print to PDF under a readable file name (the print step names it with a random id) and share it. */
export async function shareReceiptsPdf(html: string, fileName: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const safe = fileName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'Receipts';
  let shareUri = uri;
  try {
    const target = `${FileSystem.cacheDirectory}${safe}.pdf`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: target });
    shareUri = target;
  } catch (error) {
    console.warn('Could not rename the receipts PDF:', error);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: safe });
  }
}
