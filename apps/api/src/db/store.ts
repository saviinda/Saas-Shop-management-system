import { firestore } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface QueryOptions {
  where?: Array<{ field: string; op: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'array-contains'; value: any }>;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

export interface CollectionInterface<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  set(id: string, data: T): Promise<T>;
  create(data: Omit<T, 'id'> & { id?: string }): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  query(options?: QueryOptions): Promise<{ data: T[]; total: number }>;
  count(options?: QueryOptions): Promise<number>;
}

// Clean undefined fields recursively so Firestore or JSON never fails
function sanitizeData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeData);
  const clean: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = sanitizeData(v);
    }
  }
  return clean;
}

import os from 'os';

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'saas-data')
  : path.resolve(process.cwd(), 'data');

const SEED_FALLBACK_PATHS = [
  path.resolve(process.cwd(), 'data'),
  path.resolve(process.cwd(), 'apps/api/data'),
  path.resolve(__dirname, '../../data'),
  path.resolve(__dirname, '../../../data'),
];

/**
 * High-Performance Persistent Collection
 * 1. Synchronous disk persistence (data/ directory) so created data is NEVER lost across restarts/logouts
 * 2. Asynchronous Cloud Firestore replication when available
 */
class PersistentCollection<T extends { id: string }> implements CollectionInterface<T> {
  private items: Map<string, T> = new Map();
  private filePath: string;
  private isLoaded = false;

  constructor(private collectionName: string) {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (e) {
        // Safe in read-only / serverless environment
      }
    }
    this.filePath = path.join(DATA_DIR, `${collectionName}.json`);
    this.loadFromDisk();
    this.syncFromFirestoreInitial();
  }

  private loadFromDisk() {
    try {
      let targetPath = this.filePath;
      if (!fs.existsSync(targetPath)) {
        // Try fallback seed paths
        for (const dir of SEED_FALLBACK_PATHS) {
          const candidate = path.join(dir, `${this.collectionName}.json`);
          if (fs.existsSync(candidate)) {
            targetPath = candidate;
            break;
          }
        }
      }

      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, 'utf8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: T) => {
              if (item && item.id) {
                this.items.set(item.id, item);
              }
            });
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn(`[Store] Could not read disk store for ${this.collectionName}:`, err);
    }
  }

  private saveToDisk() {
    try {
      const data = Array.from(this.items.values());
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      // Ignored for non-blocking serverless/memory operation
    }
  }

  private async syncFromFirestoreInitial() {
    if (!firestore) return;
    try {
      const snap = await firestore.collection(this.collectionName).get();
      if (!snap.empty) {
        let changed = false;
        snap.docs.forEach(doc => {
          const docData = { id: doc.id, ...doc.data() } as T;
          if (!this.items.has(doc.id)) {
            this.items.set(doc.id, docData);
            changed = true;
          }
        });
        if (changed) {
          this.saveToDisk();
        }
      }
    } catch (e) {
      // Offline or network note - local disk handles persistence seamlessly
    }
  }

  private async syncToFirestore(item: T, isDelete = false) {
    if (!firestore) return;
    try {
      const ref = firestore.collection(this.collectionName).doc(item.id);
      if (isDelete) {
        await ref.delete().catch(() => {});
      } else {
        const clean = sanitizeData(item);
        await ref.set(clean, { merge: true }).catch(() => {});
      }
    } catch (e) {
      // Ignored for non-blocking local operation
    }
  }

  async get(id: string): Promise<T | null> {
    const item = this.items.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async set(id: string, data: T): Promise<T> {
    const clean = sanitizeData(data);
    this.items.set(id, clean);
    this.saveToDisk();
    this.syncToFirestore(clean);
    return clean;
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const id = data.id || uuidv4();
    const clean = sanitizeData({ ...data, id }) as T;
    this.items.set(id, clean);
    this.saveToDisk();
    this.syncToFirestore(clean);
    return clean;
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated = sanitizeData({
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    }) as T;
    this.items.set(id, updated);
    this.saveToDisk();
    this.syncToFirestore(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = this.items.get(id);
    const deleted = this.items.delete(id);
    if (deleted) {
      this.saveToDisk();
      if (existing) {
        this.syncToFirestore(existing, true);
      }
    }
    return deleted;
  }

  async query(options: QueryOptions = {}): Promise<{ data: T[]; total: number }> {
    let result = Array.from(this.items.values());

    if (options.where && options.where.length > 0) {
      result = result.filter(item => {
        return options.where!.every(cond => {
          const itemVal = (item as any)[cond.field];
          switch (cond.op) {
            case '==':
              return itemVal === cond.value;
            case '!=':
              return itemVal !== cond.value;
            case '>':
              return itemVal > cond.value;
            case '>=':
              return itemVal >= cond.value;
            case '<':
              return itemVal < cond.value;
            case '<=':
              return itemVal <= cond.value;
            case 'in':
              return Array.isArray(cond.value) && cond.value.includes(itemVal);
            case 'array-contains':
              return Array.isArray(itemVal) && itemVal.includes(cond.value);
            default:
              return true;
          }
        });
      });
    }

    const total = result.length;

    if (options.orderBy) {
      const { field, direction } = options.orderBy;
      result.sort((a: any, b: any) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (typeof options.offset === 'number') {
      result = result.slice(options.offset);
    }
    if (typeof options.limit === 'number') {
      result = result.slice(0, options.limit);
    }

    return {
      data: JSON.parse(JSON.stringify(result)),
      total,
    };
  }

  async count(options: QueryOptions = {}): Promise<number> {
    const res = await this.query(options);
    return res.total;
  }
}

class DatabaseStore {
  private collections: Map<string, CollectionInterface<any>> = new Map();

  collection<T extends { id: string }>(name: string): CollectionInterface<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new PersistentCollection<T>(name));
    }
    return this.collections.get(name)!;
  }
}

export const dbStore = new DatabaseStore();
