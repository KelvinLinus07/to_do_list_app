// ─────────────────────────────────────────────
//  NEXUS — app.js  (full working logic)
// ─────────────────────────────────────────────

const XP_MAP   = { low: 10, medium: 25, high: 50 };
const LEVELS   = [0,100,250,450,700,1000,1400,1900,2500,3200,4000];
const BADGES   = [
  { id:'first_blood',  icon:'⚡', label:'First Mission',  cond: u => u.tasks.filter(t=>t.done).length >= 1 },
  { id:'on_fire',      icon:'🔥', label:'On Fire',        cond: u => u.streak >= 3 },
  { id:'ten_done',     icon:'💎', label:'Diamond Hands',  cond: u => u.tasks.filter(t=>t.done).length >= 10 },
  { id:'speed_demon',  icon:'🚀', label:'Speed Demon',    cond: u => u.tasks.filter(t=>t.done).length >= 5 },
  { id:'high_roller',  icon:'👑', label:'High Roller',    cond: u => u.tasks.filter(t=>t.done && t.priority==='high').length >= 3 },
  { id:'grinder',      icon:'⚙️', label:'Grinder',        cond: u => u.tasks.filter(t=>t.done).length >= 25 },
  { id:'ai_user',      icon:'🤖', label:'AI Ally',        cond: u => u.usedAI },
];

const LEVEL_TITLES = ['Rookie','Agent','Specialist','Operative','Commander','Elite','Legend','Mythic','Titan','Apex','NEXUS God'];

let currentFilter   = 'all';
let currentCategory = 'all';
let aiHistory       = [];

// ── helpers ──────────────────────────────────
function getEmail()  { return localStorage.getItem('nexus_user'); }
function getUsers()  { return JSON.parse(localStorage.getItem('nexus_users') || '{}'); }
function saveUsers(u){ localStorage.setItem('nexus_users', JSON.stringify(u)); }
function getUser()   { const u = getUsers(); return u[getEmail()]; }

function saveUser(user) {
  const users = getUsers();
  users[getEmail()] = user;
  saveUsers(users);
}

function xpForLevel(lvl) { return LEVELS[Math.min(lvl, LEVELS.length-1)]; }
function nextXpForLevel(lvl) { return LEVELS[Math.min(lvl+1, LEVELS.length-1)]; }

// ── boot ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (!getEmail()) { window.location.href = 'login.html'; return; }

  // Set date
  document.getElementById('page-date').textContent =
    new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  renderAll();

  // AI welcome
  pushAIMsg('bot',
    "👋 Hey Commander! I'm your AI Mission Planner. Ask me to plan your day, suggest tasks for a project, break down a goal, or give productivity tips!");
});

// ── render everything ─────────────────────────
function renderAll() {
  const user = getUser();
  if (!user) { logout(); return; }

  renderProfile(user);
  renderXP(user);
  renderStats(user);
  renderBadges(user);
  renderTasks(user);
  renderProgress(user);
  checkBadges(user);
}

function renderProfile(user) {
  document.getElementById('user-avatar').textContent  = (user.name||'?')[0].toUpperCase();
  document.getElementById('profile-name').textContent = user.name || 'Agent';
  const lvl = user.level || 1;
  document.getElementById('profile-level').textContent =
    `Level ${lvl} · ${LEVEL_TITLES[Math.min(lvl-1, LEVEL_TITLES.length-1)]}`;
}

function renderXP(user) {
  const lvl    = user.level || 1;
  const xp     = user.xp   || 0;
  const base   = xpForLevel(lvl);
  const target = nextXpForLevel(lvl);
  const pct    = Math.min(100, ((xp - base) / (target - base)) * 100).toFixed(1);

  document.getElementById('xp-bar').style.width   = pct + '%';
  document.getElementById('xp-numbers').textContent = `${xp} / ${target} XP`;
}

function renderStats(user) {
  const done = (user.tasks||[]).filter(t => t.done).length;
  document.getElementById('stat-done').textContent   = done;
  document.getElementById('stat-streak').textContent = (user.streak||0) + '🔥';
  document.getElementById('stat-total').textContent  = (user.tasks||[]).length;
}

function renderBadges(user) {
  const earned = user.badges || [];
  const grid   = document.getElementById('badges-grid');
  grid.innerHTML = earned.length
    ? earned.map(b => `<div class="badge-item">${b.icon} ${b.label}</div>`).join('')
    : '<div class="badge-empty">Complete tasks to earn badges!</div>';
}

function renderProgress(user) {
  const tasks  = filteredTasks(user);
  const total  = tasks.length;
  const done   = tasks.filter(t => t.done).length;
  const pct    = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progress-label').textContent = `${done} of ${total} missions complete`;
  document.getElementById('progress-pct').textContent   = pct + '%';
  document.getElementById('progress-fill').style.width  = pct + '%';
}

