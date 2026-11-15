import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardList, CloudUpload, Database,
  Download, FileSpreadsheet, Home, Leaf, Lightbulb, LogOut, Menu,
  MoreHorizontal, Pencil, Plus, Search, Settings, Sparkles, Trash2,
  Utensils, X, BarChart3, BrainCircuit, AlertCircle, Upload, Package,
  RefreshCw, Wheat, ShieldCheck, Sprout, LockKeyhole, Mail, Building2,
  UserRound, Eye, EyeOff, Clock3, CircleHelp, Loader2
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const navItems = [
  { id: 'overview', label: 'Overview', icon: Home, group: 'WORKSPACE' },
  { id: 'foods', label: 'Food items', icon: Utensils, group: 'WORKSPACE' },
  { id: 'data', label: 'Historical data', icon: Database, group: 'WORKSPACE' },
  { id: 'predict', label: 'Predict demand', icon: BrainCircuit, group: 'WORKSPACE', badge: 'ML' },
  { id: 'records', label: 'Actual records', icon: ClipboardList, group: 'INSIGHTS' },
  { id: 'reports', label: 'Reports & analytics', icon: BarChart3, group: 'INSIGHTS' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'PREFERENCES' },
];

const pageTitles = {
  overview: ['Overview', 'Your canteen activity will appear here as you add data.'],
  foods: ['Food items', 'Create and manage the food items your canteen prepares.'],
  data: ['Historical data', 'Upload your canteen dataset and review its structure.'],
  predict: ['Predict demand', 'Check model readiness and generate forecasts using its saved inputs.'],
  records: ['Actual records', 'Record preparation, consumption, and leftover quantities.'],
  reports: ['Reports & analytics', 'Explore demand and wastage patterns from your records.'],
  settings: ['Settings', 'Manage your canteen profile and workspace preferences.'],
};

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Number(n || 0));
const localISODate = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const today = localISODate();

function Brand({ light = false }) {
  return <div className={`brand-lockup ${light ? 'brand-lockup-light' : ''}`}>
    <div className="brand-mark"><Leaf size={21} strokeWidth={2.2} /></div>
    <div><div className="brand-name">platewise<span>.</span></div><div className="brand-caption">FOOD INTELLIGENCE</div></div>
  </div>;
}

