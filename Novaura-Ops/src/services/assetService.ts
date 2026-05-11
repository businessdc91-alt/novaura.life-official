import {
  collection, doc, addDoc, deleteDoc, updateDoc,
  onSnapshot, query, orderBy, where, Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from './firebase';

export interface AssetCategory {
  id: string;
  label: string;
  color: string;
  keywords: string[];
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: 'trees',
    label: 'Trees',
    color: '#22c55e',
    keywords: ['tree', 'oak', 'pine', 'birch', 'maple', 'palm', 'cedar', 'willow', 'bark',
      'trunk', 'log', 'stump', 'spruce', 'fir', 'elm', 'ash', 'beech', 'yew', 'redwood',
      'sequoia', 'baobab', 'mangrove', 'acacia', 'eucalyptus'],
  },
  {
    id: 'shrubs',
    label: 'Shrubs & Plants',
    color: '#86efac',
    keywords: ['shrub', 'bush', 'hedge', 'bramble', 'fern', 'grass', 'weed', 'flower', 'plant',
      'foliage', 'leaf', 'leaves', 'bloom', 'petal', 'vine', 'moss', 'ivy', 'cactus', 'reed',
      'wheat', 'crop', 'clover', 'dandelion', 'mushroom', 'fungi', 'algae', 'seaweed'],
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    color: '#f59e0b',
    keywords: ['rock', 'stone', 'cliff', 'hill', 'mountain', 'ground', 'path', 'trail', 'fence',
      'outdoor', 'landscape', 'nature', 'garden', 'park', 'field', 'boulder', 'pebble', 'cobble',
      'lamp', 'lantern', 'bench', 'debris', 'ruins', 'camp', 'well', 'barrel', 'cart', 'signpost'],
  },
  {
    id: 'structures',
    label: 'Structures',
    color: '#00f0ff',
    keywords: ['building', 'house', 'cabin', 'tower', 'wall', 'door', 'window', 'roof', 'bridge',
      'arch', 'pillar', 'column', 'ruin', 'castle', 'church', 'shop', 'barn', 'structure', 'shed',
      'hut', 'palace', 'mansion', 'gate', 'stair', 'floor', 'ceiling', 'bunker', 'lighthouse',
      'stadium', 'arena', 'dock', 'pier', 'vault', 'temple', 'shrine', 'tomb'],
  },
  {
    id: 'frameworks',
    label: 'Frameworks & Kits',
    color: '#8b5cf6',
    keywords: ['frame', 'scaffold', 'rig', 'skeleton', 'armature', 'framework', 'module',
      'component', 'prefab', 'template', 'kit', 'pack', 'set', 'collection', 'bundle',
      'starter', 'base', 'system', 'library', 'asset_pack', 'assetpack', 'toolkit'],
  },
  {
    id: 'water',
    label: 'Water',
    color: '#38bdf8',
    keywords: ['water', 'ocean', 'lake', 'river', 'stream', 'pond', 'wave', 'waterfall', 'rain',
      'puddle', 'sea', 'beach', 'shore', 'coast', 'wet', 'fluid', 'pool', 'fountain', 'splash',
      'foam', 'tide', 'reef', 'underwater', 'marsh', 'swamp', 'glacier', 'iceberg', 'rapids'],
  },
  {
    id: 'terraforming',
    label: 'Terraforming',
    color: '#ff0080',
    keywords: ['terrain', 'terra', 'soil', 'dirt', 'sand', 'gravel', 'mud', 'clay', 'lava',
      'volcano', 'canyon', 'valley', 'cave', 'island', 'biome', 'heightmap', 'displacement',
      'sculpt', 'erode', 'topography', 'elevation', 'contour', 'mound', 'crater', 'mesa',
      'plateau', 'tundra', 'desert', 'arctic', 'tropic'],
  },
  {
    id: 'misc',
    label: 'Miscellaneous',
    color: '#64748b',
    keywords: [],
  },
];

export interface Asset {
  id: string;
  name: string;
  fileName: string;
  category: string;
  storageUrl: string;
  storagePath: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  uploaderName: string;
  uploadedAt: Timestamp;
  tags: string[];
}

export function classifyAsset(filename: string): string {
  const lower = filename.toLowerCase().replace(/[_\-. ]/g, ' ');
  for (const cat of ASSET_CATEGORIES) {
    if (cat.id === 'misc') continue;
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.id;
  }
  return 'misc';
}

export function uploadAsset(
  file: File,
  overrideCategory?: string,
  onProgress?: (pct: number) => void,
): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const user = auth.currentUser;
    if (!user) return reject(new Error('Not authenticated'));

    const category = overrideCategory || classifyAsset(file.name);
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `ops_assets/${category}/${ts}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });

    task.on(
      'state_changed',
      snap => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          const asset: Omit<Asset, 'id'> = {
            name: file.name.replace(/\.[^.]+$/, ''),
            fileName: file.name,
            category,
            storageUrl: url,
            storagePath,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
            uploadedBy: user.uid,
            uploaderName: user.displayName || user.email || 'Staff',
            uploadedAt: Timestamp.now(),
            tags: [],
          };
          const docRef = await addDoc(collection(db, 'ops_assets'), asset);
          resolve({ id: docRef.id, ...asset });
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

export function subscribeAssets(category: string | null, cb: (assets: Asset[]) => void) {
  const q = category
    ? query(collection(db, 'ops_assets'), where('category', '==', category), orderBy('uploadedAt', 'desc'))
    : query(collection(db, 'ops_assets'), orderBy('uploadedAt', 'desc'));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Asset)));
}

export async function deleteAsset(asset: Asset) {
  try { await deleteObject(ref(storage, asset.storagePath)); } catch {}
  await deleteDoc(doc(db, 'ops_assets', asset.id));
}

export async function moveAsset(assetId: string, newCategory: string) {
  await updateDoc(doc(db, 'ops_assets', assetId), { category: newCategory });
}