function filteredTasks(user) {
  let tasks = user.tasks || [];
  if (currentFilter === 'active') tasks = tasks.filter(t => !t.done);
  if (currentFilter === 'done')   tasks = tasks.filter(t => t.done);
  if (currentCategory !== 'all')  tasks = tasks.filter(t => t.category === currentCategory);
  return tasks;
}

function renderTasks(user) {
  const list   = document.getElementById('task-list');
  const empty  = document.getElementById('empty-state');
  const tasks  = filteredTasks(user);

  // clear old task items but keep empty-state
  [...list.querySelectorAll('.task-item')].forEach(el => el.remove());

  if (!tasks.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tasks.forEach(task => {
    const div = document.createElement('div');
    div.className = `task-item priority-${task.priority}${task.done ? ' done' : ''}`;
    div.setAttribute('data-id', task.id);
    div.innerHTML = `
      <button class="task-check" onclick="toggleTask(${task.id})" title="Complete task">
        ${task.done ? '✓' : ''}
      </button>
      <div class="task-body">
        <div class="task-text">${escHtml(task.text)}</div>
        <div class="task-meta">
          <span class="task-cat">${task.category}</span>
          <span class="task-xp">+${XP_MAP[task.priority]} XP</span>
          <span class="task-priority-badge priority-${task.priority}">${task.priority}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-btn delete" onclick="deleteTask(${task.id})" title="Delete">🗑</button>
      </div>
    `;
    list.appendChild(div);
  });
}

// ── add task ──────────────────────────────────
function addTask(text, priority, category) {
  const user = getUser();
  const txt  = text  || document.getElementById('task-input').value.trim();
  const pri  = priority || document.getElementById('task-priority').value;
  const cat  = category || document.getElementById('task-category').value;

  if (!txt) {
    document.getElementById('task-input').classList.add('shake');
    setTimeout(() => document.getElementById('task-input').classList.remove('shake'), 400);
    return;
  }

  const id = Date.now();
  user.tasks = user.tasks || [];
  user.tasks.unshift({ id, text: txt, done: false, priority: pri, category: cat, xp: XP_MAP[pri], createdAt: Date.now() });
  saveUser(user);

  document.getElementById('task-input').value = '';
  renderAll();
}

// ── toggle done ───────────────────────────────
function toggleTask(id) {
  const user  = getUser();
  const task  = user.tasks.find(t => t.id === id);
  if (!task) return;

  task.done = !task.done;

  if (task.done) {
    const xpGain   = XP_MAP[task.priority];
    user.xp        = (user.xp || 0) + xpGain;
    user.streak    = (user.streak || 0) + 1;

    // Level up check
    const oldLevel = user.level || 1;
    while ((user.level || 1) < LEVEL_TITLES.length && user.xp >= nextXpForLevel(user.level||1)) {
      user.level = (user.level || 1) + 1;
    }
    if ((user.level||1) > oldLevel) showLevelModal(user.level);

    showXPToast(`+${xpGain} XP · ${task.priority.toUpperCase()}`);
  } else {
    // Un-complete: deduct XP
    user.xp     = Math.max(0, (user.xp || 0) - XP_MAP[task.priority]);
    user.streak = Math.max(0, (user.streak || 0) - 1);
  }

  saveUser(user);
  renderAll();
}

// ── delete task ───────────────────────────────
function deleteTask(id) {
  const user  = getUser();
  user.tasks  = (user.tasks || []).filter(t => t.id !== id);
  saveUser(user);
  renderAll();
}

// ── filters ───────────────────────────────────
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAll();
}

function setCategory(c, btn) {
  currentCategory = c;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAll();
}

// ── keyboard shortcuts ────────────────────────
function taskKeydown(e) { if (e.key === 'Enter') addTask(); }

