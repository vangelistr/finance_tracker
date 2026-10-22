// mongosh helper for the backup run log (`backup_runs`). Inputs come from environment variables only.
// Run with: mongosh --nodb --quiet --norc --file runs.js   (ACTION, MONGO_URI, MONGO_DB and action fields)
const env = process.env;
const conn = new Mongo(env.MONGO_URI);
const db = conn.getDB(env.MONGO_DB);
const runs = db.getCollection('backup_runs');

function counts() {
  const out = {};
  for (const name of db.getCollectionNames().sort()) {
    if (name.startsWith('system.')) continue;
    out[name] = db.getCollection(name).countDocuments({});
  }
  return out;
}

function json(name) {
  return env[name] ? JSON.parse(env[name]) : null;
}

switch (env.ACTION) {
  case 'start': {
    const res = runs.insertOne({
      kind: env.RUN_KIND,
      trigger: env.RUN_TRIGGER,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
      durationMs: null,
      snapshotId: null,
      countsBefore: null,
      countsAfter: null,
      offsite: env.RUN_OFFSITE === 'true',
      error: null,
      notifiedAt: null,
    });
    print(res.insertedId.toHexString());
    break;
  }
  case 'finish': {
    const id = ObjectId(env.RUN_ID);
    const run = runs.findOne({ _id: id });
    const now = new Date();
    runs.updateOne(
      { _id: id },
      {
        $set: {
          status: env.RUN_STATUS,
          finishedAt: now,
          durationMs: run ? now.getTime() - run.startedAt.getTime() : null,
          snapshotId: env.RUN_SNAPSHOT || null,
          countsBefore: json('RUN_COUNTS_BEFORE'),
          countsAfter: json('RUN_COUNTS_AFTER'),
          error: env.RUN_ERROR ? env.RUN_ERROR.slice(0, 300) : null,
        },
      },
    );
    break;
  }
  case 'counts':
    print(JSON.stringify(counts()));
    break;
  case 'snapshot-counts': {
    const run = runs.findOne({ kind: 'backup', snapshotId: env.RUN_SNAPSHOT, status: { $in: ['success', 'success_with_warning'] } });
    print(JSON.stringify(run ? { before: run.countsBefore, after: run.countsAfter } : null));
    break;
  }
  case 'interrupt-stale': {
    const cutoff = new Date(Date.now() - Number(env.TIMEOUT_MINUTES || 30) * 60_000);
    const res = runs.updateMany(
      { status: 'running', startedAt: { $lt: cutoff } },
      { $set: { status: 'failed', error: 'interrupted', finishedAt: new Date() } },
    );
    print(res.modifiedCount);
    break;
  }
  default:
    throw new Error(`unknown ACTION ${env.ACTION}`);
}
