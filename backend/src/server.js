import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {body, validationResult} from 'express-validator';
import pkg from 'pg';
import dotenv from 'dotenv';
import app from './app.js';

const { Pool } = pkg;
dotenv.config();


const PORT = process.env.PORT || 3000;

// EMERGENCY BYPASS: Force ignore any internal rate limits for testing
app.use((req, res, next) => {
    // If the request is a login and we are getting blocked, 
    // we override the headers or skip the limit logic
    res.setHeader('X-RateLimit-Limit', 1000);
    res.setHeader('X-RateLimit-Remaining', 999);
    next();
});

// Temporary mock storage for users and entries
let users = [];   // Temporary mock storage for users
let entries = []; // Temporary mock storage for entries

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('✅ Connected to Supabase database');
    release();
  }
});

// Database queries instead of mock data

// Import template data from frontend
let templateData = {};
try {
  templateData = require('../data/awpb_dropdown_tree.json');
} catch (e) {
  console.warn("⚠️ Warning: Template JSON not found. Using empty object.");
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Helper function to generate user ID
const generateUserId = () => `acc-${Date.now()}`;

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Authentication routes
app.post('/api/auth/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const normalizedUsername = username.trim().toLowerCase();

    // Find user in database
    const result = await pool.query(
      'SELECT * FROM profiles WHERE username = $1 OR email = $2',
      [normalizedUsername, normalizedUsername]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // this line to actually verify the password!
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name, // This maps database snake_case to frontend camelCase
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User management routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Only admins can access all users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query('SELECT * FROM profiles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', [
  authenticateToken,
  body('username').notEmpty().withMessage('Username is required'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['admin', 'encoder']).withMessage('Role must be admin or encoder')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only admins can create users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, fullName, email, password, role } = req.body;
    const normalizedUsername = username.trim().toLowerCase();

    // Check if user already exists in database
    const existingUsername = await pool.query('SELECT * FROM profiles WHERE username = $1', [normalizedUsername]);
    if (existingUsername.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingEmail = await pool.query('SELECT * FROM profiles WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await pool.query(
      'INSERT INTO profiles (username, full_name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [username, fullName, email, hashedPassword, role, 'active']
    );

    res.status(201).json({
      id: newUser.rows[0].id,
      username: newUser.rows[0].username,
      fullName: newUser.rows[0].full_name, // Match the underscore from your SQL
      email: newUser.rows[0].email,
      role: newUser.rows[0].role,
      status: newUser.rows[0].status,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', [
  authenticateToken,
  body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'encoder']).withMessage('Role must be admin or encoder'),
  body('status').optional().isIn(['active', 'deactivated']).withMessage('Status must be active or deactivated')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only admins can update users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const updates = req.body;

    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent updating self to deactivated
    if (existingUser.rows[0].id === req.user.id && updates.status === 'deactivated') {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (updates.fullName) {
      updateFields.push(`full_name = $${paramIndex++}`);
      updateValues.push(updates.fullName);
    }
    if (updates.email) {
      updateFields.push(`email = $${paramIndex++}`);
      updateValues.push(updates.email);
    }
    if (updates.role) {
      updateFields.push(`role = $${paramIndex++}`);
      updateValues.push(updates.role);
    }
    if (updates.status) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(updates.status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const updateQuery = `UPDATE profiles SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, updateValues);

    res.json({
      ...result.rows[0],
      fullName: result.rows[0].full_name // Fix: Map the database column to the frontend key
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    // Only admins can delete users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting self
    if (existingUser.rows[0].id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await pool.query('DELETE FROM profiles WHERE id = $1', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Entry management routes
app.get('/api/entries', authenticateToken, async (req, res) => {
  try {
    let result;
    
    // Encoders can only see their own entries
    if (req.user.role === 'encoder') {
      result = await pool.query(`
        SELECT e.*, sw.title as submission_window_title, sw.start_date, sw.end_date
        FROM entries e
        LEFT JOIN submission_windows sw ON e.submission_window_id = sw.id
        WHERE e.owner_id = $1
        ORDER BY e.created_at DESC
      `, [req.user.id]);
    } else {
      // Admins can see all entries
      result = await pool.query(`
        SELECT e.*, sw.title as submission_window_title, sw.start_date, sw.end_date
        FROM entries e
        LEFT JOIN submission_windows sw ON e.submission_window_id = sw.id
        ORDER BY e.created_at DESC
      `);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/entries', [
  authenticateToken,
  body('planningYear').isInt({ min: 2020, max: 2030 }),
  body('unit_id').isUUID(),
  body('component_id').isUUID(),
  body('sub_component_id').isUUID(),
  body('key_activity_id').isUUID(),
  body('titleOfActivities').notEmpty()
], async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { 
      planningYear, unit_id, component_id, sub_component_id, 
      key_activity_id, sub_activity_id, titleOfActivities, unitCost,
      monthlyTargets, submission_window_id 
    } = req.body;

    // Step 1: INSERT the entry into the entries table
    const entryQuery = `
      INSERT INTO entries (
        owner_id, unit_id, planning_year, component_id, 
        sub_component_id, key_activity_id, sub_activity_id, 
        title_of_activities, unit_cost, status,
        submission_window_id  -- This is the new part!
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10)
      RETURNING *;
    `;

    const entryValues = [
      req.user.id, unit_id, planningYear, component_id, 
      sub_component_id, key_activity_id, sub_activity_id || null, 
      titleOfActivities, unitCost || 0, submission_window_id
    ];

    const entryResult = await client.query(entryQuery, entryValues);
    const newEntry = entryResult.rows[0];

    // Step 2: Get the new entry_id and INSERT monthly targets
    if (monthlyTargets && typeof monthlyTargets === 'object') {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      
      for (const month of months) {
        const targetValue = monthlyTargets[month] || 0;
        if (targetValue > 0) {
          await client.query(
            'INSERT INTO monthly_targets (entry_id, month, target_quantity) VALUES ($1, $2, $3)',
            [newEntry.id, month, targetValue]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(newEntry);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.put('/api/entries/:id', [
  authenticateToken,
  body('titleOfActivities').optional().notEmpty().withMessage('Title of activities cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // Check if entry exists and get permissions
    const existingEntry = await pool.query('SELECT * FROM entries WHERE id = $1', [id]);
    if (existingEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Check permissions
    const entry = existingEntry.rows[0];
    if (req.user.role === 'encoder' && entry.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Can only edit your own entries' });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (req.body.titleOfActivities) {
      updateFields.push(`title_of_activities = $${paramIndex++}`);
      updateValues.push(req.body.titleOfActivities);
    }
    if (req.body.unitCost !== undefined) {
      updateFields.push(`unit_cost = $${paramIndex++}`);
      updateValues.push(req.body.unitCost);
    }
    if (req.body.status) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(req.body.status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const updateQuery = `UPDATE entries SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, updateValues);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/entries/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if entry exists and get permissions
    const existingEntry = await pool.query('SELECT * FROM entries WHERE id = $1', [id]);
    if (existingEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Check permissions
    const entry = existingEntry.rows[0];
    if (req.user.role === 'encoder' && entry.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Can only delete your own entries' });
    }

    // Delete entry (cascade will delete monthly targets)
    await pool.query('DELETE FROM entries WHERE id = $1', [id]);
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Template data routes
app.get('/api/template', (req, res) => {
  res.json(templateData);
});

// Unit options routes
app.get('/api/unit-options', (req, res) => {
  res.json(templateData.unitOptions || []);
});

// Template hierarchy routes
app.get('/api/template/hierarchy', (req, res) => {
  const { unit } = req.query;
  let hierarchy = templateData.hierarchy || {};
  
  // Filter by unit if specified
  if (unit) {
    // In a real implementation, this would filter based on unit applicability
    // For now, return the full hierarchy
  }
  
  res.json(hierarchy);
});

// Submission window routes
app.get('/api/submission-window', (req, res) => {
  res.json({
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    title: 'FY 2026 Submission Window'
  });
});

// Template Management Routes (Admin only)

// Get all components
app.get('/api/admin/components', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  // This will be replaced with database query
  res.json([
    { id: 'comp-1', name: 'COMPONENT 1: DIRECT ASSISTANCE TO ENTERPRISE', code: 'COMPONENT_1', sort_order: 1, is_active: true },
    { id: 'comp-2', name: 'COMPONENT 2: PROJECT MANAGEMENT', code: 'COMPONENT_2', sort_order: 2, is_active: true },
    { id: 'comp-3', name: 'COMPONENT 3: CAPACITY BUILDING', code: 'COMPONENT_3', sort_order: 3, is_active: true },
    { id: 'comp-4', name: 'COMPONENT 4: INNOVATIVE FINANCING', code: 'COMPONENT_4', sort_order: 4, is_active: true }
  ]);
});

// Create new component
app.post('/api/admin/components', [
  authenticateToken,
  body('name').notEmpty().withMessage('Component name is required'),
  body('code').notEmpty().withMessage('Component code is required')
], (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, code, sort_order } = req.body;
  const newComponent = {
    id: `comp-${Date.now()}`,
    name: name.trim(),
    code: code.trim(),
    sort_order: sort_order || 0,
    is_active: true,
    created_at: new Date().toISOString()
  };

  res.status(201).json(newComponent);
});

// Update component
app.put('/api/admin/components/:id', [
  authenticateToken,
  body('name').optional().notEmpty().withMessage('Component name cannot be empty'),
  body('code').optional().notEmpty().withMessage('Component code cannot be empty')
], (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  const updatedComponent = {
    id,
    ...updates,
    updated_at: new Date().toISOString()
  };

  res.json(updatedComponent);
});

// Delete component
app.delete('/api/admin/components/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  res.json({ message: 'Component deleted successfully' });
});

// Get sub-components by component
app.get('/api/admin/components/:componentId/sub-components', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { componentId } = req.params;
  // Mock data - will be replaced with database query
  res.json([
    { id: 'sub-comp-1', component_id: componentId, name: 'Sub component 1.1 Business Services', code: 'SUB_COMP_1_1', sort_order: 1, is_active: true },
    { id: 'sub-comp-2', component_id: componentId, name: 'Sub component 1.2 Market Linkage', code: 'SUB_COMP_1_2', sort_order: 2, is_active: true }
  ]);
});

// Create sub-component
app.post('/api/admin/components/:componentId/sub-components', [
  authenticateToken,
  body('name').notEmpty().withMessage('Sub-component name is required'),
  body('code').notEmpty().withMessage('Sub-component code is required')
], (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { componentId } = req.params;
  const { name, code, sort_order } = req.body;

  const newSubComponent = {
    id: `sub-comp-${Date.now()}`,
    component_id: componentId,
    name: name.trim(),
    code: code.trim(),
    sort_order: sort_order || 0,
    is_active: true,
    created_at: new Date().toISOString()
  };

  res.status(201).json(newSubComponent);
});

// Get key activities by sub-component
app.get('/api/admin/sub-components/:subComponentId/key-activities', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { subComponentId } = req.params;
  // Mock data - will be replaced with database query
  res.json([
    { 
      id: 'key-act-1', 
      sub_component_id: subComponentId, 
      name: '1.1.1 Business Development Services', 
      code: 'KEY_ACT_1_1_1', 
      activity_no: '1',
      performance_indicator: 'Number of qualified BDS providers engaged for RAPID beneficiaries',
      sort_order: 1, 
      is_active: true 
    },
    { 
      id: 'key-act-2', 
      sub_component_id: subComponentId, 
      name: '1.1.2 Profiling', 
      code: 'KEY_ACT_1_1_2', 
      activity_no: '2',
      performance_indicator: 'Number of Farmer HHs beneficiaries Profiled',
      sort_order: 2, 
      is_active: true 
    }
  ]);
});

// Create key activity
app.post('/api/admin/sub-components/:subComponentId/key-activities', [
  authenticateToken,
  body('name').notEmpty().withMessage('Key activity name is required'),
  body('code').notEmpty().withMessage('Key activity code is required')
], (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { subComponentId } = req.params;
  const { name, code, activity_no, performance_indicator, sort_order } = req.body;

  const newKeyActivity = {
    id: `key-act-${Date.now()}`,
    sub_component_id: subComponentId,
    name: name.trim(),
    code: code.trim(),
    activity_no: activity_no || '',
    performance_indicator: performance_indicator || '',
    sort_order: sort_order || 0,
    is_active: true,
    created_at: new Date().toISOString()
  };

  res.status(201).json(newKeyActivity);
});

// Get sub-activities by key activity
app.get('/api/admin/key-activities/:keyActivityId/sub-activities', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { keyActivityId } = req.params;
  // Mock data - will be replaced with database query
  res.json([
    { 
      id: 'sub-act-1', 
      key_activity_id: keyActivityId, 
      name: '1.1.3.a Productivity/ Techno Transfer-- # of Capability Building, Productivity quality standard and other techno transfer trainings conducted', 
      code: 'SUB_ACT_1_1_3_a', 
      sort_order: 1, 
      is_active: true 
    },
    { 
      id: 'sub-act-2', 
      key_activity_id: keyActivityId, 
      name: '1.1.3.b Productivity/ Techno Transfer-- # of Benchmarking, Learning Visit and study mission conducted', 
      code: 'SUB_ACT_1_1_3_b', 
      sort_order: 2, 
      is_active: true 
    }
  ]);
});

// Create sub-activity
app.post('/api/admin/key-activities/:keyActivityId/sub-activities', [
  authenticateToken,
  body('name').notEmpty().withMessage('Sub-activity name is required'),
  body('code').notEmpty().withMessage('Sub-activity code is required')
], (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { keyActivityId } = req.params;
  const { name, code, sort_order } = req.body;

  const newSubActivity = {
    id: `sub-act-${Date.now()}`,
    key_activity_id: keyActivityId,
    name: name.trim(),
    code: code.trim(),
    sort_order: sort_order || 0,
    is_active: true,
    created_at: new Date().toISOString()
  };

  res.status(201).json(newSubActivity);
});

// Update template item status (activate/deactivate)
app.patch('/api/admin/template/:type/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { type, id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be a boolean' });
  }

  res.json({ 
    message: `${type} status updated successfully`, 
    id, 
    is_active,
    updated_at: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AWPB Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
  console.log(`👥 Default users:`);
  console.log(`   - Admin: adm_admin / password123`);
  console.log(`   - Encoder: enc_user / password123`);
});

export default app;