// ── XP toast ─────────────────────────────────
function showXPToast(msg) {
  const toast = document.getElementById('xp-toast');
  toast.textContent = '⚡ ' + msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Level Up Modal ────────────────────────────
function showLevelModal(level) {
  document.getElementById('modal-lvl-text').textContent =
    `You reached Level ${level} · ${LEVEL_TITLES[Math.min(level-1, LEVEL_TITLES.length-1)]}!`;

  const user   = getUser();
  const earned = user.badges || [];
  document.getElementById('modal-badge-list').innerHTML =
    earned.length ? earned.map(b => `<div class="badge-item">${b.icon} ${b.label}</div>`).join('') : '';

  document.getElementById('level-modal').style.display = 'flex';
}
function closeModal() {
  document.getElementById('level-modal').style.display = 'none';
}

// ── Badges ────────────────────────────────────
function checkBadges(user) {
  user.badges = user.badges || [];
  let changed = false;
  BADGES.forEach(badge => {
    if (!user.badges.find(b => b.id === badge.id) && badge.cond(user)) {
      user.badges.push({ id: badge.id, icon: badge.icon, label: badge.label });
      changed = true;
      setTimeout(() => showXPToast(`🏆 Badge: ${badge.label}`), 600);
    }
  });
  if (changed) { saveUser(user); renderBadges(user); }
}

// ── AI Planner (Anthropic API) ────────────────
function openAI() {
  document.getElementById('ai-modal').style.display = 'flex';
  document.getElementById('ai-input').focus();

  // Mark AI used
  const user = getUser();
  if (!user.usedAI) { user.usedAI = true; saveUser(user); checkBadges(getUser()); }
}
function closeAI() {
  document.getElementById('ai-modal').style.display = 'none';
}

function aiKeydown(e) { if (e.key === 'Enter') sendAI(); }

function pushAIMsg(role, text) {
  const chat = document.getElementById('ai-chat');
  const div  = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

async function sendAI() {
  const input = document.getElementById('ai-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  pushAIMsg('user', text);

  const user = getUser();
  const taskSummary = (user.tasks || [])
    .slice(0, 15)
    .map(t => `• [${t.done ? 'DONE' : 'PENDING'}] ${t.text} (${t.priority}, ${t.category})`)
    .join('\n') || 'No tasks yet.';

  // Build messages for API
  const systemPrompt = `You are NEXUS AI — a sharp, motivating task planner assistant inside a gamified productivity app. 
The user's name is ${user.name}. They are Level ${user.level||1} with ${user.xp||0} XP.
Their current tasks:\n${taskSummary}

You help users plan tasks, break goals into steps, give productivity advice, and suggest new tasks.
When suggesting tasks to add, list them clearly so the user can click to add them.
Use short, punchy, actionable responses. Add occasional ⚡🔥🚀 for energy. Keep responses concise (max 150 words).
If user asks to add a task, output it in this exact format on its own line: [ADD_TASK: <text> | <priority: low/medium/high> | <category: Work/Personal/Health/Learning>]`;

  // Keep last 8 exchanges for context
  aiHistory.push({ role: 'user', content: text });
  if (aiHistory.length > 16) aiHistory = aiHistory.slice(-16);

  const loadingDiv = pushAIMsg('bot', '⏳ Thinking...');
  loadingDiv.classList.add('loading');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: aiHistory
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data    = await res.json();
    const reply   = data.content?.map(c => c.text || '').join('') || '(no response)';

    loadingDiv.remove();

    // Parse [ADD_TASK: ...] markers
    const addPattern = /\[ADD_TASK:\s*(.+?)\s*\|\s*(low|medium|high)\s*\|\s*(Work|Personal|Health|Learning)\s*\]/gi;
    const cleanReply = reply.replace(addPattern, (_, taskText, pri, cat) => {
      return `\n➕ "${taskText}" — click to add →`;
    });

    const botDiv = pushAIMsg('bot', cleanReply.trim());

    // Add clickable buttons for suggested tasks
    let match;
    const re2 = /\[ADD_TASK:\s*(.+?)\s*\|\s*(low|medium|high)\s*\|\s*(Work|Personal|Health|Learning)\s*\]/gi;
    while ((match = re2.exec(reply)) !== null) {
      const [, taskText, pri, cat] = match;
      const btn = document.createElement('button');
      btn.className   = 'ai-add-task-btn';
      btn.textContent = `+ Add: "${taskText}"`;
      btn.onclick     = () => {
        addTask(taskText, pri, cat);
        btn.textContent = '✓ Added!';
        btn.disabled    = true;
        showXPToast(`Task added via AI! +${XP_MAP[pri]} XP`);
      };
      botDiv.appendChild(btn);
    }

    aiHistory.push({ role: 'assistant', content: reply });

  } catch (err) {
    loadingDiv.remove();
    pushAIMsg('bot', `⚠️ Error: ${err.message}. Check your network or API key setup.`);
    console.error('AI error:', err);
  }
}

// ── Sidebar toggle ─────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Click outside sidebar to close on mobile
document.addEventListener('click', e => {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.querySelector('.hamburger');
  if (window.innerWidth <= 768 &&
      sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      e.target !== hamburger) {
    sidebar.classList.remove('open');
  }
});

// ── logout ────────────────────────────────────
function logout() {
  localStorage.removeItem('nexus_user');
  window.location.href = 'login.html';
}

// ── utils ─────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}