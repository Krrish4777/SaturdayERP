// ============================================================
// SATURDAY ERP+ — supabase.js
// Database engine — include this in app.html BEFORE any other scripts
// <script src="supabase.js"></script>
// ============================================================

// ── CONFIGURATION ──
// Replace these with your actual Supabase project values
// Found at: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://dglkaxkdqeeprifopywb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnbGtheGtkcWVlcHJpZm9weXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzQ0MTcsImV4cCI6MjA5MDAxMDQxN30.aD6HzJ5ND9jSOji0ZwoYniE4xbCiWxlhqkV5EVEuZlY';

// ── LOAD SUPABASE CLIENT ──
// This loads automatically from CDN — no npm needed
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// AUTH
// ============================================================
const Auth = {

  // Sign up new user + create company
  async signUp(firstName, lastName, email, password, mobile) {
    const fullName = `${firstName} ${lastName}`.trim();
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    return data;
  },

  // Sign in
  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await db.auth.signOut();
    if (error) throw error;
  },

  // Get current session
  async getSession() {
    const { data } = await db.auth.getSession();
    return data.session;
  },

  // Get current user + their profile
  async getCurrentUser() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return null;
    const { data: profile } = await db
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', user.id)
      .single();
    return { ...user, profile };
  },

  // Listen for auth state changes
  onAuthChange(callback) {
    return db.auth.onAuthStateChange(callback);
  },

  // Reset password
  async resetPassword(email) {
    const { error } = await db.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }
};