function App() {
  const [phase, setPhase] = useState('landing'); // landing -> loading -> auth -> dashboard
  const [authMode, setAuthMode] = useState('choice');
  const [progress, setProgress] = useState(0);
  const [activePage, setActivePage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [foods, setFoods] = useState([]);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [foodModal, setFoodModal] = useState(null);
  const [recordModal, setRecordModal] = useState(false);
  const [toast, setToast] = useState('');
  const [uploadRows, setUploadRows] = useState([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [trainingMessage, setTrainingMessage] = useState('');
  const [profile, setProfile] = useState({ canteen: '', admin: '', email: '', location: '' });
  const [recordsSearch, setRecordsSearch] = useState('');
  const fileRef = useRef(null);
  const current = pageTitles[activePage];

  useEffect(() => {
    if (phase !== 'loading') return undefined;
    const timer = window.setInterval(() => setProgress((value) => Math.min(100, value + 2)), 42);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'loading' || progress < 100) return undefined;
    const timer = window.setTimeout(() => {
      setAuthMode('choice');
      setPhase('auth');
    }, 450);
    return () => window.clearTimeout(timer);
  }, [phase, progress]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };
  const go = (id) => { setActivePage(id); setSidebarOpen(false); setSearch(''); };

  const parseFile = async (file) => {
    if (!file) return;
    setUploadError('');
    setUploadFile(null);
    setUploadName(file.name);
    setTrainingStatus('idle');
    setTrainingMessage('');
    try {
      let rows = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        rows = await new Promise((resolve, reject) => Papa.parse(file, {
          header: true, skipEmptyLines: true,
          complete: (result) => resolve(result.data), error: reject,
        }));
      } else if (/\.(xlsx|xls)$/i.test(file.name)) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) : [];
      } else {
        throw new Error('Please choose a CSV or Excel file.');
      }
      if (!rows.length) throw new Error('This file does not contain any data rows.');
      setUploadRows(rows);
      setUploadFile(file);
      notify(`${rows.length.toLocaleString('en-IN')} rows loaded for preview.`);
    } catch (error) {
      setUploadRows([]);
      setUploadError(error.message || 'Could not read this file.');
    }
  };

  const trainModel = async () => {
    if (!uploadFile || !uploadFile.name.toLowerCase().endsWith('.csv')) {
      setTrainingStatus('error');
      setTrainingMessage('Choose a CSV file to train the model.');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    setTrainingStatus('loading');
    setTrainingMessage('');

    try {
      const response = await fetch('http://localhost:8000/train/test_canteen_1', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Training failed. Please try again.');
      }
      setTrainingStatus('success');
      setTrainingMessage(result.message || 'Model trained successfully.');
    } catch (error) {
      setTrainingStatus('error');
      setTrainingMessage(error.message || 'Training failed. Please try again.');
    }
  };

  const saveFood = (food) => {
    if (food.id) setFoods((prev) => prev.map((item) => item.id === food.id ? food : item));
    else setFoods((prev) => [...prev, { ...food, id: Date.now() }]);
    setFoodModal(null);
    notify(food.id ? 'Food item updated.' : 'Food item added.');
  };
  const deleteFood = (id) => {
    setFoods((prev) => prev.filter((food) => food.id !== id));
    notify('Food item removed.');
  };
  const saveRecord = (record) => {
    setRecords((prev) => [{ ...record, id: Date.now() }, ...prev]);
    setRecordModal(false);
    notify('Actual record added to this preview session.');
  };

  const finishAuth = (details) => {
    setProfile({
      canteen: details.canteen || '',
      admin: details.admin || details.email?.split('@')[0] || 'Administrator',
      email: details.email || '',
      location: details.location || '',
    });
    setPhase('dashboard');
    setActivePage('overview');
  };

  const signOut = () => {
    setFoods([]);
    setRecords([]);
    setUploadRows([]);
    setUploadName('');
    setUploadFile(null);
    setProfile({ canteen: '', admin: '', email: '', location: '' });
    setPhase('landing');
    setProgress(0);
    notify('You have left the local preview.');
  };

  if (phase !== 'dashboard') {
    return <LaunchFlow
      phase={phase}
      progress={progress}
      setPhase={setPhase}
      authMode={authMode}
      setAuthMode={setAuthMode}
      onStart={() => { setProgress(0); setPhase('loading'); }}
      onComplete={finishAuth}
    />;
  }

  const filteredFoods = foods.filter((food) => `${food.name} ${food.category}`.toLowerCase().includes(search.toLowerCase()));
  const filteredRecords = records.filter((record) => `${record.food} ${record.meal} ${record.date}`.toLowerCase().includes(recordsSearch.toLowerCase()));
  const avatarLetter = (profile.admin || profile.email || 'A').trim().charAt(0).toUpperCase();

  return <div className="app-shell">
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><Brand /><button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button></div>
      <div className="canteen-switcher">
        <div className="canteen-avatar"><Utensils size={17} /></div>
        <div className="canteen-meta"><strong>{profile.canteen || 'Your canteen'}</strong><span>Administrator workspace</span></div>
        <ChevronDown size={15} className="muted-icon" />
      </div>
      <nav className="navigation">
        {['WORKSPACE', 'INSIGHTS', 'PREFERENCES'].map((group) => <div className="nav-group" key={group}>
          <div className="nav-label">{group}</div>
          {navItems.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-link ${activePage === item.id ? 'active' : ''}`} onClick={() => go(item.id)}>
              <Icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><Lightbulb size={16} /></div><strong>Start with your data.</strong><p>Add your menu and historical records to begin using Platewise.</p><button onClick={() => go('data')}>Add dataset <ArrowRight size={13} /></button></div>
        <div className="user-profile"><div className="user-avatar">{avatarLetter}</div><div className="user-meta"><strong>{profile.admin || 'Administrator'}</strong><span>{profile.email || 'Preview account'}</span></div><button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{current[0]}</strong></div></div>
        <div className="topbar-right"><div className="today-chip"><CalendarDays size={15} /><span>{new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())}</span></div><button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => notify('There are no notifications yet.')}><Bell size={18} /></button><div className="top-avatar">{avatarLetter}</div></div>
      </header>
      <div className="page-wrap">
        <div className="page-heading"><div><div className="eyebrow">CANTEEN WORKSPACE <span className="eyebrow-dot" /></div><h1>{activePage === 'overview' ? `Welcome${profile.admin ? `, ${profile.admin}` : ''}` : current[0]}</h1><p>{current[1]}</p></div>
          {activePage === 'foods' && <button className="btn btn-primary" onClick={() => setFoodModal({ name: '', category: 'Breakfast', unit: 'portions', active: true })}><Plus size={16} /> Add food item</button>}
          {activePage === 'records' && <button className="btn btn-primary" onClick={() => setRecordModal(true)}><Plus size={16} /> Add actual record</button>}
        </div>
        {activePage === 'overview' && <Overview records={records} foods={foods} go={go} />}
        {activePage === 'foods' && <FoodsPage foods={filteredFoods} allFoodsCount={foods.length} search={search} setSearch={setSearch} onEdit={setFoodModal} onDelete={deleteFood} onAdd={() => setFoodModal({ name: '', category: 'Breakfast', unit: 'portions', active: true })} />}
        {activePage === 'data' && <DataPage fileRef={fileRef} parseFile={parseFile} uploadName={uploadName} uploadRows={uploadRows} uploadError={uploadError} uploadFile={uploadFile} trainingStatus={trainingStatus} trainingMessage={trainingMessage} onTrain={trainModel} clear={() => { setUploadRows([]); setUploadName(''); setUploadError(''); setUploadFile(null); setTrainingStatus('idle'); setTrainingMessage(''); if (fileRef.current) fileRef.current.value = ''; }} />}
        {activePage === 'predict' && <PredictPage />}
        {activePage === 'records' && <RecordsPage records={filteredRecords} search={recordsSearch} setSearch={setRecordsSearch} onAdd={() => setRecordModal(true)} />}
        {activePage === 'reports' && <ReportsPage records={records} />}
        {activePage === 'settings' && <SettingsPage profile={profile} setProfile={setProfile} notify={notify} />}
        <footer className="page-footer"><span>Platewise <span className="footer-dot">·</span> Food demand & wastage insights</span><span>Built for more mindful food preparation <Leaf size={13} /></span></footer>
      </div>
    </main>
    {foodModal && <FoodModal initial={foodModal} onClose={() => setFoodModal(null)} onSave={saveFood} />}
    {recordModal && <RecordModal foods={foods} onClose={() => setRecordModal(false)} onSave={saveRecord} />}
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}

function LaunchFlow({ phase, progress, setPhase, authMode, setAuthMode, onStart, onComplete }) {
  return <div className="launch-shell">
    <header className="launch-nav"><Brand /><div className="launch-nav-right"><span>Food demand & wastage intelligence</span>{phase === 'auth' && <button className="launch-text-button" onClick={() => { setPhase('landing'); setAuthMode('choice'); }}>Back to home</button>}</div></header>
    {phase === 'landing' || phase === 'loading' ? <main className="launch-hero">
      <section className="launch-copy">
        <div className="launch-kicker"><span className="kicker-line" /> A MORE THOUGHTFUL WAY TO RUN A CANTEEN</div>
        <h1>Plan the meal.<br /><em>Not the leftovers.</em></h1>
        <p className="launch-description">A simple workspace for canteens to understand food demand, plan preparation, and keep track of what gets left behind.</p>
        <div className="launch-actions">
          <button className={`launch-primary ${phase === 'loading' ? 'launch-loading' : ''}`} onClick={onStart} disabled={phase === 'loading'}>
            {phase === 'loading' ? <><span>Preparing your workspace</span><strong>{progress}%</strong></> : <>Get started <ArrowRight size={17} /></>}
          </button>
          {phase === 'loading' && <div className="launch-progress"><span style={{ width: `${progress}%` }} /></div>}
          <span className="launch-microcopy">For college, school, and institutional canteens</span>
        </div>
        <div className="launch-features">
          <div><span className="launch-feature-icon"><BrainCircuit size={17} /></span><strong>Understand demand</strong><small>Use historical patterns to plan ahead.</small></div>
          <div><span className="launch-feature-icon peach"><Utensils size={17} /></span><strong>Plan preparation</strong><small>Bring daily food planning into one place.</small></div>
          <div><span className="launch-feature-icon gold"><Sprout size={17} /></span><strong>Track leftovers</strong><small>Review consumption and remaining food.</small></div>
        </div>
      </section>
      <section className="launch-art" aria-label="Illustration of mindful food planning">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="art-leaf art-leaf-one"><Leaf size={42} /></div><div className="art-leaf art-leaf-two"><Wheat size={37} /></div>
        <div className="plate-illustration"><div className="plate-ring"><div className="plate-center"><div className="plate-food"><span /><span /><span /><span /><i /></div></div></div></div>
        <div className="art-note note-top"><span className="note-icon"><CalendarDays size={16} /></span><div><strong>A clearer daily plan</strong><small>One meal at a time</small></div></div>
        <div className="art-note note-bottom"><span className="note-icon leaf-note"><Leaf size={16} /></span><div><strong>Less avoidable waste</strong><small>More mindful preparation</small></div></div>
        <div className="art-stamp"><span>PLAN</span><span>·</span><span>PREPARE</span><span>·</span><span>REFLECT</span></div>
      </section>
    </main> : <AuthScreen mode={authMode} setMode={setAuthMode} onComplete={onComplete} onBack={() => { setPhase('landing'); setAuthMode('choice'); }} />}
    <footer className="launch-footer"><span>© {new Date().getFullYear()} Platewise</span><span><Leaf size={13} /> Better planning, thoughtful portions.</span><span className="launch-footer-note">Frontend preview · Secure accounts are not connected yet</span></footer>
  </div>;
}

function AuthScreen({ mode, setMode, onComplete, onBack }) {
  const AuthIcon = mode === 'signup' ? Building2 : UserRound;
  const [form, setForm] = useState({ admin: '', canteen: '', location: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'signup' && (!form.admin.trim() || !form.canteen.trim())) {
      setError('Please enter your name and canteen name.');
      return;
    }
    onComplete(form);
  };

  return <main className="auth-wrap">
    <div className="auth-intro"><button className="auth-back" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Back to landing page</button><div className="launch-kicker"><span className="kicker-line" /> YOUR CANTEEN WORKSPACE</div><h1>{mode === 'choice' ? <>Welcome to<br /><em>Platewise.</em></> : mode === 'signup' ? <>Create your<br /><em>workspace.</em></> : <>Good to see<br /><em>you again.</em></>}</h1><p>{mode === 'choice' ? 'Choose how you would like to continue. Your workspace starts empty, ready for your canteen’s own data.' : mode === 'signup' ? 'Set up your canteen profile to get started with your own workspace.' : 'Enter your details to open the dashboard preview.'}</p><div className="auth-promise"><ShieldCheck size={17} /><span>Your records belong to your canteen. Backend security and account authentication will be added in the next stage.</span></div></div>
    <section className="auth-card-wrap">
      {mode === 'choice' ? <div className="auth-choice-card">
        <div className="auth-card-heading"><div className="auth-card-symbol"><Sprout size={20} /></div><span>GET STARTED</span></div>
        <h2>How would you like to continue?</h2><p>Choose an option to enter your workspace.</p>
        <button className="auth-option auth-option-primary" onClick={() => setMode('signup')}><span className="auth-option-icon"><Building2 size={19} /></span><span><strong>Create a canteen account</strong><small>Set up a new Platewise workspace</small></span><ArrowUpRight size={18} /></button>
        <button className="auth-option" onClick={() => setMode('login')}><span className="auth-option-icon peach"><UserRound size={19} /></span><span><strong>Log in</strong><small>Continue to an existing workspace</small></span><ArrowUpRight size={18} /></button>
        <div className="auth-card-foot"><LockKeyhole size={14} /> Preview only — account services are not connected yet.</div>
      </div> : <div className="auth-form-card">
        <button className="auth-form-back" onClick={() => setMode('choice')}><ChevronRight size={15} /> All options</button>
        <div className="auth-form-heading"><div className="auth-card-symbol"><AuthIcon size={20} /></div><span>{mode === 'signup' ? 'NEW WORKSPACE' : 'WELCOME BACK'}</span></div>
        <h2>{mode === 'signup' ? 'Create your account' : 'Log in to Platewise'}</h2><p>{mode === 'signup' ? 'A few details to set up your canteen.' : 'Enter your email and password to continue.'}</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <>
            <label className="field"><span>Administrator name</span><div className="auth-input-wrap"><UserRound size={16} /><input value={form.admin} onChange={(e) => update('admin', e.target.value)} placeholder="Your full name" required /></div></label>
            <label className="field"><span>Canteen name</span><div className="auth-input-wrap"><Building2 size={16} /><input value={form.canteen} onChange={(e) => update('canteen', e.target.value)} placeholder="e.g. Main Canteen" required /></div></label>
            <label className="field"><span>Location <small>(optional)</small></span><div className="auth-input-wrap"><Sprout size={16} /><input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="City, state" /></div></label>
          </>}
          <label className="field"><span>Email address</span><div className="auth-input-wrap"><Mail size={16} /><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" required /></div></label>
          <label className="field"><span>Password</span><div className="auth-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Enter password" required minLength={4} /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <div className="inline-error"><AlertCircle size={15} />{error}</div>}
          <button type="submit" className="auth-submit">{mode === 'signup' ? 'Create workspace preview' : 'Continue to dashboard'} <ArrowRight size={16} /></button>
        </form>
        <div className="auth-card-foot"><LockKeyhole size={14} /> This form does not create or verify a real account yet.</div>
      </div>}
    </section>
  </main>;
}

function Overview({ records, foods, go }) {
  const prepared = records.reduce((sum, row) => sum + Number(row.prepared || 0), 0);
  const consumed = records.reduce((sum, row) => sum + Number(row.consumed || 0), 0);
  const remaining = records.reduce((sum, row) => sum + Math.max(0, Number(row.prepared || 0) - Number(row.consumed || 0)), 0);
  const discarded = records.reduce((sum, row) => sum + Number(row.discarded || 0), 0);
  const hasRecords = records.length > 0;
  const cards = [
    { label: 'Total prepared', value: hasRecords ? fmt(prepared) : '—', unit: 'portions', icon: Utensils, tone: 'olive' },
    { label: 'Total consumed', value: hasRecords ? fmt(consumed) : '—', unit: 'portions', icon: CheckCircle2, tone: 'green' },
    { label: 'Food remaining', value: hasRecords ? fmt(remaining) : '—', unit: 'portions', icon: Package, tone: 'peach' },
    { label: 'Discarded food', value: hasRecords ? fmt(discarded) : '—', unit: 'portions', icon: Leaf, tone: 'sand' },
  ];
  const daily = Object.values(records.reduce((acc, row) => {
    const key = row.date;
    if (!acc[key]) acc[key] = { dateKey: key, day: new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), prepared: 0, consumed: 0 };
    acc[key].prepared += Number(row.prepared || 0);
    acc[key].consumed += Number(row.consumed || 0);
    return acc;
  }, {})).sort((a, b) => a.dateKey.localeCompare(b.dateKey)).slice(-7);
  const itemTotals = Object.values(records.reduce((acc, row) => {
    if (!acc[row.food]) acc[row.food] = { name: row.food, consumed: 0 };
    acc[row.food].consumed += Number(row.consumed || 0);
    return acc;
  }, {})).sort((a, b) => b.consumed - a.consumed).slice(0, 4);

  return <>
    <div className="notice-banner"><div className="notice-symbol"><Sprout size={17} /></div><div><strong>{hasRecords || foods.length ? 'Your workspace is taking shape' : 'Your workspace is ready for its first entries'}</strong><span>{hasRecords || foods.length ? 'Your canteen information will appear here as you add and update records.' : 'Add your menu or upload historical data to begin. Nothing has been pre-filled.'}</span></div><button onClick={() => go(foods.length ? 'data' : 'foods')}>{foods.length ? 'Upload data' : 'Add food items'} <ArrowRight size={14} /></button></div>
    <div className="section-head"><div><h2>Activity summary</h2><p>Totals are calculated only from records you enter.</p></div><span className="live-label"><i /> {hasRecords ? 'YOUR RECORDS' : 'AWAITING DATA'}</span></div>
    <div className="metric-grid">{cards.map((card) => { const Icon = card.icon; return <div className="metric-card" key={card.label}><div className="metric-top"><span>{card.label}</span><div className={`metric-icon ${card.tone}`}><Icon size={18} /></div></div><div className={`metric-value ${hasRecords ? '' : 'metric-empty'}`}>{card.value}<small>{card.unit}</small></div><div className="metric-bottom"><span>{hasRecords ? 'From entered actual records' : 'No records added yet'}</span></div></div>; })}</div>
    <div className="dashboard-grid">
      <div className="panel demand-panel"><div className="panel-heading"><div><h3>Preparation vs. consumption</h3><p>Daily quantities from your actual records</p></div><span className="mini-period">{daily.length ? `${daily.length} dates` : 'No data'}</span></div>
        {daily.length ? <><div className="chart-legend"><span><i className="legend-prepared" /> Prepared</span><span><i className="legend-demand" /> Consumed</span></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#eee9df" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#99958a', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#99958a', fontSize: 10 }} /><Tooltip contentStyle={{ border: '1px solid #eee8dd', borderRadius: 12, fontSize: 11 }} /><Area type="monotone" dataKey="prepared" stroke="#d99a70" strokeWidth={2.5} fill="#d99a70" fillOpacity={0.08} /><Area type="monotone" dataKey="consumed" stroke="#7e8e58" strokeWidth={2.5} fill="#82915c" fillOpacity={0.13} /></AreaChart></ResponsiveContainer></div></> : <EmptyChart icon={BarChart3} title="Your activity chart will appear here" text="Add actual records to see preparation and consumption trends." />}
      </div>
      <div className="panel wastage-panel"><div className="panel-heading"><div><h3>Food remaining</h3><p>Prepared minus consumed</p></div><span className="mini-period">Calculated</span></div>
        {hasRecords ? <div className="overview-total"><strong>{fmt(remaining)}</strong><span>portions remaining across {records.length} record{records.length === 1 ? '' : 's'}</span><p>Discarded quantity is tracked separately from food remaining.</p></div> : <EmptyChart icon={Leaf} title="No wastage information yet" text="Remaining and discarded quantities will be summarized after you add actual records." />}
      </div>
    </div>
    <div className="bottom-grid">
      <div className="panel items-panel"><div className="panel-heading"><div><h3>Food items</h3><p>{foods.length ? 'Items in your canteen menu' : 'Your menu will appear here'}</p></div><button className="text-link" onClick={() => go('foods')}>Manage menu <ArrowRight size={14} /></button></div>
        {foods.length ? <div className="popular-list">{foods.slice(0, 5).map((food) => <div className="popular-row" key={food.id}><div className="food-emoji"><Utensils size={15} /></div><div className="popular-info"><div className="popular-name"><strong>{food.name}</strong><span>{food.category}</span></div></div><span className={`status-pill ${food.active ? 'status-active' : 'status-inactive'}`}><i />{food.active ? 'Active' : 'Inactive'}</span></div>)}</div> : <EmptyChart icon={Utensils} title="No food items added" text="Add the items your canteen prepares." action="Add a food item" onAction={() => go('foods')} />}
      </div>
      <div className="panel action-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Choose where to begin</p></div></div><button className="quick-action" onClick={() => go('foods')}><div className="quick-icon icon-data"><Utensils size={17} /></div><span><strong>Add food items</strong><small>Create your canteen menu</small></span><ArrowRight size={16} /></button><button className="quick-action" onClick={() => go('data')}><div className="quick-icon icon-record"><Upload size={17} /></div><span><strong>Upload historical data</strong><small>Preview a CSV or Excel dataset</small></span><ArrowRight size={16} /></button><button className="quick-action" onClick={() => go('records')}><div className="quick-icon icon-predict"><ClipboardList size={17} /></div><span><strong>Enter actual records</strong><small>Record prepared and consumed amounts</small></span><ArrowRight size={16} /></button></div>
    </div>
    <div className="data-disclaimer"><AlertCircle size={14} /><span>This workspace starts empty. Figures and charts will appear only after you enter your canteen's own data. Entries are currently held in this browser session and are not yet stored in a database.</span></div>
  </>;
}

function EmptyChart({ icon: Icon, title, text, action, onAction }) {
  return <div className="empty-chart"><span className="empty-chart-icon"><Icon size={23} /></span><strong>{title}</strong><p>{text}</p>{action && <button className="text-link" onClick={onAction}>{action} <ArrowRight size={13} /></button>}</div>;
}

function FoodsPage({ foods, allFoodsCount, search, setSearch, onEdit, onDelete, onAdd }) {
  const [category, setCategory] = useState('All categories');
  const rows = foods.filter((food) => category === 'All categories' || food.category === category);
  return <div className="panel page-panel"><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search food items..." /></div><select className="filter-select" value={category} onChange={(e) => setCategory(e.target.value)}><option>All categories</option><option>Breakfast</option><option>Lunch</option><option>Snacks</option><option>Dinner</option><option>Beverages</option></select><button className="btn btn-soft" onClick={() => { setSearch(''); setCategory('All categories'); }}><RefreshCw size={14} /> Reset</button></div>
    <div className="table-wrap"><table><thead><tr><th>FOOD ITEM</th><th>MEAL CATEGORY</th><th>UNIT</th><th>STATUS</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{rows.map((food) => <tr key={food.id}><td><div className="table-food"><div className="table-food-icon"><Utensils size={15} /></div><strong>{food.name}</strong></div></td><td><span className="category-pill">{food.category}</span></td><td>{food.unit}</td><td><span className={`status-pill ${food.active ? 'status-active' : 'status-inactive'}`}><i />{food.active ? 'Active' : 'Inactive'}</span></td><td><div className="row-actions"><button className="icon-btn" title="Edit" onClick={() => onEdit(food)}><Pencil size={15} /></button><button className="icon-btn danger-hover" title="Delete" onClick={() => onDelete(food.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>
      {rows.length === 0 && <div className="empty-state"><Utensils size={25} /><strong>{allFoodsCount ? 'No matching food items' : 'Your menu is empty'}</strong><span>{allFoodsCount ? 'Try a different search or category.' : 'Add the food items your canteen prepares to build your menu.'}</span>{!allFoodsCount && <button className="btn btn-primary" onClick={onAdd}><Plus size={15} /> Add your first food item</button>}</div>}
    </div><div className="table-bottom"><span>{allFoodsCount ? `Showing ${rows.length} of ${allFoodsCount} food items` : 'No food items added'}</span><span>Menu management <span className="footer-dot">·</span> Current session</span></div></div>;
}

function DataPage({ fileRef, parseFile, uploadName, uploadRows, uploadError, uploadFile, trainingStatus, trainingMessage, onTrain, clear }) {
  const [drag, setDrag] = useState(false);
  const columns = uploadRows.length ? Object.keys(uploadRows[0]) : [];
  return <div className="data-layout"><div className="panel upload-panel"><div className="panel-heading"><div><h3>Import historical records</h3><p>Choose a dataset from your canteen to preview its structure.</p></div><div className="file-type-icon"><FileSpreadsheet size={20} /></div></div>
    <div className={`drop-zone ${drag ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); if (trainingStatus !== 'loading') setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (trainingStatus !== 'loading') parseFile(e.dataTransfer.files?.[0]); }} onClick={() => trainingStatus !== 'loading' && fileRef.current?.click()} role="button" tabIndex={0} aria-disabled={trainingStatus === 'loading'} onKeyDown={(e) => e.key === 'Enter' && trainingStatus !== 'loading' && fileRef.current?.click()}><input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden disabled={trainingStatus === 'loading'} onChange={(e) => parseFile(e.target.files?.[0])} /><div className="upload-icon"><CloudUpload size={24} /></div><strong>Drop your dataset here, or <span>browse files</span></strong><p>Supported formats: CSV, XLSX, XLS · Excel uses the first sheet</p><button className="btn btn-soft" type="button" disabled={trainingStatus === 'loading'}><Upload size={14} /> Choose file</button></div>
    {uploadError && <div className="inline-error"><AlertCircle size={15} />{uploadError}</div>}
    {uploadName && uploadRows.length > 0 && <div className="uploaded-file"><div className="uploaded-file-icon"><FileSpreadsheet size={19} /></div><div className="uploaded-file-meta"><strong>{uploadName}</strong><span>{uploadRows.length.toLocaleString('en-IN')} rows · {columns.length} columns · Preview ready</span></div><button className="icon-btn" onClick={clear} title="Remove file" disabled={trainingStatus === 'loading'}><X size={17} /></button></div>}
    {uploadFile && <div className="training-actions"><button className="btn btn-primary" type="button" onClick={onTrain} disabled={trainingStatus === 'loading' || !uploadFile.name.toLowerCase().endsWith('.csv')} aria-busy={trainingStatus === 'loading'}>{trainingStatus === 'loading' ? <><Loader2 className="training-spinner" size={15} /> Training...</> : <>Train / Submit <ArrowRight size={15} /></>}</button>{!uploadFile.name.toLowerCase().endsWith('.csv') && <span className="training-note">Model training accepts CSV files only.</span>}</div>}
    {trainingMessage && <div className={`training-status training-${trainingStatus}`} role={trainingStatus === 'error' ? 'alert' : 'status'}>{trainingStatus === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}{trainingMessage}</div>}
    <div className="upload-hint"><Lightbulb size={16} /><div><strong>Suggested dataset fields</strong><p>Date, Food Item, Meal Type, Prepared Quantity, Sold / Consumed Quantity, Previous-day Sales, and Event. The final fields will be confirmed when the ML model is prepared.</p></div></div>
  </div><div className="panel schema-panel"><div className="panel-heading"><div><h3>Recommended data fields</h3><p>A suggested structure for your project</p></div></div><div className="schema-list">{[['Date','Date of food service'],['Food Item','Name of the food item'],['Meal Type','Breakfast, lunch, snacks, or dinner'],['Prepared Quantity','Quantity prepared'],['Sold / Consumed','Quantity consumed or sold'],['Previous-day Sales','Previous service-day quantity'],['Event','Special event or regular day']].map(([name, desc], index) => <div className="schema-row" key={name}><span className="schema-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{name}</strong><small>{desc}</small></div><span className="schema-required">Suggested</span></div>)}</div><div className="schema-foot"><AlertCircle size={14} /> CSV training sends the selected file to the model API; rows are previewed here.</div></div>
    {uploadRows.length > 0 && <div className="panel preview-panel"><div className="panel-heading"><div><h3>Dataset preview</h3><p>Showing the first 8 rows from {uploadName}</p></div><span className="preview-count">{uploadRows.length} rows</span></div><div className="table-wrap"><table className="preview-table"><thead><tr>{columns.slice(0, 8).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{uploadRows.slice(0, 8).map((row, index) => <tr key={index}>{columns.slice(0, 8).map((column) => <td key={column}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div></div>}
  </div>;
}

function PredictPage() {
  const [modelStatus, setModelStatus] = useState('loading');
  const [modelError, setModelError] = useState('');
  const [columns, setColumns] = useState([]);
  const [featureColumns, setFeatureColumns] = useState([]);
  const [targetColumn, setTargetColumn] = useState('');
  const [form, setForm] = useState({});
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('http://localhost:8000/models/test_canteen_1', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Could not check model status.');
        }
        if (!result.ready) {
          setModelStatus('missing');
          return;
        }
        setColumns(result.columns || []);
        setFeatureColumns(result.feature_columns || []);
        setTargetColumn(result.target_column || '');
        setModelStatus('ready');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setModelError(error.message || 'Could not check model status.');
        setModelStatus('error');
      });

    return () => controller.abort();
  }, []);

  const submitPrediction = async (event) => {
    event.preventDefault();
    setPredicting(true);
    setPrediction(null);
    setPredictionError('');

    try {
      const response = await fetch('http://localhost:8000/predict/test_canteen_1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: featureColumns.map((column) => Number(form[column])),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Could not generate a prediction.');
      }
      setPrediction(result.predicted_quantity);
    } catch (error) {
      setPredictionError(error.message || 'Could not generate a prediction.');
    } finally {
      setPredicting(false);
    }
  };

  const modelStatusLabel = {
    loading: 'Checking model...',
    ready: 'Model Ready',
    missing: 'Model Not Found',
    error: 'Model Status Unavailable',
  }[modelStatus];

  return <div className="predict-layout">
    <div className="panel predict-form-panel">
      <div className="panel-heading"><div><h3>Meal information</h3><p>Inputs are based on the saved model's feature columns.</p></div><span className={`step-count model-state-${modelStatus}`}>{modelStatusLabel}</span></div>
      {modelStatus === 'loading' && <div className="model-feedback" role="status"><Loader2 className="training-spinner" size={16} /> Checking saved model...</div>}
      {modelStatus === 'missing' && <div className="model-feedback model-feedback-warning" role="status"><AlertCircle size={16} /> No model is saved for test_canteen_1. Train a model before making predictions.</div>}
      {modelStatus === 'error' && <div className="model-feedback model-feedback-error" role="alert"><AlertCircle size={16} />{modelError}</div>}
      {modelStatus === 'ready' && <>
        <div className="saved-columns" aria-label="Saved model columns"><strong>Saved columns</strong><div>{columns.map((column) => <span className="column-chip" key={column}>{column}</span>)}</div>{targetColumn && <small>Prediction target: {targetColumn}</small>}</div>
        {featureColumns.length > 0 ? <form className="form-grid" onSubmit={submitPrediction}>
          {featureColumns.map((column) => <label className="field" key={column}><span>{column}</span><input type="number" step="any" required value={form[column] ?? ''} onChange={(event) => setForm((previous) => ({ ...previous, [column]: event.target.value }))} placeholder={`Enter ${column}`} /></label>)}
          <div className="form-note"><AlertCircle size={16} /><span>Enter a numeric value for each saved feature column.</span></div>
          <button className="btn btn-primary predict-submit" type="submit" disabled={predicting} aria-busy={predicting}>{predicting ? <><Loader2 className="training-spinner" size={15} /> Generating...</> : <><Sparkles size={16} /> Generate prediction <ArrowRight size={15} /></>}</button>
        </form> : <div className="model-feedback model-feedback-error" role="alert"><AlertCircle size={16} /> This saved model does not include feature column names, so its prediction form cannot be created.</div>}
      </>}
    </div>
    <div className="prediction-side">
      <div className="panel prediction-result"><div className="result-top"><span className="result-icon"><BrainCircuit size={19} /></span><span className="result-tag">LINEAR REGRESSION MODEL</span></div>
        {prediction !== null ? <><div className="result-kicker">PREDICTED QUANTITY</div><div className="result-number">{fmt(prediction)}</div>{targetColumn && <div className="result-food">Target: {targetColumn}</div>}</> : <div className="result-empty"><div className="empty-brain"><BrainCircuit size={29} /></div><strong>{predictionError ? 'Prediction failed' : 'Prediction will appear here'}</strong><p>{predictionError || 'Submit model inputs to see a demand estimate.'}</p></div>}
      </div>
      <div className={`model-note ${modelStatus === 'ready' ? 'model-note-ready' : ''}`}><div className="model-note-icon">{modelStatus === 'ready' ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}</div><div><strong>{modelStatusLabel}</strong><p>{modelStatus === 'ready' ? 'The saved model and its input columns are available for prediction.' : 'The prediction form unlocks when a saved model is found.'}</p></div></div>
    </div>
  </div>;
}

function RecordsPage({ records, search, setSearch, onAdd }) {
  const [filter, setFilter] = useState('All dates');
  const rows = records.filter((record) => filter === 'All dates' || (filter === 'Today' ? record.date === today : record.date !== today));
  return <div className="panel page-panel"><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by food, meal, or date..." /></div><select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All dates</option><option>Today</option><option>Previous days</option></select><span className="record-count"><ClipboardList size={14} />{rows.length} records</span></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>FOOD ITEM</th><th>MEAL</th><th className="align-right">PREPARED</th><th className="align-right">CONSUMED</th><th className="align-right">REMAINING</th><th className="align-right">DISCARDED</th></tr></thead><tbody>{rows.map((record) => <tr key={record.id}><td>{new Date(`${record.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><strong>{record.food}</strong></td><td><span className="category-pill">{record.meal}</span></td><td className="align-right">{fmt(record.prepared)}</td><td className="align-right">{fmt(record.consumed)}</td><td className="align-right"><strong>{fmt(Math.max(0, record.prepared - record.consumed))}</strong></td><td className="align-right"><span className="waste-number">{fmt(record.discarded)}</span></td></tr>)}</tbody></table>
    {rows.length === 0 && <div className="empty-state"><ClipboardList size={25} /><strong>{records.length ? 'No matching records' : 'No actual records yet'}</strong><span>{records.length ? 'Try another search or date filter.' : 'Add your first record after a meal has been served.'}</span>{!records.length && <button className="btn btn-primary" onClick={onAdd}><Plus size={15} /> Add actual record</button>}</div>}
  </div><div className="table-bottom"><span>Remaining = prepared − consumed</span><span>Discarded quantity is recorded separately.</span></div></div>;
}

function ReportsPage({ records }) {
  const daily = useMemo(() => {
    const grouped = records.reduce((acc, record) => {
      const key = record.date;
      if (!acc[key]) acc[key] = { date: key.slice(5), prepared: 0, consumed: 0, remaining: 0, discarded: 0 };
      acc[key].prepared += Number(record.prepared || 0);
      acc[key].consumed += Number(record.consumed || 0);
      acc[key].remaining += Math.max(0, Number(record.prepared || 0) - Number(record.consumed || 0));
      acc[key].discarded += Number(record.discarded || 0);
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);
  const totals = records.reduce((acc, record) => ({
    prepared: acc.prepared + Number(record.prepared || 0),
    consumed: acc.consumed + Number(record.consumed || 0),
    remaining: acc.remaining + Math.max(0, Number(record.prepared || 0) - Number(record.consumed || 0)),
    discarded: acc.discarded + Number(record.discarded || 0),
  }), { prepared: 0, consumed: 0, remaining: 0, discarded: 0 });
  const exportCsv = () => {
    if (!records.length) return;
    const csv = Papa.unparse(records.map(({ id, ...record }) => ({ ...record, remaining: Math.max(0, record.prepared - record.consumed) })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'platewise-actual-records.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  if (!records.length) return <div className="panel reports-empty-panel"><EmptyChart icon={BarChart3} title="Reports will appear when you have records" text="Add actual preparation and consumption records first. Platewise will calculate summaries and trends from those entries—there are no preloaded figures." /></div>;
  return <><div className="report-topline"><div className="report-filter-label"><CalendarDays size={15} /> Based on {records.length} record{records.length === 1 ? '' : 's'} in this session</div><button className="btn btn-soft" onClick={exportCsv}><Download size={15} /> Export CSV</button></div><div className="report-metrics"><ReportMetric label="Total prepared" value={totals.prepared} /><ReportMetric label="Total consumed" value={totals.consumed} /><ReportMetric label="Remaining" value={totals.remaining} /><ReportMetric label="Discarded" value={totals.discarded} /></div><div className="panel report-chart-panel"><div className="panel-heading"><div><h3>Preparation vs. consumption</h3><p>Daily quantities from your actual records</p></div></div><div className="chart-legend"><span><i className="legend-prepared" /> Prepared</span><span><i className="legend-demand" /> Consumed</span></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#eee9df" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#99958a', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#99958a', fontSize: 11 }} /><Tooltip contentStyle={{ border: '1px solid #eee8dd', borderRadius: 12, fontSize: 12 }} /><Bar dataKey="prepared" fill="#d99a70" radius={[5, 5, 0, 0]} barSize={23} /><Bar dataKey="consumed" fill="#82915c" radius={[5, 5, 0, 0]} barSize={23} /></BarChart></ResponsiveContainer></div></div><div className="data-disclaimer"><AlertCircle size={14} /><span>Reports use only records entered during this browser session. Database-backed history will be added with the backend.</span></div></>;
}
function ReportMetric({ label, value }) { return <div className="report-metric"><span>{label}</span><strong>{fmt(value)}</strong><small>portions</small></div>; }

function SettingsPage({ profile, setProfile, notify }) {
  const update = (key, value) => setProfile((prev) => ({ ...prev, [key]: value }));
  return <div className="settings-layout"><div className="panel settings-panel"><div className="panel-heading"><div><h3>Canteen profile</h3><p>Basic details associated with this preview workspace.</p></div><div className="settings-avatar"><Utensils size={21} /></div></div><div className="settings-form"><label className="field"><span>Canteen name</span><input value={profile.canteen} onChange={(e) => update('canteen', e.target.value)} placeholder="Enter canteen name" /></label><label className="field"><span>Administrator name</span><input value={profile.admin} onChange={(e) => update('admin', e.target.value)} placeholder="Enter your name" /></label><label className="field"><span>Email address</span><input type="email" value={profile.email} onChange={(e) => update('email', e.target.value)} placeholder="Enter email address" /></label><label className="field"><span>Location</span><input value={profile.location} onChange={(e) => update('location', e.target.value)} placeholder="City, state" /></label><div className="settings-actions"><button className="btn btn-primary" onClick={() => notify('Profile changes updated in this session.') }><Check size={15} /> Save changes</button></div></div></div><div className="panel preferences-panel"><div className="panel-heading"><div><h3>Workspace information</h3><p>Current frontend preview setup.</p></div></div><PreferenceRow title="Measurement unit" subtitle="Default unit for food quantities" value="Portions" /><PreferenceRow title="Dashboard theme" subtitle="Current visual appearance" value="Warm & natural" /><PreferenceRow title="Data storage" subtitle="Records are not saved to a database yet" value="Session only" /></div><div className="settings-footnote"><ShieldIcon /><span>Login, account security, and separate canteen data storage will be implemented when the backend is connected.</span></div></div>;
}
function PreferenceRow({ title, subtitle, value }) { return <div className="preference-row"><div><strong>{title}</strong><span>{subtitle}</span></div><span className="preference-value">{value}</span></div>; }
function ShieldIcon() { return <CheckCircle2 size={16} />; }

function FoodModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ ...initial });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return <Modal title={initial.id ? 'Edit food item' : 'Add food item'} subtitle="Add an item to your canteen menu." onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="modal-form"><label className="field"><span>Food item name</span><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Enter food item name" required autoFocus /></label><label className="field"><span>Meal category</span><select value={form.category} onChange={(e) => update('category', e.target.value)}><option>Breakfast</option><option>Lunch</option><option>Snacks</option><option>Dinner</option><option>Beverages</option></select></label><label className="field"><span>Quantity unit</span><select value={form.unit} onChange={(e) => update('unit', e.target.value)}><option>portions</option><option>plates</option><option>pieces</option><option>cups</option><option>kg</option></select></label><label className="toggle-field"><span><strong>Active menu item</strong><small>Make this item available for selection.</small></span><input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} /></label><div className="modal-actions"><button type="button" className="btn btn-soft" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit"><Check size={15} /> Save item</button></div></form></Modal>;
}

function RecordModal({ foods, onClose, onSave }) {
  const activeFoods = foods.filter((food) => food.active);
  const [form, setForm] = useState({ date: today, food: '', meal: '', prepared: '', consumed: '', discarded: '' });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const remaining = Math.max(0, Number(form.prepared || 0) - Number(form.consumed || 0));
  return <Modal title="Add actual record" subtitle="Record quantities after a meal has been served." onClose={onClose}><form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, prepared: Number(form.prepared), consumed: Number(form.consumed), discarded: Number(form.discarded || 0) }); }}><label className="field"><span>Service date</span><input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required /></label><label className="field"><span>Food item</span>{activeFoods.length ? <select value={form.food} onChange={(e) => update('food', e.target.value)} required><option value="">Select food item</option>{activeFoods.map((food) => <option key={food.id} value={food.name}>{food.name}</option>)}</select> : <input value={form.food} onChange={(e) => update('food', e.target.value)} placeholder="Enter food item name" required />}</label><label className="field"><span>Meal type</span><select value={form.meal} onChange={(e) => update('meal', e.target.value)} required><option value="">Select meal type</option><option>Breakfast</option><option>Lunch</option><option>Snacks</option><option>Dinner</option></select></label><div className="modal-two"><label className="field"><span>Prepared quantity</span><input type="number" min="0" value={form.prepared} onChange={(e) => update('prepared', e.target.value)} required /></label><label className="field"><span>Consumed / sold</span><input type="number" min="0" max={form.prepared || undefined} value={form.consumed} onChange={(e) => update('consumed', e.target.value)} required /></label></div><div className="remaining-preview"><span>Calculated remaining</span><strong>{fmt(remaining)} portions</strong></div><label className="field"><span>Discarded quantity <small>(optional)</small></span><input type="number" min="0" value={form.discarded} onChange={(e) => update('discarded', e.target.value)} placeholder="Enter quantity if known" /></label><div className="modal-actions"><button type="button" className="btn btn-soft" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit"><Check size={15} /> Save record</button></div></form></Modal>;
}
function Modal({ title, subtitle, onClose, children }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</div></div>; }

export default App;
