'use strict';

/* ===== Подключение к базе данных ===== */
const SUPABASE_URL = 'https://cupmxpxojzfjvrrcewxt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_naIbP5aOspgpJTmHnIQb8Q_U2JnNjeA';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ===== Настройки ===== */
const ADMIN_PASSWORD = 'NEON-ADMIN-777'; // пароль админ-панели (Ctrl+Shift+A)
const START_BALANCE = 100;

/* Секретные промокоды (видны только тебе — не свети их игрокам) */
const PROMO_CODES = {
  'f8k2qxp91m': 100,
  'tv7rd3nqz5': 500,
  'p2m8w4kh6z': 1000,
  'q9x4v7bn2r': 5000,
};

const CASES = [
  { name: 'Бронзовый кейс',   price: 15,   emoji: '🥉', color: '#cd7f32' },
  { name: 'Серебряный кейс',  price: 50,   emoji: '🥈', color: '#c0c0c0' },
  { name: 'Золотой кейс',     price: 70,   emoji: '🏆', color: '#ffd54a' },
  { name: 'Кристалл кейс',    price: 100,  emoji: '💎', color: '#00e5ff' },
  { name: 'Королевский кейс', price: 300,  emoji: '👑', color: '#ff2ec4' },
  { name: 'Огненный кейс',    price: 500,  emoji: '🔥', color: '#ff7a2e' },
  { name: 'Космический кейс', price: 1000, emoji: '🚀', color: '#7b2eff' },
  { name: 'Космо-Мега кейс',  price: 2500, emoji: '🌌', color: '#39ff8e' },
];

const DROPS = [
  { value: 500, weight: 32 }, { value: 700, weight: 26 },
  { value: 1000, weight: 20 }, { value: 5000, weight: 12 },
  { value: 10000, weight: 5 }, { value: 20000, weight: 3 },
  { value: 40000, weight: 1.4 }, { value: 50000, weight: 0.6 },
];

const SLOTS = [
  { title: '🍓 Клубнички', symbols: ['🍓','🍋','🍇','🍒','🔔','⭐'], lucky: '🍓' },
  { title: '🎰 777',       symbols: ['7️⃣','💎','🍀','🔔','⭐','👑'], lucky: '7️⃣' },
  { title: '🏴‍☠️ Пираты',  symbols: ['🏴‍☠️','⚓','💰','🦜','🗡️','💎'], lucky: '🏴‍☠️' },
];

/* ===== База данных ===== */
const DB = {
  async register(login, password) {
    const { data: exists } = await supa.from('players').select('id').eq('login', login);
    if (exists && exists.length) return { ok: false, error: 'Такой логин уже занят' };
    const { error } = await supa.from('players').insert({
      login, password, balance: START_BALANCE, used_promos: [],
    });
    return error ? { ok: false, error: 'Ошибка регистрации' } : { ok: true };
  },
  async login(login, password) {
    const { data, error } = await supa.from('players')
      .select('*').eq('login', login).eq('password', password);
    if (error || !data || !data.length) return { ok: false, error: 'Неверный логин или пароль' };
    return { ok: true, user: data[0] };
  },
  async get(login) {
    const { data } = await supa.from('players').select('*').eq('login', login);
    return data && data[0]
      ? { balance: data[0].balance, usedPromos: data[0].used_promos || [] } : null;
  },
  async save(login, data) {
    await supa.from('players')
      .update({ balance: Math.floor(data.balance), used_promos: data.usedPromos })
      .eq('login', login);
  },
  /* Функции для админ-панели */
  async list() {
    const { data } = await supa.from('players').select('*').order('login');
    return data || [];
  },
  async setBalance(login, balance) {
    await supa.from('players').update({ balance: Math.floor(balance) }).eq('login', login);
  },
  async remove(login) {
    await supa.from('players').delete().eq('login', login);
  },
};

/* ===== Состояние и помощники ===== */
let currentUser = null;
const $ = (id) => document.getElementById(id);

function showToast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function playWin() { $('winSound').currentTime = 0; $('winSound').play().catch(() => {}); }

function updateBalance(bump = false) {
  const el = $('balanceValue');
  el.textContent = Math.floor(currentUser.balance).toLocaleString('ru-RU');
  if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}

async function changeBalance(delta) {
  currentUser.balance = Math.max(0, currentUser.balance + delta);
  updateBalance(true);
  await DB.save(currentUser.login, currentUser);
}

/* ===== Дисклеймер ===== */
$('disclaimerAccept').addEventListener('click', () => {
  localStorage.setItem('neonCasinoDisclaimer', 'accepted');
  $('disclaimerModal').classList.add('hidden');
});
if (localStorage.getItem('neonCasinoDisclaimer') === 'accepted') {
  $('disclaimerModal').classList.add('hidden');
}

