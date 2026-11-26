import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { authenticate, requireRole, validate, wrap } from '../middleware.js';

const router = Router();
router.use(authenticate);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const createSchema = z.object({
  farmer_id: z.string().uuid(),
  collection_date: date,
  shift: z.union([z.literal(1), z.literal(2)]),
  quantity_litres: z.number().positive().max(500),
  fat: z.number().min(0).max(15).optional(),
  rate_per_litre: z.number().nonnegative().max(500),
});
const querySchema = z.object({ from: date.optional(), to: date.optional(), farmer_id: z.string().uuid().optional(), shift: z.enum(['1', '2']).optional() });

// Build a filtered query; farmers are locked to their own records.
async function scopedQuery(req, columns) {
  const q = querySchema.safeParse(req.query);
  if (!q.success) return { badRequest: q.error.flatten().fieldErrors };
  const { from, to, farmer_id, shift } = q.data;
  let query = supabase.from('milk_collections').select(columns);
  if (req.user.role === 'farmer') {
    const { data: f } = await supabase.from('farmers').select('id').eq('profile_id', req.user.id).maybeSingle();
    if (!f) return { empty: true };
    query = query.eq('farmer_id', f.id);
  } else if (farmer_id) query = query.eq('farmer_id', farmer_id);
  if (from) query = query.gte('collection_date', from);
  if (to) query = query.lte('collection_date', to);
  if (shift) query = query.eq('shift', Number(shift));
  return { query };
}

router.get('/', wrap(async (req, res) => {
  const s = await scopedQuery(req, '*, farmers(name,village)');
  if (s.badRequest) return res.status(400).json({ error: 'Invalid filters.', details: s.badRequest });
  if (s.empty) return res.json([]);
  const { data, error } = await s.query.order('collection_date', { ascending: false }).order('shift').limit(1000);
  if (error) throw error;
  res.json(data);
}));

// Totals for the requested date range (farmer: own; admin/collector: all or one farmer)
router.get('/summary', wrap(async (req, res) => {
  const s = await scopedQuery(req, 'quantity_litres, amount');
  if (s.badRequest) return res.status(400).json({ error: 'Invalid filters.', details: s.badRequest });
  if (s.empty) return res.json({ entries: 0, total_litres: 0, total_amount: 0 });
  const { data, error } = await s.query;
  if (error) throw error;
  const sum = (k) => Math.round(data.reduce((a, r) => a + Number(r[k]), 0) * 100) / 100;
  res.json({ entries: data.length, total_litres: sum('quantity_litres'), total_amount: sum('amount') });
}));

router.post('/', requireRole('admin', 'collector'), validate(createSchema), wrap(async (req, res) => {
  const { data, error } = await supabase.from('milk_collections')
    .insert({ ...req.body, collector_id: req.user.id }).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.put('/:id', requireRole('admin', 'collector'), validate(createSchema.partial()), wrap(async (req, res) => {
  let query = supabase.from('milk_collections').update(req.body).eq('id', req.params.id);
  if (req.user.role === 'collector') query = query.eq('collector_id', req.user.id); // only own entries
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Entry not found.' });
  res.json(data);
}));

router.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
  const { error } = await supabase.from('milk_collections').delete().eq('id', req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

export default router;
