import ExcelJS from 'exceljs';

/**
 * Client-side parsing for the Import Pro uploader. Reads .csv (UTF-8, comma or
 * semicolon) and .xlsx files into a uniform { headers, rows } shape so the
 * column mapper and preview can work before anything is sent to the backend.
 *
 * The backend remains the source of truth for the actual import (it uses
 * `csv-parse`); this module only powers the visual mapping/preview and the
 * client-side guard rails the spec requires (size, row count, encoding,
 * delimiter, password-protected files).
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ROWS = 10_000;

export interface ParsedFile {
  headers: string[];
  /** Data rows (header excluded). Each row maps header -> cell string value. */
  rows: Record<string, string>[];
  /** Raw data rows aligned to `headers` order, header excluded. */
  rawRows: string[][];
  rowCount: number;
}

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportParseError';
  }
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Parses a single CSV line respecting double-quoted fields (RFC 4180 style:
 * quotes escaped by doubling).
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Detects the delimiter from the header line. Only comma and semicolon are
 * supported (per spec). If the line looks tab/pipe-separated (ambiguous) and has
 * no comma/semicolon, throws so the UI can guide the user.
 */
function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;

  if (commaCount === 0 && semicolonCount === 0) {
    // Ambiguous separator (e.g. tab) or a single column.
    if (headerLine.includes('\t') || headerLine.includes('|')) {
      throw new ImportParseError(
        'Não foi possível detectar o separador do CSV. Salve o arquivo usando vírgula (,) ou ponto-e-vírgula (;) como separador.'
      );
    }
    // Single column with no delimiter — treat comma as default.
    return ',';
  }
  return semicolonCount > commaCount ? ';' : ',';
}

function decodeUtf8OrThrow(buffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = decoder.decode(buffer);
    // Strip a UTF-8 BOM if present.
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    return text;
  } catch {
    throw new ImportParseError(
      'O arquivo CSV não está em UTF-8. Salve novamente o arquivo com codificação UTF-8 e tente de novo.'
    );
  }
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const text = decodeUtf8OrThrow(buffer);

  const lines = text.split(/\r\n|\n|\r/).filter((line, idx, arr) => {
    // Keep all lines except a trailing empty line.
    if (idx === arr.length - 1 && line.trim() === '') return false;
    return true;
  });

  if (lines.length === 0) {
    throw new ImportParseError('O arquivo está vazio.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());

  const rawRows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    rawRows.push(parseCsvLine(lines[i], delimiter));
  }

  const rows = rawRows.map((cells) => rowToObject(headers, cells));
  return { headers, rows, rawRows, rowCount: rawRows.length };
}

function rowToObject(headers: string[], cells: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((header, idx) => {
    obj[header] = (cells[idx] ?? '').toString();
  });
  return obj;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    // Rich text / hyperlink / formula result shapes from ExcelJS.
    if ('text' in obj && typeof obj.text === 'string') return obj.text;
    if ('result' in obj)
      return obj.result === null || obj.result === undefined ? '' : String(obj.result);
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((part) => part.text ?? '').join('');
    }
    return '';
  }
  return String(value);
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('password') || message.includes('encrypt')) {
      throw new ImportParseError(
        'O arquivo XLSX está protegido por senha. Remova a proteção e tente novamente.'
      );
    }
    throw new ImportParseError(
      'Não foi possível ler o arquivo XLSX. Verifique se o arquivo não está corrompido ou protegido por senha.'
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ImportParseError('A planilha não contém nenhuma aba com dados.');
  }

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    // ExcelJS row.values is 1-indexed (index 0 is empty).
    const cells: string[] = [];
    for (let i = 1; i < values.length; i++) {
      cells.push(cellToString(values[i]));
    }
    matrix.push(cells);
  });

  if (matrix.length === 0) {
    throw new ImportParseError('O arquivo está vazio.');
  }

  const headers = matrix[0].map((h) => (h ?? '').toString().trim());
  const rawRows = matrix.slice(1).filter((cells) => cells.some((c) => c.trim() !== ''));
  const rows = rawRows.map((cells) => rowToObject(headers, cells));
  return { headers, rows, rawRows, rowCount: rawRows.length };
}

/**
 * Parses a legacy `.xls` (BIFF8) file. ExcelJS only reads `.xlsx`, so SheetJS is
 * loaded on demand (dynamic import) — it is only pulled into the bundle when a
 * user actually uploads a `.xls`, keeping the initial bundle lean.
 */
async function parseXls(file: File): Promise<ParsedFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  let workbook: import('xlsx').WorkBook;
  try {
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  } catch {
    throw new ImportParseError(
      'Não foi possível ler o arquivo .xls. Verifique se não está corrompido ou protegido por senha.'
    );
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!worksheet) {
    throw new ImportParseError('A planilha não contém nenhuma aba com dados.');
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  if (matrix.length === 0) {
    throw new ImportParseError('O arquivo está vazio.');
  }

  const headers = (matrix[0] as unknown[]).map((h) => String(h ?? '').trim());
  const rawRows = matrix
    .slice(1)
    .map((cells) => headers.map((_, i) => String((cells as unknown[])[i] ?? '')))
    .filter((cells) => cells.some((c) => c.trim() !== ''));
  const rows = rawRows.map((cells) => rowToObject(headers, cells));
  return { headers, rows, rawRows, rowCount: rawRows.length };
}

/**
 * Validates and parses an uploaded file. Throws {@link ImportParseError} with a
 * user-facing (pt-BR) message for any guard-rail violation: size, format,
 * encoding, delimiter, password protection, or row count.
 */
export async function parseImportFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ImportParseError(
      `O arquivo excede o limite de 10 MB (tamanho: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`
    );
  }

  const ext = getExtension(file.name);
  let parsed: ParsedFile;
  if (ext === 'csv') {
    parsed = await parseCsv(file);
  } else if (ext === 'xlsx') {
    parsed = await parseXlsx(file);
  } else if (ext === 'xls') {
    parsed = await parseXls(file);
  } else {
    throw new ImportParseError(
      'Formato não suportado. Envie um arquivo .csv (UTF-8), .xlsx ou .xls.'
    );
  }

  if (parsed.rowCount > MAX_ROWS) {
    throw new ImportParseError(
      `A importação excede o limite de 10.000 linhas (linhas: ${parsed.rowCount.toLocaleString('pt-BR')}).`
    );
  }

  if (parsed.headers.length === 0 || parsed.headers.every((h) => h === '')) {
    throw new ImportParseError(
      'Não foi possível identificar as colunas do arquivo. Verifique o cabeçalho.'
    );
  }

  return parsed;
}
