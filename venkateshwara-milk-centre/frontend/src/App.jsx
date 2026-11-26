import { useEffect, useState } from 'react';
import { supabase, api } from './api';
import { EntryForm, Records, Farmers, input, button } from './components.jsx';

function Login({ notify }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) notify('Wrong email or password.', true);
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-3 rounded-lg bg-white p-6 shadow">
      <h1 className="text-xl font-bold">Venkateshwara Milk Centre</h1>
      <input required type="email" placeholder="Email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
      <input required type="password" placeholder="Password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
      <button disabled={busy} className={`${button} w-full`}>{busy ? 'Signing in…' : 'Log in'}</button>
    </form>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null);
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState('records');

  const notify = (msg, error = false) => { setToast({ msg, error }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) api('/api/me').then(setMe).catch((e) => notify(e.message, true));
    else setMe(null);
  }, [session]);

  if (session === undefined) return <p className="p-6 text-sm text-gray-500">Loading…</p>;

  return (
    <>
      {toast && <div className={`fixed right-4 top-4 z-10 rounded px-4 py-2 text-sm text-white shadow ${toast.error ? 'bg-red-600' : 'bg-green-600'}`}>{toast.msg}</div>}
      {!session ? <Login notify={notify} /> : (
        <>
          <nav className="flex flex-wrap items-center gap-4 bg-blue-700 px-4 py-3 text-white">
            <span className="font-bold">Venkateshwara Milk Centre</span>
            {me?.role === 'admin' && ['records', 'farmers'].map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`text-sm capitalize ${tab === t ? 'underline' : ''}`}>{t}</button>
            ))}
            <span className="ml-auto text-sm">{me ? `${me.name} (${me.role})` : ''}</span>
            <button className="text-sm underline" onClick={() => supabase.auth.signOut()}>Log out</button>
          </nav>
          <main className="mx-auto max-w-5xl space-y-4 p-4">
            {!me ? <p className="text-sm text-gray-500">Loading your account…</p> : tab === 'farmers' && me.role === 'admin' ? <Farmers notify={notify} /> : (
              <>
                {me.role !== 'farmer' && <EntryForm notify={notify} onSaved={() => setTick((t) => t + 1)} />}
                <Records key={tick} role={me.role} />
              </>
            )}
          </main>
        </>
      )}
    </>
  );
}
