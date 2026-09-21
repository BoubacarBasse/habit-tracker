// Minimal in-memory stand-in for the Supabase client: just the calls store.js makes.
export function makeFakeClient(seed = {}) {
  const tables = {
    habits: [], checkins: [], nudges: [],
    profiles: [{ owner: 'boubacar', phone: null, remind: true, tz: 'America/New_York' }, { owner: 'nawel', phone: null, remind: true, tz: 'America/New_York' }],
    ...seed,
  };
  let counter = 0;
  const fake = { tables, failNext: null, calls: [] };

  fake.from = (name) => {
    const s = { op: 'select', filters: [], orders: [], range: null, single: false, returning: false };
    const q = {
      select() { if (s.op !== 'select') s.returning = true; return q; },
      insert(row) { s.op = 'insert'; s.rows = Array.isArray(row) ? row : [row]; return q; },
      update(patch) { s.op = 'update'; s.patch = patch; return q; },
      delete() { s.op = 'delete'; return q; },
      eq(c, v) { s.filters.push((r) => r[c] === v); return q; },
      gte(c, v) { s.filters.push((r) => r[c] >= v); return q; },
      match(obj) { for (const [c, v] of Object.entries(obj)) s.filters.push((r) => r[c] === v); return q; },
      order(c, { ascending = true } = {}) { s.orders.push({ c, ascending }); return q; },
      range(a, b) { s.range = [a, b]; return q; },
      single() { s.single = true; return q; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };

    function run() {
      fake.calls.push(`${s.op} ${name}`);
      if (fake.failNext) {
        const error = fake.failNext;
        fake.failNext = null;
        if (error.throw) throw new TypeError('Failed to fetch');
        return { data: null, error };
      }
      const table = tables[name];
      const matching = () => table.filter((r) => s.filters.every((f) => f(r)));

      if (s.op === 'insert') {
        const out = [];
        for (const row of s.rows) {
          if (name === 'checkins' && table.some((r) => r.habit_id === row.habit_id && r.owner === row.owner && r.day === row.day)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          const full = { ...row };
          if (name !== 'checkins') full.id = `id-${++counter}`;
          full.created_at = full.created_at || new Date().toISOString();
          if (name === 'nudges') full.read = false;
          table.push(full);
          out.push({ ...full });
        }
        const data = s.returning ? (s.single ? out[0] : out) : null;
        return { data, error: null };
      }
      if (s.op === 'update') {
        for (const r of matching()) Object.assign(r, s.patch);
        return { data: null, error: null };
      }
      if (s.op === 'delete') {
        const doomed = new Set(matching());
        tables[name] = table.filter((r) => !doomed.has(r));
        if (name === 'habits') {
          const ids = new Set([...doomed].map((r) => r.id));
          tables.checkins = tables.checkins.filter((c) => !ids.has(c.habit_id));
        }
        return { data: null, error: null };
      }
      let rows = matching().map((r) => ({ ...r }));
      for (const { c, ascending } of [...s.orders].reverse()) {
        rows.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (ascending ? 1 : -1));
      }
      if (s.range) rows = rows.slice(s.range[0], s.range[1] + 1);
      return { data: rows, error: null };
    }
    return q;
  };
  return fake;
}
