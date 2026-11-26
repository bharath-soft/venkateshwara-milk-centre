import { supabase } from './supabase.js';

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const authenticate = wrap(async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Please log in.' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Session expired. Please log in again.' });
  const { data: profile } = await supabase.from('profiles').select('id,name,role').eq('id', data.user.id).single();
  if (!profile) return res.status(403).json({ error: 'No profile found for this account.' });
  req.user = profile;
  next();
});

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You are not allowed to do this.' });

export const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: 'Invalid input.', details: r.error.flatten().fieldErrors });
  req.body = r.data;
  next();
};

export const notFound = (req, res) => res.status(404).json({ error: 'Route not found.' });
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.code === '23505') return res.status(409).json({ error: 'This entry already exists.' });
  if (err.code === '23503') return res.status(400).json({ error: 'Related record not found or still in use.' });
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
