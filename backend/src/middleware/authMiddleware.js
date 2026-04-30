import { supabase } from '../config/supabaseClient.js';


export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error) return res.status(401).json({ error: 'Unauthorized' });

  req.user = data.user;
  next();
};

export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};