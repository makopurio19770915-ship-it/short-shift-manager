const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3840;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const MONGODB_URI = (process.env.MONGODB_URI || '').trim();

const INITIAL_STATE = {
  workers: [],
  requests: [],
  schedules: {},
  /** ユーザー追加部署 { key: 'ext_1', ja: string, vi: string }[] */
  extraDepartments: [],
  nextDeptExtId: 1,
  nextWorkerId: 1,
  nextRequestId: 1,
};

let mutationQueue = Promise.resolve();
function enqueueMutation(fn) {
  const run = () => fn();
  const p = mutationQueue.then(run, run);
  mutationQueue = p.then(
    () => {},
    () => {}
  );
  return p;
}

let mongoClient = null;
let mongoDb = null;
let useMongo = false;

async function initMongo() {
  const { MongoClient } = require('mongodb');
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  mongoDb = mongoClient.db(process.env.MONGO_DB_NAME || 'short_shift_app');
  const col = mongoDb.collection('state');
  const doc = await col.findOne({ _id: 'main' });
  if (!doc) {
    await col.insertOne({ _id: 'main', data: INITIAL_STATE });
  }
  useMongo = true;
  console.log('  保存先: MongoDB Atlas（クラウド永続・マシンの電源に依存しません）');
}

function initFileStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_STATE, null, 2));
  }
  console.log('  保存先: ローカルファイル (' + DATA_FILE + ')');
}

async function readState() {
  if (useMongo) {
    const col = mongoDb.collection('state');
    const doc = await col.findOne({ _id: 'main' });
    return doc?.data ? { ...INITIAL_STATE, ...doc.data } : INITIAL_STATE;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...INITIAL_STATE, ...raw };
  } catch {
    return { ...INITIAL_STATE };
  }
}

async function writeState(body) {
  if (useMongo) {
    const col = mongoDb.collection('state');
    await col.updateOne(
      { _id: 'main' },
      { $set: { data: body, updatedAt: new Date() } },
      { upsert: true }
    );
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2));
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (req, res) => {
  res.json({
    persistence: useMongo ? 'mongodb' : 'file',
    appUrl:
      (process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '') ||
      (process.env.PUBLIC_APP_URL || '').replace(/\/$/, ''),
  });
});

app.get('/api/state', async (req, res) => {
  try {
    const data = await readState();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workers', (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  const name = String(req.body?.name ?? '').trim();
  if (!code || !name) {
    return res.status(400).json({ error: 'コードと氏名は必須です。' });
  }
  enqueueMutation(async () => {
    const s = await readState();
    const dup = s.workers.some((w) => w.code === code);
    if (dup) throw new Error('同じコードのワーカーが既にいます。');
    const id = s.nextWorkerId++;
    s.workers.push({ id, code, name });
    await writeState(s);
  })
    .then(async () => res.json(await readState()))
    .catch((e) => res.status(400).json({ error: e.message }));
});

app.delete('/api/workers/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  enqueueMutation(async () => {
    const s = await readState();
    s.workers = s.workers.filter((w) => w.id !== id);
    s.requests = s.requests.filter((r) => r.workerId !== id);
    Object.keys(s.schedules).forEach((d) => {
      const sch = s.schedules[d];
      if (!sch.cells) return;
      Object.keys(sch.cells).forEach((k) => {
        if (k.startsWith(`${id}_`)) delete sch.cells[k];
      });
      if (sch.deptByWorker) {
        delete sch.deptByWorker[id];
        delete sch.deptByWorker[String(id)];
      }
    });
    await writeState(s);
  })
    .then(async () => res.json(await readState()))
    .catch((e) => res.status(500).json({ error: e.message }));
});

app.post('/api/requests', (req, res) => {
  const workerId = parseInt(req.body?.workerId, 10);
  const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
  const rawNote = String(req.body?.rawNote ?? '').trim();
  if (!workerId) return res.status(400).json({ error: 'ワーカーを選択してください。' });
  if (!slots.length && !rawNote) {
    return res.status(400).json({ error: '日時スロットか備考のどちらかを入力してください。' });
  }
  enqueueMutation(async () => {
    const s = await readState();
    const w = s.workers.find((x) => x.id === workerId);
    if (!w) throw new Error('ワーカーが見つかりません。');
    const reqId = s.nextRequestId++;
    const normalized = slots
      .map((sl) => ({
        date: String(sl.date ?? '').slice(0, 10),
        start: normalizeTime(sl.start),
        end: normalizeTime(sl.end),
      }))
      .filter((sl) => sl.date && sl.start && sl.end);
    s.requests.unshift({
      id: reqId,
      workerId,
      slots: normalized,
      rawNote,
      status: 'pending',
      adjustedSlots: [],
      reviewerNote: '',
      createdAt: new Date().toISOString(),
    });
    await writeState(s);
  })
    .then(async () => res.json(await readState()))
    .catch((e) => res.status(400).json({ error: e.message }));
});