/* ===== Вход и регистрация ===== */
let authMode = 'login';
document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    authMode = tab.dataset.tab;
    $('authSubmit').textContent = authMode === 'login' ? 'Войти' : 'Зарегистрироваться';
    $('authError').textContent = '';
  });
});

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const login = $('authLogin').value.trim();
  const password = $('authPassword').value;
  const err = $('authError');
  if (login.length < 3) return err.textContent = 'Логин: минимум 3 символа';
  if (password.length < 4) return err.textContent = 'Пароль: минимум 4 символа';

  err.textContent = 'Подождите...';
  const result = authMode === 'login' ? await DB.login(login, password) : await DB.register(login, password);
  if (!result.ok) return err.textContent = result.error;

  const user = authMode === 'login' ? result.user : await DB.get(login);
  currentUser = { login, balance: user.balance, usedPromos: user.usedPromos || [] };
  err.textContent = '';
  enterApp();
});

async function enterApp() {
  $('authScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  const saved = await DB.get(currentUser.login);
  if (saved) { currentUser.balance = saved.balance; currentUser.usedPromos = saved.usedPromos || []; }
  updateBalance();
  renderCases();
  renderSlots();
}

$('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  $('app').classList.add('hidden');
  $('authScreen').classList.remove('hidden');
});

/* ===== Промокоды ===== */
$('promoBtn').addEventListener('click', async () => {
  const input = $('promoInput');
  const msg = $('promoMsg');
  const code = input.value.trim().toLowerCase();

  if (!PROMO_CODES[code]) { msg.textContent = '❌ Неверный промокод'; msg.className = 'promo-msg bad'; return; }
  if (currentUser.usedPromos.includes(code)) { msg.textContent = '⚠️ Этот код уже использован'; msg.className = 'promo-msg bad'; return; }

  currentUser.usedPromos.push(code);
  await changeBalance(PROMO_CODES[code]);
  msg.textContent = `✅ Код активирован: +${PROMO_CODES[code]} ₽`;
  msg.className = 'promo-msg ok';
  input.value = '';
  showToast(`Зачислено +${PROMO_CODES[code]} ₽`);
});

/* ===== Кейсы ===== */
function randomDrop() {
  const total = DROPS.reduce((s, d) => s + d.weight, 0);
  let r = Math.random() * total;
  for (const d of DROPS) { r -= d.weight; if (r <= 0) return d.value; }
  return DROPS[0].value;
}

function renderCases() {
  const grid = $('casesGrid');
  grid.innerHTML = '';
  CASES.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'case-card';
    card.innerHTML = `
      <div class="case-emoji">${c.emoji}</div>
      <div class="case-name" style="color:${c.color}">${c.name}</div>
      <div class="case-price">${c.price} ₽</div>
      <button class="btn btn-primary">Открыть за ${c.price} ₽</button>`;
    card.querySelector('button').addEventListener('click', () => openCase(c));
    grid.appendChild(card);
  });
}

function openCase(c) {
  if (currentUser.balance < c.price) return showToast('Недостаточно средств на балансе');

  changeBalance(-c.price);
  const prize = randomDrop();

  const reel = $('caseReel');
  const items = [];
  for (let i = 0; i < 40; i++) items.push(randomDrop());
  items.push(prize);

  reel.innerHTML = items.map((v, i) =>
    `<div class="reel-item${i === items.length - 1 ? ' win' : ''}">${v.toLocaleString('ru-RU')} ₽</div>`
  ).join('');

  $('caseModalTitle').textContent = `${c.emoji} ${c.name}`;
  $('caseResultText').textContent = '';
  $('caseModalClose').disabled = true;
  $('caseModal').classList.remove('hidden');

  requestAnimationFrame(() => {
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0)';
    void reel.offsetWidth;
    reel.style.transition = 'transform 4s cubic-bezier(.15,.85,.25,1)';
    reel.style.transform = `translateY(-${(items.length - 1) * 98}px)`;
  });

  setTimeout(() => {
    changeBalance(prize);
    playWin();
    $('caseResultText').textContent = `🎉 Выигрыш: ${prize.toLocaleString('ru-RU')} ₽!`;
    $('caseModalClose').disabled = false;
  }, 4100);
}

$('caseModalClose').addEventListener('click', () => $('caseModal').classList.add('hidden'));

