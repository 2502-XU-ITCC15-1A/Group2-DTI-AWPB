import { supabase } from '../config/supabaseClient.js';

//ayha na pag naay tokens
/*export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token' });

  const { data, error } = await supabase.auth.getUser(token);

  if (error) return res.status(401).json({ error: 'Invalid token' });

  req.user = data.user;
  next();
};*/

export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};