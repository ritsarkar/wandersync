import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const FILE_PATH = path.join(DATA_DIR, 'groups.json');

let saveTimeout = null;

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Storage] Could not create storage directory:', e.message);
}

/**
 * Load persisted groups from disk
 */
export function loadPersistedGroups() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      const map = new Map();
      for (const [id, grp] of Object.entries(data)) {
        const membersMap = new Map();
        if (Array.isArray(grp.members)) {
          grp.members.forEach((m) => {
            membersMap.set(m.id, { ...m, status: 'idle' });
          });
        }
        map.set(id, {
          ...grp,
          members: membersMap,
        });
      }
      console.log(`[Storage] Restored ${map.size} persisted trips/groups from disk.`);
      return map;
    }
  } catch (err) {
    console.warn('[Storage] Could not load persisted groups:', err.message);
  }
  return new Map();
}

/**
 * Debounced persistence to avoid disk thrashing during rapid GPS updates.
 * Hardened with atomic temp file rename and prototype pollution defenses.
 */
export function scheduleSaveGroups(groupsMap) {
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    try {
      const exportObj = Object.create(null);
      for (const [id, grp] of groupsMap.entries()) {
        if (!id || id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
        exportObj[id] = {
          id: grp.id,
          name: grp.name,
          createdAt: grp.createdAt,
          rendezvous: grp.rendezvous,
          routes: grp.routes,
          members: Array.from(grp.members.values()),
          messages: grp.messages.slice(-50), // keep recent 50
        };
      }

      const tempPath = `${FILE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(exportObj, null, 2), 'utf-8');
      fs.renameSync(tempPath, FILE_PATH);
    } catch (err) {
      console.warn('[Storage] Failed to persist groups to disk:', err.message);
    }
  }, 1000); // 1-second debounce
}
