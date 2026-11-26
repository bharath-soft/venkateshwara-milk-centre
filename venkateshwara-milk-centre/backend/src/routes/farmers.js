import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { authenticate, requireRole, validate, wrap } from '../middleware.js';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\- ]{7,15}$/).optional(),
  village: z.string().trim().max(100).optional(),
  profile_id: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

// Collectors need the list to pick a farmer; admins manage it.
router.get('/', requireRole('admin', 'collector'), wrap(async (req, res) => {
  const { data, error } = await supabase.from('farmers').select('*').order('name');
  if (error) throw error;
  res.json(data);
}));

router.get('/:id', requireRole('admin', 'collector'), wrap(async (req, res) => {
  const { data, error } = await supabase.from('farmers').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Farmer not found.' });
  res.json(data);
}));

router.post('/', requireRole('admin'), validate(schema), wrap(async (req, res) => {
  const { data, error } = await supabase.from('farmers').insert(req.body).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.put('/:id', requireRole('admin'), validate(schema.partial()), wrap(async (req, res) => {
  const { data, error } = await supabase.from('farmers').update(req.body).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Farmer not found.' });
  res.json(data);
}));

router.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
  const { error } = await supabase.from('farmers').delete().eq('id', req.params.id);
  if (error) throw error; // 23503 -> farmer has milk records; deactivate instead
  res.status(204).end();
}));

export default router;