/* ===== Слоты ===== */
function renderSlots() {
  const grid = $('slotsGrid');
  grid.innerHTML = '';
  SLOTS.forEach((slot) => {
    const card = document.createElement('div');
    card.className = 'slot-card';
    card.innerHTML = `
      <div class="slot-title">${slot.title}</div>
      <div class="slot-reels"><div class="reel">❔</div><div class="reel">❔</div><div class="reel">❔</div></div>
      <div class="slot-controls">
        <input type="number" min="1" placeholder="Ставка, ₽" value="10">
        <button class="btn btn-primary">Крутить</button>
      </div>
      <p class="slot-msg">Три в ряд — х3 · два в ряд — х1.5 · счастливый символ — возврат ставки</p>`;

    const reels = card.querySelectorAll('.reel');
    const btn = card.querySelector('button');
    const input = card.querySelector('input');
    const msg = card.querySelector('.slot-msg');

    btn.addEventListener('click', () => {
      const bet = Math.floor(Number(input.value));
      if (!bet || bet < 1) return showToast('Введите корректную ставку');
      if (bet > currentUser.balance) return showToast('Недостаточно средств на балансе');

      changeBalance(-bet);
      msg.className = 'slot-msg';
      msg.textContent = 'Крутим...';
      btn.disabled = true;

      const result = Array.from({ length: 3 }, () =>
        slot.symbols[Math.floor(Math.random() * slot.symbols.length)]);

      reels.forEach((r, i) => {
        r.classList.add('spin');
        const flicker = setInterval(() => {
          r.textContent = slot.symbols[Math.floor(Math.random() * slot.symbols.length)];
        }, 90);
        setTimeout(() => {
          clearInterval(flicker);
          r.classList.remove('spin');
          r.textContent = result[i];
          if (i === 2) finishSpin();
        }, 700 + i * 400);
      });

      function finishSpin() {
        btn.disabled = false;
        const [a, b, c] = result;
        let mult = 0;
        if (a === b && b === c) mult = a === slot.lucky ? 5 : 3;
        else if (a === b || b === c || a === c) mult = 1.5;
        else if (result.includes(slot.lucky)) mult = 1;

        if (mult > 1) {
          const win = Math.floor(bet * mult);
          changeBalance(win);
          playWin();
          msg.textContent = `🎉 Победа! +${win} ₽ (х${mult})`;
          msg.className = 'slot-msg win';
        } else if (mult === 1) {
          changeBalance(bet);
          msg.textContent = '🙂 Счастливый символ — ставка возвращена';
        } else {
          msg.textContent = `💀 Мимо! -${bet} ₽`;
          msg.className = 'slot-msg lose';
        }
      }
    });

    grid.appendChild(card);
  });
}

/* ===== Переключение разделов ===== */
document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $('casesSection').classList.toggle('hidden', tab.dataset.section !== 'cases');
    $('slotsSection').classList.toggle('hidden', tab.dataset.section !== 'slots');
  });
});

/* ===== АДМИН-ПАНЕЛЬ (Ctrl+Shift+A) ===== */
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'Ф')) {
    e.preventDefault();
    if (!$('adminModal').classList.contains('hidden')) return;
    const pass = prompt('Пароль администратора:');
    if (pass === ADMIN_PASSWORD) {
      $('adminModal').classList.remove('hidden');
      renderAdmin();
    } else if (pass !== null) {
      showToast('Неверный пароль админа');
    }
  }
});

async function renderAdmin() {
  const list = $('adminList');
  list.innerHTML = 'Загрузка...';
  const players = await DB.list();
  if (!players.length) { list.innerHTML = '<p style="color:var(--text-dim)">Игроков пока нет</p>'; return; }
  list.innerHTML = '';
  players.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <span class="adm-login" title="${p.login}">${p.login}</span>
      <span class="adm-pass" title="${p.password}">${p.password}</span>
      <span class="adm-bal">${Math.floor(p.balance).toLocaleString('ru-RU')} ₽</span>
      <span class="admin-actions">
        <button class="btn btn-gold" title="Изменить баланс">✏️</button>
        <button class="btn btn-primary" title="Выдать 10000">+10к</button>
        <button class="btn btn-danger" title="Удалить игрока">🗑</button>
      </span>`;
    row.querySelector('.btn-gold').addEventListener('click', async () => {
      const val = prompt(`Баланс игрока ${p.login} (сейчас ${p.balance}). Введи новое значение:`);
      if (val === null) return;
      const num = Number(val);
      if (isNaN(num) || num < 0) return showToast('Введите число от 0 и больше');
      await DB.setBalance(p.login, num);
      if (currentUser && currentUser.login === p.login) currentUser.balance = num;
      renderAdmin();
      showToast(`Баланс ${p.login} изменён`);
    });
    row.querySelector('.btn-primary').addEventListener('click', async () => {
      await DB.setBalance(p.login, Number(p.balance) + 10000);
      if (currentUser && currentUser.login === p.login) currentUser.balance += 10000;
      renderAdmin();
      showToast(`${p.login}: +10000 ₽`);
    });
    row.querySelector('.btn-danger').addEventListener('click', async () => {
      if (!confirm(`Удалить игрока ${p.login}?`)) return;
      await DB.remove(p.login);
      renderAdmin();
      showToast(`Игрок ${p.login} удалён`);
    });
    list.appendChild(row);
  });
}

$('adminClose').addEventListener('click', () => $('adminModal').classList.add('hidden'));

/* ===== Звук ===== */
let muted = localStorage.getItem('neonCasinoMuted') === '1';
const bgm = $('bgm');
function applyMute() { bgm.muted = muted; $('muteBtn').textContent = muted ? '🔇' : '🔊'; }
applyMute();

$('muteBtn').addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem('neonCasinoMuted', muted ? '1' : '0');
  applyMute();
  if (!muted) bgm.play().catch(() => showToast('Файл music.wav не найден'));
});
document.addEventListener('click', function startAudio() {
  if (!muted) bgm.play().catch(() => {});
  document.removeEventListener('click', startAudio);
});

