import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'lumina.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      score REAL,
      semantic_score REAL,
      token_score REAL,
      metadata_score REAL,
      raw_findings TEXT,
      recommendations TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export interface ScanRecord {
  id: string;
  url: string;
  status: 'pending' | 'scanning' | 'complete' | 'error';
  score: number | null;
  semantic_score: number | null;
  token_score: number | null;
  metadata_score: number | null;
  raw_findings: string | null;
  recommendations: string | null;
  created_at: string;
}

export interface RawFindings {
  httpStatus: number;
  loadTime: number;
  extractedTags: string[];
  rawTextSample: string;
  headers: Record<string, string>;
  jsonLdSchemas: object[];
  openGraphTags: Record<string, string>;
  semanticHeaders: { level: number; text: string }[];
  textToHtmlRatio: number;
  wordCount: number;
  imageCount: number;
  imagesWithAlt: number;
  internalLinks: number;
  externalLinks: number;
  hasMetaDescription: boolean;
  metaDescription: string;
  titleTag: string;
  canonicalUrl: string;
}

export function createScan(id: string, url: string): void {
  const db = getDatabase();
  db.prepare('INSERT INTO scans (id, url, status) VALUES (?, ?, ?)').run(id, url, 'pending');
}

export function updateScanStatus(id: string, status: string): void {
  const db = getDatabase();
  db.prepare('UPDATE scans SET status = ? WHERE id = ?').run(status, id);
}

export function completeScan(
  id: string,
  score: number,
  semanticScore: number,
  tokenScore: number,
  metadataScore: number,
  rawFindings: RawFindings,
  recommendations: Recommendation[]
): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE scans SET
      status = 'complete',
      score = ?,
      semantic_score = ?,
      token_score = ?,
      metadata_score = ?,
      raw_findings = ?,
      recommendations = ?
    WHERE id = ?
  `).run(
    score,
    semanticScore,
    tokenScore,
    metadataScore,
    JSON.stringify(rawFindings),
    JSON.stringify(recommendations),
    id
  );
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  impact: string;
  fix: string;
}

export function getScan(id: string): ScanRecord | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as ScanRecord | null;
}
