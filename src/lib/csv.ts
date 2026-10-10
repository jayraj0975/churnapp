import type { ContractType, CustomerProfile, InternetServiceType, PaymentMethodType } from '../types';
import { validateProfile } from './validate';

/** Minimal RFC4180-ish CSV splitter: handles quoted fields with embedded commas/quotes/newlines.
 * No library needed for this; a real multi-line-quoted-field edge case is rare in exported CRM data. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

const REQUIRED_HEADERS = ['name', 'tenure', 'monthlyCharges', 'contract', 'internetService', 'paymentMethod'] as const;

const toBool = (v: string | undefined, fallback = false): boolean => {
  if (v === undefined || v.trim() === '') return fallback;
  const s = v.trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
};

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MB

export interface ImportResult {
  profiles: CustomerProfile[];
  errors: string[];
}

/** Parses a CSV of customers into validated CustomerProfiles. Rejects rows individually with a
 * reason instead of failing the whole import, so one bad row doesn't block the rest of the batch. */
export function importCustomersCsv(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return { profiles: [], errors: [`File is larger than ${MAX_IMPORT_BYTES / 1024 / 1024}MB; split it into smaller batches.`] };
  }
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { profiles: [], errors: ['The file is empty.'] };

  const header = rows[0].map((h) => h.trim());
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      profiles: [],
      errors: [`Missing required column(s): ${missing.join(', ')}. Required columns: ${REQUIRED_HEADERS.join(', ')}.`],
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      profiles: [],
      errors: [`File has ${dataRows.length} data rows, more than the ${MAX_IMPORT_ROWS}-row limit; split it into smaller batches.`],
    };
  }

  const col = (r: string[], name: string) => {
    const idx = header.indexOf(name);
    return idx === -1 ? undefined : r[idx];
  };

  const profiles: CustomerProfile[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  dataRows.forEach((r, i) => {
    const rowNum = i + 2; // 1-indexed, +1 to account for the header row
    const name = (col(r, 'name') ?? '').trim();
    if (!name) { errors.push(`Row ${rowNum}: name is required`); return; }

    let id = (col(r, 'id') ?? '').trim();
    if (!id) id = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    while (seenIds.has(id)) id = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

    const totalChargesRaw = col(r, 'totalCharges')?.trim();

    const profile: CustomerProfile = {
      id,
      name,
      tenure: Number(col(r, 'tenure')),
      monthlyCharges: Number(col(r, 'monthlyCharges')),
      ...(totalChargesRaw ? { totalCharges: Number(totalChargesRaw) } : {}),
      contract: (col(r, 'contract') ?? '') as ContractType,
      internetService: (col(r, 'internetService') ?? '') as InternetServiceType,
      paymentMethod: (col(r, 'paymentMethod') ?? '') as PaymentMethodType,
      onlineSecurity: toBool(col(r, 'onlineSecurity')),
      onlineBackup: toBool(col(r, 'onlineBackup')),
      deviceProtection: toBool(col(r, 'deviceProtection')),
      techSupport: toBool(col(r, 'techSupport')),
      streamingTV: toBool(col(r, 'streamingTV')),
      streamingMovies: toBool(col(r, 'streamingMovies')),
      paperlessBilling: toBool(col(r, 'paperlessBilling')),
      seniorCitizen: toBool(col(r, 'seniorCitizen')),
      partner: toBool(col(r, 'partner')),
      dependents: toBool(col(r, 'dependents')),
      phoneService: toBool(col(r, 'phoneService'), true),
      multipleLines: toBool(col(r, 'multipleLines')),
    };

    const err = validateProfile(profile);
    if (err) { errors.push(`Row ${rowNum} (${name}): ${err}`); return; }

    seenIds.add(id);
    profiles.push(profile);
  });

  return { profiles, errors };
}

/** Neutralizes CSV/Excel formula injection: a cell whose content starts with =, +, -, @, tab
 * or CR is interpreted as a formula by Excel/Sheets even when quoted in the raw CSV text, so a
 * customer name or id imported from an untrusted CSV could execute code when a later export of
 * that data is opened in a spreadsheet. Prefixing with a plain single quote keeps the visible
 * text identical while forcing spreadsheet apps to treat it as literal text. */
/**
 * Text for a double-quoted CSV cell. A leading formula character is neutralised (spreadsheets run "=...", "+...",
 * "-...", "@..." as formulas), and every quote is doubled so a value cannot close its cell early and start a new
 * one: `x","=HYPERLINK(...)` would otherwise put a live formula in the next column.
 */
export function csvSafe(value: string): string {
  return (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""');
}

const TEMPLATE_HEADER =
  'id,name,tenure,monthlyCharges,contract,internetService,paymentMethod,totalCharges,onlineSecurity,onlineBackup,deviceProtection,techSupport,streamingTV,streamingMovies,paperlessBilling,seniorCitizen,partner,dependents,phoneService,multipleLines';
const TEMPLATE_EXAMPLE =
  'CUST-1001,Alice Johnson,8,89.95,Month-to-month,Fiber optic,Electronic check,,false,false,false,true,false,false,true,false,true,false,true,false';

export const CSV_IMPORT_TEMPLATE = `${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`;