// ============================================================
// COMPANY
// ============================================================
const Company = {

  // Create company during setup wizard
  async create(data) {
    const { data: company, error } = await db
      .from('companies')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    // Link user to company
    const session = await Auth.getSession();
    if (session) {
      await db.from('profiles')
        .update({ company_id: company.id, role: 'CMD', level: 1 })
        .eq('id', session.user.id);
    }
    return company;
  },

  // Get current company
  async get() {
    const { data, error } = await db
      .from('companies')
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // Update company details
  async update(updates) {
    const company = await this.get();
    const { data, error } = await db
      .from('companies')
      .update(updates)
      .eq('id', company.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// PROJECTS
// ============================================================
const Projects = {

  async getAll() {
    const { data, error } = await db
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(projectData) {
    const company = await Company.get();
    const { data, error } = await db
      .from('projects')
      .insert({ ...projectData, company_id: company.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await db
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await db.from('projects').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================================
// INDENTS
// ============================================================
const Indents = {

  async getAll(projectId = null) {
    let query = db.from('indents')
      .select('*, projects(name), profiles!raised_by(full_name)')
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async create(indentData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('indents')
      .insert({
        ...indentData,
        company_id: company.id,
        raised_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async approve(id, remarks = '') {
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('indents')
      .update({
        status: 'approved',
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
        remarks
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async reject(id, remarks) {
    const { data, error } = await db
      .from('indents')
      .update({ status: 'rejected', remarks })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// PURCHASE ORDERS
// ============================================================
const PurchaseOrders = {

  async getAll(projectId = null) {
    let query = db.from('purchase_orders')
      .select('*, projects(name), vendors(name)')
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async create(poData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('purchase_orders')
      .insert({
        ...poData,
        company_id: company.id,
        created_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(id, status) {
    const { data, error } = await db
      .from('purchase_orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// GRN
// ============================================================
const GRN = {

  async getAll(projectId = null) {
    let query = db.from('grn')
      .select('*, purchase_orders(material, vendor_id, quantity)')
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async create(grnData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('grn')
      .insert({
        ...grnData,
        company_id: company.id,
        received_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    // Update PO status to delivered
    if (grnData.po_id) {
      await PurchaseOrders.updateStatus(grnData.po_id, 'delivered');
    }
    return data;
  }
};

// ============================================================
// VENDORS
// ============================================================
const Vendors = {

  async getAll() {
    const { data, error } = await db
      .from('vendors')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },

  async create(vendorData) {
    const company = await Company.get();
    const { data, error } = await db
      .from('vendors')
      .insert({ ...vendorData, company_id: company.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await db
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// STOCK
// ============================================================
const Stock = {

  async getBalance(projectId = null) {
    let query = db.from('stock_balance').select('*');
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async issueM aterial(stockId, issuedQty) {
    const { data: current } = await db
      .from('stock').select('issued_qty').eq('id', stockId).single();
    const { data, error } = await db
      .from('stock')
      .update({
        issued_qty: (current.issued_qty || 0) + issuedQty,
        updated_at: new Date().toISOString()
      })
      .eq('id', stockId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getLowStock() {
    const { data, error } = await db
      .from('stock_balance')
      .select('*')
      .eq('stock_status', 'low');
    if (error) throw error;
    return data;
  }
};

// ============================================================
// BOQ
// ============================================================
const BOQ = {

  async getByProject(projectId) {
    const { data, error } = await db
      .from('boq_summary')
      .select('*')
      .eq('project_id', projectId)
      .order('item_no');
    if (error) throw error;
    return data;
  },

  async addItem(itemData) {
    const company = await Company.get();
    const { data, error } = await db
      .from('boq_items')
      .insert({ ...itemData, company_id: company.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateDoneQty(id, doneQty) {
    const { data, error } = await db
      .from('boq_items')
      .update({ done_qty: doneQty })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getProjectSummary(projectId) {
    const { data, error } = await db
      .from('boq_summary')
      .select('total_value, done_value, balance_value')
      .eq('project_id', projectId);
    if (error) throw error;
    const totals = data.reduce((acc, row) => ({
      total: acc.total + (row.total_value || 0),
      done: acc.done + (row.done_value || 0),
      balance: acc.balance + (row.balance_value || 0)
    }), { total: 0, done: 0, balance: 0 });
    return totals;
  }
};

// ============================================================
// RA BILLS
// ============================================================
const RABills = {

  async getByProject(projectId) {
    const { data, error } = await db
      .from('ra_bills')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(billData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('ra_bills')
      .insert({
        ...billData,
        company_id: company.id,
        created_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markPaid(id, paymentAmount, paymentDate) {
    const { data, error } = await db
      .from('ra_bills')
      .update({
        status: 'paid',
        payment_amount: paymentAmount,
        payment_received_date: paymentDate
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTotalBilled(projectId) {
    const { data, error } = await db
      .from('ra_bills')
      .select('gross_amount, net_amount, retention_amount')
      .eq('project_id', projectId);
    if (error) throw error;
    return data.reduce((acc, b) => ({
      gross: acc.gross + (b.gross_amount || 0),
      net: acc.net + (b.net_amount || 0),
      retention: acc.retention + (b.retention_amount || 0)
    }), { gross: 0, net: 0, retention: 0 });
  }
};

// ============================================================
// FINANCE / LEDGER
// ============================================================
const Finance = {

  async getLedger(projectId = null, limit = 50) {
    let query = db.from('ledger')
      .select('*, projects(name), profiles!created_by(full_name)')
      .order('voucher_date', { ascending: false })
      .limit(limit);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async postVoucher(voucherData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('ledger')
      .insert({
        ...voucherData,
        company_id: company.id,
        created_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getExpenses(projectId = null) {
    let query = db.from('expenses')
      .select('*, projects(name)')
      .order('expense_date', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async addExpense(expenseData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('expenses')
      .insert({
        ...expenseData,
        company_id: company.id,
        approved_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // SATURDAY calls this to compute and save daily P&L
  async saveDailyPnL(projectId, snapDate, revenue, directCost, overhead, workDoneValue) {
    const company = await Company.get();
    const { data, error } = await db
      .from('pnl_daily')
      .upsert({
        company_id: company.id,
        project_id: projectId,
        snap_date: snapDate,
        revenue, direct_cost: directCost,
        overhead, work_done_value: workDoneValue
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getDailyPnL(projectId, days = 7) {
    const { data, error } = await db
      .from('pnl_daily')
      .select('*')
      .eq('project_id', projectId)
      .order('snap_date', { ascending: false })
      .limit(days);
    if (error) throw error;
    return data;
  },

  // Get all-projects cumulative P&L for CMD dashboard
  async getCumulativePnLToday() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await db
      .from('pnl_daily')
      .select('net_pnl, work_done_value, projects(name)')
      .eq('snap_date', today);
    if (error) throw error;
    const totals = data.reduce((acc, r) => ({
      net_pnl: acc.net_pnl + (r.net_pnl || 0),
      work_done: acc.work_done + (r.work_done_value || 0)
    }), { net_pnl: 0, work_done: 0 });
    return { totals, breakdown: data };
  }
};

// ============================================================
// DPR (Daily Progress Reports)
// ============================================================
const DPR = {

  async getByProject(projectId, limit = 20) {
    const { data, error } = await db
      .from('dpr')
      .select('*, profiles!submitted_by(full_name)')
      .eq('project_id', projectId)
      .order('report_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async submit(dprData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('dpr')
      .insert({
        ...dprData,
        company_id: company.id,
        submitted_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// MILESTONES
// ============================================================
const Milestones = {

  async getByProject(projectId) {
    const { data, error } = await db
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('target_date');
    if (error) throw error;
    return data;
  },

  async create(milestoneData) {
    const company = await Company.get();
    const { data, error } = await db
      .from('milestones')
      .insert({ ...milestoneData, company_id: company.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markDone(id, actualDate) {
    const { data, error } = await db
      .from('milestones')
      .update({ status: 'done', actual_date: actualDate })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// HR
// ============================================================
const HR = {

  async getStaff() {
    const { data, error } = await db
      .from('staff')
      .select('*, profiles(full_name, role), projects(name)')
      .eq('is_active', true);
    if (error) throw error;
    return data;
  },

  async addStaff(staffData) {
    const company = await Company.get();
    const { data, error } = await db
      .from('staff')
      .insert({ ...staffData, company_id: company.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAgencies() {
    const { data, error } = await db
      .from('agencies')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },

  async addAgency(agencyData) {
    const company = await Company.get();
    const { data, error } = await db
      .from('agencies')
      .insert({ ...agencyData, company_id: company.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// APPROVALS
// ============================================================
const Approvals = {

  async getPending() {
    const { data, error } = await db
      .from('approvals')
      .select('*, projects(name), profiles!raised_by(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(approvalData) {
    const company = await Company.get();
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('approvals')
      .insert({
        ...approvalData,
        company_id: company.id,
        raised_by: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async approve(id, remarks = '') {
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('approvals')
      .update({
        status: 'approved',
        decided_by: session.user.id,
        decided_at: new Date().toISOString(),
        remarks
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async reject(id, remarks) {
    const session = await Auth.getSession();
    const { data, error } = await db
      .from('approvals')
      .update({
        status: 'rejected',
        decided_by: session.user.id,
        decided_at: new Date().toISOString(),
        remarks
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getCount() {
    const { count, error } = await db
      .from('approvals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) throw error;
    return count;
  }
};

// ============================================================
// USERS / PROFILES
// ============================================================
const Users = {

  async getAll() {
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('level');
    if (error) throw error;
    return data;
  },

  async updateProfile(id, updates) {
    const { data, error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRole(id, role, level) {
    const { data, error } = await db
      .from('profiles')
      .update({ role, level })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// TENDERS
// ============================================================
const Tenders = {

  async getAll() {
    const { data, error } = await db
      .from('tenders')
      .select('*')
      .order('submission_date');
    if (error) throw error;
    return data;
  },

  async create(tenderData) {
    const company = await Company.get();
    const { data, error } = await db
      .from('tenders')
      .insert({ ...tenderData, company_id: company.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// Live updates pushed to CMD dashboard automatically
// ============================================================
const Realtime = {

  // Listen for new approvals — updates bell badge live
  onNewApproval(callback) {
    return db.channel('approvals')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'approvals'
      }, callback)
      .subscribe();
  },

  // Listen for P&L updates — CMD dashboard refreshes live
  onPnLUpdate(callback) {
    return db.channel('pnl')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pnl_daily'
      }, callback)
      .subscribe();
  },

  // Listen for indent status changes
  onIndentUpdate(callback) {
    return db.channel('indents')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'indents'
      }, callback)
      .subscribe();
  },

  // Unsubscribe from all channels
  unsubscribeAll() {
    db.removeAllChannels();
  }
};

// ============================================================
// HELPERS
// ============================================================
const Helpers = {

  // Format Indian currency
  formatINR(amount) {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  },

  // Format large numbers
  formatShort(amount) {
    if (!amount) return '₹0';
    if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + 'Cr';
    if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return '₹' + (amount / 1000).toFixed(0) + 'K';
    return '₹' + amount;
  },

  // Today's date in ISO format
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // Show error toast
  showError(msg) {
    window.T && T('Error: ' + msg, 'e');
    console.error('DB Error:', msg);
  },

  // Show success toast
  showSuccess(msg) {
    window.T && T(msg, 's');
  }
};

// ============================================================
// APP INITIALIZER
// Call this on page load to check auth and load user data
// ============================================================
const ERP = {

  user: null,
  company: null,
  projects: [],

  async init() {
    try {
      const session = await Auth.getSession();
      if (!session) {
        showPage('pg-login');
        return false;
      }
      this.user = await Auth.getCurrentUser();
      if (!this.user?.profile?.company_id) {
        showPage('pg-setup');
        return false;
      }
      this.company = this.user.profile.companies;
      this.projects = await Projects.getAll();
      // Update sidebar with real data
      document.getElementById('sb-co').textContent =
        this.company?.short_name || this.company?.name || 'Company';
      document.getElementById('sb-nm').textContent =
        this.user.profile.full_name || 'User';
      document.getElementById('sb-rl').textContent =
        this.user.profile.role || 'User';
      document.getElementById('sb-av').textContent =
        (this.user.profile.full_name || 'U')[0].toUpperCase();
      // Load approval count for bell badge
      const pendingCount = await Approvals.getCount();
      if (pendingCount > 0) {
        document.querySelectorAll('.nb').forEach(el => el.textContent = pendingCount);
      }
      showPage('pg-app');
      return true;
    } catch (err) {
      console.error('Init error:', err);
      showPage('pg-login');
      return false;
    }
  }
};

// ============================================================
// UPDATED AUTH FUNCTIONS
// Replace the existing doLogin/doSignup/demoLogin in app.html
// ============================================================

async function doLogin() {
  const email = document.getElementById('lem')?.value.trim();
  const password = document.getElementById('lpw')?.value.trim();
  const errEl = document.getElementById('lerr');
  if (!email || !password) {
    if (errEl) errEl.style.display = 'block';
    return;
  }
  if (errEl) errEl.style.display = 'none';
  try {
    const btnEl = document.querySelector('#lf .btn-p');
    if (btnEl) { btnEl.textContent = 'Signing in...'; btnEl.disabled = true; }
    await Auth.signIn(email, password);
    await ERP.init();
    if (btnEl) { btnEl.textContent = 'Sign In to ERP+'; btnEl.disabled = false; }
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Invalid credentials.'; errEl.style.display = 'block'; }
    const btnEl = document.querySelector('#lf .btn-p');
    if (btnEl) { btnEl.textContent = 'Sign In to ERP+'; btnEl.disabled = false; }
  }
}

async function doSignup() {
  const first = document.getElementById('sfn')?.value.trim();
  const last = document.getElementById('sln')?.value.trim();
  const email = document.getElementById('sem')?.value.trim();
  const mobile = document.getElementById('smb')?.value.trim();
  const password = document.getElementById('spw')?.value.trim();
  const errEl = document.getElementById('serr');
  if (!first || !email || !password) {
    if (errEl) errEl.style.display = 'block';
    return;
  }
  if (errEl) errEl.style.display = 'none';
  try {
    const btnEl = document.querySelector('#sf2 .btn-p, #sf .btn-p');
    if (btnEl) { btnEl.textContent = 'Creating account...'; btnEl.disabled = true; }
    await Auth.signUp(first, last, email, password, mobile);
    // Go to setup wizard
    showPage('pg-setup');
    if (btnEl) { btnEl.textContent = 'Create Account & Setup Company'; btnEl.disabled = false; }
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Signup failed. Try again.'; errEl.style.display = 'block'; }
    const btnEl = document.querySelector('#sf2 .btn-p, #sf .btn-p');
    if (btnEl) { btnEl.textContent = 'Create Account & Setup Company'; btnEl.disabled = false; }
  }
}

// Demo login still works for testing
function demoLogin() {
  launch();
}

// Real logout
async function doLogout() {
  try {
    await Auth.signOut();
  } catch (e) {}
  showPage('pg-login');
}

// Updated setup wizard completion — saves company to DB
async function launchApp() {
  try {
    const companyData = {
      name: document.getElementById('s1n')?.value || 'My Company',
      short_name: document.getElementById('s1s')?.value || 'CO',
      industry: document.getElementById('s1i')?.value || 'civil',
      company_type: document.getElementById('s1t')?.value || 'pvt',
      gstin: document.getElementById('s2g')?.value || '',
      pan: document.getElementById('s2p')?.value || '',
      address: document.getElementById('s2a')?.value || '',
      city: document.getElementById('s2c')?.value || '',
      state: document.getElementById('s2st')?.value || 'TG',
      phone: document.getElementById('s2ph')?.value || '',
      email: document.getElementById('s2em')?.value || '',
    };
    await Company.create(companyData);
    await ERP.init();
  } catch (err) {
    console.error('Setup error:', err);
    // Fallback to demo mode if DB not connected
    launch();
  }
}

// Auto-init on page load
document.addEventListener('DOMContentLoaded', () => {
  ERP.init().catch(() => showPage('pg-login'));
});

console.log('%c Saturday ERP+ Database Engine loaded ✓', 'color:#818cf8;font-weight:bold;');