app.patch('/api/requests/:id', (req, res) => {
  const rid = parseInt(req.params.id, 10);
  const status = req.body?.status;
  const adjustedSlots = req.body?.adjustedSlots;
  const reviewerNote = req.body?.reviewerNote !== undefined ? String(req.body.reviewerNote) : undefined;

  enqueueMutation(async () => {
    const s = await readState();
    const r = s.requests.find((x) => x.id === rid);
    if (!r) throw new Error('依頼が見つかりません。');
    if (status === 'approved') {
      r.status = 'approved';
      r.adjustedSlots =
        Array.isArray(adjustedSlots) && adjustedSlots.length
          ? adjustedSlots.map(normalizeSlotObj).filter(Boolean)
          : [...r.slots];
      if (reviewerNote !== undefined) r.reviewerNote = reviewerNote;
    } else if (status === 'rejected') {
      r.status = 'rejected';
      if (reviewerNote !== undefined) r.reviewerNote = reviewerNote;
    } else if (status === 'needs_revision') {
      r.status = 'needs_revision';
      if (Array.isArray(adjustedSlots)) r.adjustedSlots = adjustedSlots.map(normalizeSlotObj).filter(Boolean);
      if (reviewerNote !== undefined) r.reviewerNote = reviewerNote;
    } else {
      throw new Error('無効なステータスです。');
    }
    r.reviewedAt = new Date().toISOString();
    await writeState(s);
  })
    .then(async () => res.json(await readState()))
    .catch((e) => res.status(400).json({ error: e.message }));
});

function normalizeTime(t) {
  if (!t && t !== 0) return '';
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function normalizeSlotObj(sl) {
  const date = String(sl?.date ?? '').slice(0, 10);
  const start = normalizeTime(sl?.start);
  const end = normalizeTime(sl?.end);
  if (!date || !start || !end) return null;
  return { date, start, end };
}

/** POST body: { ja: string, vi: string } — 現場プルダウン用の追加部署 */
app.post('/api/extra-departments', (req, res) => {
  const ja = String(req.body?.ja ?? '').trim();
  const vi = String(req.body?.vi ?? '').trim();
  if (!ja || !vi) {
    return res.status(400).json({ error: '日本語名とベトナム語名の両方を入力してください。' });
  }
  enqueueMutation(async () => {
    const s = await readState();
    if (!Array.isArray(s.extraDepartments)) s.extraDepartments = [];
    if (!s.nextDeptExtId || s.nextDeptExtId < 1) s.nextDeptExtId = 1;
    const key = `ext_${s.nextDeptExtId++}`;
    s.extraDepartments.push({ key, ja, vi });
    await writeState(s);
  })
    .then(async () => res.json(await readState()))
    .catch((e) => res.status(400).json({ error: e.message }));
});

/** ext_* のみ削除可。使用中の現場メモは未設定に戻す */
app.delete('/api/extra-departments/:key', (req, res) => {
  const key = decodeURIComponent(String(req.params.key || ''));
  if (!key.startsWith('ext_')) {
    return res.status(400).json({ error: 'この部署は削除できません。' });
  }
  enqueueMutation(async () => {
    const s = await readState();
    const list = Array.isArray(s.extraDepartments) ? s.extraDepartments : [];
    const idx = list.findIndex((x) => x.key === key);
    if (idx < 0) throw new Error('部署が見つかりません。');
    list.splice(idx, 1);
    s.extraDepartments = list;
    Object.keys(s.schedules || {}).forEach((d) => {
      const sch = s.schedules[d];
      if (!sch?.deptByWorker) return;
      Object.keys(sch.deptByWorker).forEach((wid) => {
        if (sch.deptByWorker[wid] === key) sch.deptByWorker[wid] = '';
      });
    });
    await writeState(s);
  })
    .then(async () => res.json(await readState()))
    .catch((e) => res.status(400).json({ error: e.message }));
});

/** PUT body: { cells?, published?, deptByWorker?, clearCells? } */
app.put('/api/schedules/:date', (req, res) => {
  const date = req.params.date.slice(0, 10);
  enqueueMutation(async () => {
    const s = await readState();
    if (!s.schedules[date]) {
      s.schedules[date] = { cells: {}, published: false, deptByWorker: {} };
    }
    const sch = s.schedules[date];
    if (req.body.clearCells === true) {
      sch.cells = {};
    } else if (req.body.cells && typeof req.body.cells === 'object') {
      sch.cells = { ...sch.cells, ...req.body.cells };
    }
    if (typeof req.body.published === 'boolean') sch.published = req.body.published;
    if (req.body.deptByWorker && typeof req.body.deptByWorker === 'object') {
      sch.deptByWorker = { ...sch.deptByWorker, ...req.body.deptByWorker };
    }
    await writeState(s);
  })
    .then(async () => res.json(await readState()))
    .catch((e) => res.status(400).json({ error: e.message }));
});

async function start() {
  if (MONGODB_URI) {
    await initMongo();
  } else {
    initFileStorage();
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('  短期アルバイト · シフト管理');
    console.log('========================================');
    console.log(`  このPCのみ: http://localhost:${PORT}`);
    console.log('');
    console.log('  ▼ 社外・自宅などからはクラウドのURLを使ってください');
    console.log('  ▼ （Mac がオフでもアクセスできるように Render + MongoDB を設定）');

    const nets = os.networkInterfaces();
    let hasLan = false;
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`     LAN: http://${net.address}:${PORT}`);
          hasLan = true;
        }
      }
    }
    if (!hasLan) {
      console.log('     （Wi-Fi に接続すると LAN の IP が表示されます）');
    }
    if (process.env.RENDER_EXTERNAL_URL) {
      console.log(`  公開URL: ${process.env.RENDER_EXTERNAL_URL}`);
    }
    console.log('========================================\n');
  });

  const shutdown = async () => {
    server.close();
    if (mongoClient) await mongoClient.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
