import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

const today = () => new Date().toISOString().slice(0, 10);
export const input = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';
export const button = 'rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
const card = 'rounded-lg bg-white p-4 shadow';

export function EntryForm({ onSaved, notify }) {
  const [farmers, setFarmers] = useState([]);
  const [f, setF] = useState({ farmer_id: '', collection_date: today(), shift: '1', quantity_litres: '', fat: '', rate_per_litre: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/farmers').then(setFarmers).catch((e) => notify(e.message, true)); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { farmer_id: f.farmer_id, collection_date: f.collection_date, shift: Number(f.shift),
        quantity_litres: Number(f.quantity_litres), rate_per_litre: Number(f.rate_per_litre) };
      if (f.fat !== '') body.fat = Number(f.fat);
      await api('/api/collections', { method: 'POST', body });
      notify('Milk entry saved');
      setF({ ...f, quantity_litres: '', fat: '' });
      onSaved();
    } catch (err) { notify(err.message, true); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
      <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Add milk entry</h2>
      <select required className={input} value={f.farmer_id} onChange={set('farmer_id')}>
        <option value="">Select farmer</option>
        {farmers.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}{x.village ? ` – ${x.village}` : ''}</option>)}
      </select>
      <input required type="date" className={input} value={f.collection_date} onChange={set('collection_date')} />
      <select className={input} value={f.shift} onChange={set('shift')}>
        <option value="1">Shift 1 (Morning)</option>
        <option value="2">Shift 2 (Evening)</option>
      </select>
      <input required type="number" step="0.01" min="0.01" placeholder="Litres" className={input} value={f.quantity_litres} onChange={set('quantity_litres')} />
      <input type="number" step="0.01" min="0" max="15" placeholder="Fat % (optional)" className={input} value={f.fat} onChange={set('fat')} />
      <input required type="number" step="0.01" min="0" placeholder="Rate per litre (₹)" className={input} value={f.rate_per_litre} onChange={set('rate_per_litre')} />
      <button disabled={busy} className={`${button} sm:col-span-2`}>{busy ? 'Saving…' : 'Save entry'}</button>
    </form>
  );
}

function Chart({ rows }) {
  const by = {};
  rows.forEach((r) => { by[r.collection_date] = (by[r.collection_date] || 0) + Number(r.quantity_litres); });
  const days = Object.keys(by).sort().slice(-14);
  if (!days.length) return null;
  const max = Math.max(...days.map((d) => by[d]), 1);
  return (
    <div className={card}>
      <h3 className="mb-2 text-sm font-semibold">Litres per day (last 14 days)</h3>
      <div className="flex h-32 items-end gap-1">
        {days.map((d) => (
          <div key={d} className="flex h-full flex-1 flex-col justify-end text-center">
            <div className="w-full rounded-t bg-blue-500" style={{ height: `${(by[d] / max) * 90}%` }} title={`${d}: ${by[d]} L`} />
            <span className="text-[10px] text-gray-500">{d.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Records({ role }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState(null);
  const [sum, setSum] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr(''); setRows(null);
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    try {
      const [r, s] = await Promise.all([api(`/api/collections?${qs}`), api(`/api/collections/summary?${qs}`)]);
      setRows(r); setSum(s);
    } catch (e) { setErr(e.message); setRows([]); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className="text-sm">From<input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">To<input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {sum && (
          <div className="ml-auto flex gap-6 text-sm">
            <div><p className="text-gray-500">Total litres</p><p className="text-xl font-bold">{sum.total_litres}</p></div>
            <div><p className="text-gray-500">Total amount</p><p className="text-xl font-bold">₹{sum.total_amount}</p></div>
          </div>
        )}
      </div>
      {role === 'admin' && rows && <Chart rows={rows} />}
      {err && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{err} <button className="underline" onClick={load}>Retry</button></p>}
      <div className={`${card} overflow-x-auto`}>
        {rows === null ? <p className="text-sm text-gray-500">Loading…</p> : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No milk records found for this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b text-gray-500"><tr>
              <th className="py-2">Date</th><th>Shift</th>{role !== 'farmer' && <th>Farmer</th>}<th>Litres</th><th>Rate</th><th>Amount</th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2">{r.collection_date}</td><td>{r.shift}</td>
                {role !== 'farmer' && <td>{r.farmers?.name}</td>}
                <td>{r.quantity_litres}</td><td>₹{r.rate_per_litre}</td><td>₹{r.amount}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export function Farmers({ notify }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', village: '' });
  const load = () => api('/api/farmers').then(setList).catch((e) => { notify(e.message, true); setList([]); });
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    try {
      const body = { name: f.name };
      if (f.phone) body.phone = f.phone;
      if (f.village) body.village = f.village;
      await api('/api/farmers', { method: 'POST', body });
      notify('Farmer added'); setF({ name: '', phone: '', village: '' }); load();
    } catch (err) { notify(err.message, true); }
  }
  async function toggle(x) {
    try { await api(`/api/farmers/${x.id}`, { method: 'PUT', body: { active: !x.active } }); load(); }
    catch (err) { notify(err.message, true); }
  }

  return (
    <section className="space-y-4">
      <form onSubmit={add} className={`${card} grid gap-3 sm:grid-cols-4`}>
        <input required placeholder="Farmer name" className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Phone" className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input placeholder="Village" className={input} value={f.village} onChange={(e) => setF({ ...f, village: e.target.value })} />
        <button className={button}>Add farmer</button>
      </form>
      <div className={`${card} overflow-x-auto`}>
        {list === null ? <p className="text-sm text-gray-500">Loading…</p> : list.length === 0 ? <p className="text-sm text-gray-500">No farmers yet.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="border-b text-gray-500"><tr><th className="py-2">Name</th><th>Phone</th><th>Village</th><th>Status</th></tr></thead>
            <tbody>{list.map((x) => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="py-2">{x.name}</td><td>{x.phone}</td><td>{x.village}</td>
                <td><button className="text-blue-600 underline" onClick={() => toggle(x)}>{x.active ? 'Active' : 'Inactive'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
