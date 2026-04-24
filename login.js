let currentTab = 'login';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('field-name').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('btn-text').textContent = tab === 'login' ? 'Access Mission Board' : 'Create Account';
  hideError();
}

function togglePass() {
  const inp = document.getElementById('password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; el.style.display = 'block';
}
function hideError() {
  document.getElementById('error-msg').style.display = 'none';
}

function handleAuth(e) {
  e.preventDefault();
  hideError();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (currentTab === 'signup') {
    const name = document.getElementById('name').value.trim();
    if (!name) return showError('Display name is required.');
    if (password.length < 6) return showError('Password must be at least 6 characters.');

    const users = JSON.parse(localStorage.getItem('nexus_users') || '{}');
    if (users[email]) return showError('Account already exists. Please login.');

    users[email] = { name, password, xp: 0, level: 1, streak: 0, tasks: [] };
    localStorage.setItem('nexus_users', JSON.stringify(users));
    localStorage.setItem('nexus_user', email);
    redirect();
  } else {
    const users = JSON.parse(localStorage.getItem('nexus_users') || '{}');
    const user = users[email];
    if (!user) return showError('No account found. Please sign up.');
    if (user.password !== password) return showError('Incorrect password.');
    localStorage.setItem('nexus_user', email);
    redirect();
  }
}

function guestLogin() {
  const guestEmail = 'guest@nexus.io';
  const users = JSON.parse(localStorage.getItem('nexus_users') || '{}');
  if (!users[guestEmail]) {
    users[guestEmail] = { name: 'Agent X', password: '', xp: 120, level: 2, streak: 3, tasks: [
      { id: 1, text: 'Complete onboarding mission', done: true, priority: 'high', xp: 50, category: 'Personal' },
      { id: 2, text: 'Explore the mission board', done: false, priority: 'medium', xp: 30, category: 'Work' },
      { id: 3, text: 'Earn your first badge', done: false, priority: 'low', xp: 20, category: 'Personal' }
    ]};
    localStorage.setItem('nexus_users', JSON.stringify(users));
  }
  localStorage.setItem('nexus_user', guestEmail);
  redirect();
}

function redirect() {
  const btn = document.getElementById('auth-btn');
  btn.innerHTML = '<span>Launching...</span> <span class="btn-arrow">🚀</span>';
  btn.disabled = true;
  setTimeout(() => { window.location.href = 'app.html'; }, 700);
}