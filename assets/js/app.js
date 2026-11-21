const STORAGE_KEY = "rhea-hydration-v1";
const ACHIEVEMENTS = [
  { id: "first-sip", title: "Der erste Schluck", detail: "Trag dein erstes Getränk ein", icon: "⌁", test: state => state.drinks.length > 0 },
  { id: "goal-getter", title: "Tagesziel geschafft", detail: "Erreiche dein tägliches Trinkziel", icon: "✳", test: state => dayTotal(state, todayKey()) >= state.goal },
  { id: "three-day-flow", title: "Du bist im Flow", detail: "Erreiche dein Trinkziel an 3 Tagen in Folge", icon: "↗", test: state => currentStreak(state) >= 3 },
  { id: "week-of-care", title: "Eine Woche voller Fürsorge", detail: "Erreiche dein Trinkziel an 7 Tagen in Folge", icon: "♥", test: state => currentStreak(state) >= 7 },
];
const COMMUNITY_EXAMPLES = [
  { id: "example-lena", name: "Lena · Beispiel", initial: "L", tone: "", minutesAgo: 18, likes: 8, message: "Heute gleich morgens ein Glas Wasser getrunken. Ein richtig guter Start in den Tag! 💧" },
  { id: "example-sam", name: "Sam · Beispiel", initial: "S", tone: "blue", minutesAgo: 115, likes: 12, message: "Meine Trinkflasche ist jetzt immer dabei – kleine Erinnerung, großer Unterschied. 🌿" },
  { id: "example-mia", name: "Mia · Beispiel", initial: "M", tone: "peach", minutesAgo: 1380, likes: 5, message: "Heute eine neue Trink-Erinnerung ausprobiert. Es tut gut, zwischendurch kurz innezuhalten. ✨" },
];

function freshState() {
  return { goal: 2000, drinks: [], reminderEnabled: false, reminderFrequency: 60, flowerEnabled: true, earned: [], communityPosts: [], communityLikes: [], lastReminderAt: null };
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return freshState();
    return {
      ...freshState(),
      ...saved,
      goal: validNumber(saved.goal, 2000, 250, 6000),
      drinks: Array.isArray(saved.drinks) ? saved.drinks.filter(item =>
        item && typeof item.date === "string" && Number.isFinite(item.amount) && item.amount > 0 && typeof item.time === "string"
      ) : [],
      earned: Array.isArray(saved.earned) ? saved.earned.filter(id => ACHIEVEMENTS.some(item => item.id === id)) : [],
      communityPosts: Array.isArray(saved.communityPosts) ? saved.communityPosts.filter(post =>
        post && typeof post.id === "string" && typeof post.message === "string" && post.message.trim().length > 0 &&
        typeof post.createdAt === "string" && Number.isFinite(Date.parse(post.createdAt))
      ).slice(0, 100).map(post => ({
        id: post.id.slice(0, 80),
        message: post.message.trim().slice(0, 280),
        createdAt: post.createdAt,
        hydration: post.hydration && Number.isFinite(post.hydration.amount) && Number.isFinite(post.hydration.goal)
          ? { amount: validNumber(post.hydration.amount, 0, 0, 100000), goal: validNumber(post.hydration.goal, 2000, 250, 6000) }
          : null,
      })) : [],
      communityLikes: Array.isArray(saved.communityLikes) ? saved.communityLikes.filter(id => typeof id === "string").slice(0, 200) : [],
    };
  } catch (error) {
    console.error("Rhea-Daten konnten nicht geladen werden.", error);
    return freshState();
  }
}
function validNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
let state = loadState();
let reminderTimer = null;
let toastTimer = null;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Rhea-Daten konnten nicht gespeichert werden.", error);
    showToast("Änderungen konnten nicht gespeichert werden. Bitte prüfe den Browserspeicher.");
  }
}
function todayKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function dayTotal(data, key) {
  return data.drinks.filter(item => item.date === key).reduce((sum, item) => sum + item.amount, 0);
}
function formatAmount(amount) {
  return new Intl.NumberFormat("de-DE").format(amount);
}
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
function daysSince(key) {
  const date = new Date(`${key}T12:00:00`);
  const today = new Date(`${todayKey()}T12:00:00`);
  return Math.round((today - date) / 86400000);
}
function currentStreak(data = state) {
  let streak = 0;
  let offset = 0;
  if (dayTotal(data, todayKey()) < data.goal) offset = 1;
  while (dayTotal(data, todayKey(dateOffset(-offset))) >= data.goal) {
    streak++;
    offset++;
  }
  return streak;
}
function longestStreak(data = state) {
  const dates = [...new Set(data.drinks.map(item => item.date))].sort();
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const date of dates) {
    if (dayTotal(data, date) < data.goal) {
      run = 0;
    } else {
      const gap = previous ? daysBetween(previous, date) : 1;
      run = gap === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    previous = date;
  }
  return longest;
}
function daysBetween(first, second) {
  return Math.round((new Date(`${second}T12:00:00`) - new Date(`${first}T12:00:00`)) / 86400000);
}
function evaluateAchievements() {
  const earnedNow = ACHIEVEMENTS.filter(item => !state.earned.includes(item.id) && item.test(state));
  if (!earnedNow.length) return;
  state.earned.push(...earnedNow.map(item => item.id));
  saveState();
  earnedNow.forEach((item, index) => {
    window.setTimeout(() => {
      const toast = $("#achievement-toast");
      toast.textContent = `✳  Erfolg freigeschaltet: ${item.title}`;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 2800);
    }, index * 900);
  });
}
function render() {
  const key = todayKey();
  const total = dayTotal(state, key);
  const percent = Math.min(100, Math.round(total / state.goal * 100));
  const remaining = Math.max(0, state.goal - total);
  $("#total-litres").textContent = (total / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $("#progress-percent").textContent = `${percent}%`;
  $("#remaining-amount").textContent = `${formatAmount(remaining)} ml`;
  $("#goal-label").textContent = `Ziel: ${formatAmount(state.goal)} ml`;
  $("#progress-bar").style.width = `${percent}%`;
  $("#bottle-water-level").style.setProperty("--bottle-fill", `${percent * 0.34}%`);
  $("#progress-ring").style.background = `conic-gradient(var(--green) ${percent}%, #edf1e9 ${percent}% 100%)`;
  $("#progress-ring").setAttribute("aria-label", `${percent} Prozent deines täglichen Trinkziels`);
  $("#weekday-label").textContent = new Date().toLocaleDateString("de-DE", { weekday: "long" });
  $("#today-date").textContent = new Date().toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  $("#activity-date").textContent = new Date().toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  $("#goal-input").value = state.goal;
  renderTimeline();
  renderPlant(total, percent);
  renderStreak();
  renderInsights();
  renderCommunity();
  $("#flower-toggle").checked = state.flowerEnabled;
  $("#reminder-toggle").checked = state.reminderEnabled;
  $("#reminder-frequency").value = String(state.reminderFrequency);
}
function renderTimeline() {
  const items = state.drinks.filter(item => item.date === todayKey()).sort((a, b) => b.time.localeCompare(a.time));
  const timeline = $("#timeline");
  if (!items.length) {
    timeline.innerHTML = '<div class="empty-timeline"><span>◷</span><p>Dein erster Schluck erscheint hier.</p></div>';
    $("#last-drink-text").textContent = "Noch keine Getränke eingetragen";
    $("#undo-drink").hidden = true;
    return;
  }
  timeline.innerHTML = `<div class="timeline-list">${items.map(item => `<div class="timeline-item"><span class="timeline-glass">⌁</span><span class="timeline-copy"><strong>${escapeHtml(item.source === "bottle" ? "Schluck aus der Trinkflasche" : "Wasser")}</strong><span>${formatTime(item.time)}</span></span><span class="timeline-amount">+${formatAmount(item.amount)} ml</span></div>`).join("")}</div>`;
  const latest = items[0];
  $("#last-drink-text").textContent = `Zuletzt getrunken um ${formatTime(latest.time)} Uhr`;
  $("#undo-drink").hidden = false;
}
function renderPlant(total, percent) {
  const poppy = $("#poppy");
  const stage = $("#plant-stage");
  stage.hidden = !state.flowerEnabled;
  $$(".plant-message, .plant-footer").forEach(element => element.hidden = !state.flowerEnabled);
  if (!state.flowerEnabled) return;
  if (percent >= 100) {
    poppy.classList.remove("sad");
    poppy.classList.add("happy");
    $("#plant-status-pill").innerHTML = "<span>✿</span> In voller Blüte";
    $("#plant-status").textContent = "Poppy blüht auf!";
    $("#plant-message").textContent = "Du hast dein Ziel erreicht. Poppy ist stolz auf dich.";
    $("#plant-mood").textContent = "✿";
  } else if (percent >= 50) {
    poppy.classList.remove("sad");
    poppy.classList.add("happy");
    $("#plant-status-pill").innerHTML = "<span>✿</span> Wächst und gedeiht";
    $("#plant-status").textContent = "Poppy fühlt sich wohl";
    $("#plant-message").textContent = `Noch ${formatAmount(Math.max(0, state.goal - total))} ml bis sie aufblüht.`;
    $("#plant-mood").textContent = "☀";
  } else if (percent > 0) {
    poppy.classList.remove("happy");
    poppy.classList.add("sad");
    $("#plant-status-pill").innerHTML = "<span>✿</span> Freut sich über Pflege";
    $("#plant-status").textContent = "Poppy freut sich über einen Schluck";
    $("#plant-message").textContent = "Du hast angefangen! Ein bisschen Wasser muntert sie auf.";
    $("#plant-mood").textContent = "☁";
  } else {
    poppy.classList.remove("happy");
    poppy.classList.add("sad");
    $("#plant-status-pill").innerHTML = "<span>✿</span> Wartet aufs Aufblühen";
    $("#plant-status").textContent = "Poppy wird wach";
    $("#plant-message").textContent = "Ein paar Schlucke helfen deiner kleinen Blume beim Wachsen.";
    $("#plant-mood").textContent = "☁";
  }
}
function renderStreak() {
  const streak = currentStreak();
  $("#streak-count").textContent = streak;
  $("#streak-description").textContent = streak ? "Du findest deinen Rhythmus. Weiter so – ganz ohne Druck!" : "Erreiche dein Tagesziel und starte deine Serie. Du schaffst das!";
  const today = new Date().getDay();
  const mondayFirstToday = (today + 6) % 7;
  const names = ["M", "D", "M", "D", "F", "S", "S"];
  $("#week-dots").innerHTML = names.map((name, index) => {
    const offset = index - mondayFirstToday;
    const date = todayKey(dateOffset(offset));
    const done = dayTotal(state, date) >= state.goal;
    return `<div class="week-dot${done ? " done" : ""}${offset === 0 ? " today" : ""}"><span>${done ? "✓" : ""}</span>${name}</div>`;
  }).join("");
}
function renderInsights() {
  const dates = Array.from({ length: 7 }, (_, index) => todayKey(dateOffset(index - 6)));
  const totals = dates.map(date => dayTotal(state, date));
  const total = totals.reduce((sum, amount) => sum + amount, 0);
  $("#week-average").innerHTML = `${formatAmount(Math.round(total / 7))} <small>ml/Tag</small>`;
  $("#week-goal-days").innerHTML = `${totals.filter(amount => amount >= state.goal).length} <small>Tage</small>`;
  $("#longest-streak").innerHTML = `${longestStreak()} <small>Tage</small>`;
  $("#chart-goal-label").textContent = `Tagesziel · ${formatAmount(state.goal)} ml`;
  const chartMax = Math.max(state.goal * 1.25, ...totals, 1);
  $("#chart-max-label").textContent = `${formatAmount(Math.ceil(chartMax / 500) * 500)} ml`;
  $("#week-chart").innerHTML = dates.map((date, index) => {
    const amount = totals[index];
    const height = amount ? Math.max(2, Math.min(100, amount / chartMax * 100)) : 0;
    const label = new Date(`${date}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short" }).slice(0, 2);
    return `<div class="chart-day${index === 6 ? " today" : ""}"><span class="chart-day-value">${amount ? formatAmount(amount) : ""}</span><div class="chart-bar-track"><div class="chart-bar" style="height:${height}%"></div></div><span class="chart-day-label">${label}</span></div>`;
  }).join("");
  $("#achievements-list").innerHTML = ACHIEVEMENTS.map(item => {
    const earned = state.earned.includes(item.id);
    return `<div class="achievement-item${earned ? "" : " locked"}"><span class="achievement-medal">${earned ? item.icon : "·"}</span><span class="achievement-copy"><strong>${item.title}</strong><span>${item.detail}</span></span>${earned ? '<span class="achievement-check">✓</span>' : ""}</div>`;
  }).join("");
  $("#achievement-count").textContent = `${state.earned.length} erreicht`;
}
function relativePostTime(date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 1) return "Gerade eben";
  const relative = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return relative.format(days, "day");
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}
function renderCommunity() {
  const examples = COMMUNITY_EXAMPLES.map(post => ({
    ...post,
    createdAt: new Date(Date.now() - post.minutesAgo * 60000).toISOString(),
    hydration: null,
    example: true,
  }));
  const posts = [
    ...state.communityPosts.map(post => ({ ...post, name: "Jamie Parker", initial: "J", tone: "peach", likes: 0, example: false })),
    ...examples,
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  $("#community-feed").innerHTML = posts.map(post => {
    const liked = state.communityLikes.includes(post.id);
    const hydration = post.hydration
      ? `<div class="post-hydration"><span>💧</span> Heute ${formatAmount(post.hydration.amount)} ml getrunken · ${Math.min(100, Math.round(post.hydration.amount / post.hydration.goal * 100))}% des Tagesziels</div>`
      : "";
    return `<article class="card community-post"><div class="post-header"><span class="post-avatar ${post.tone}">${escapeHtml(post.initial)}</span><div class="post-author"><strong>${escapeHtml(post.name)}</strong><span>${relativePostTime(new Date(post.createdAt))}</span></div>${post.example ? '<span class="post-example">BEISPIEL</span>' : ""}</div><p class="post-copy">${escapeHtml(post.message)}</p>${hydration}<div class="post-actions"><button class="post-like" type="button" data-post-id="${escapeHtml(post.id)}" aria-pressed="${liked}" aria-label="${liked ? "Gefällt mir entfernen" : "Gefällt mir"}"><span>${liked ? "♥" : "♡"}</span><span>${post.likes + (liked ? 1 : 0)} Gefällt mir</span></button><span class="post-local-label">${post.example ? "Inspirationsbeitrag" : "Nur für dich sichtbar"}</span></div></article>`;
  }).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function logDrink(amount, source = "manual") {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 3000) {
    showToast("Bitte wähle eine Menge zwischen 1 und 3.000 ml.");
    return;
  }
  state.drinks.push({ amount: Math.round(amount), date: todayKey(), time: new Date().toISOString(), source });
  evaluateAchievements();
  saveState();
  render();
  showToast(`+${formatAmount(Math.round(amount))} ml eingetragen. Gut gemacht!`);
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}
function openDialog(id) {
  const dialog = $(id);
  if (!dialog.open) dialog.showModal();
}
function configureReminders() {
  if (reminderTimer) window.clearInterval(reminderTimer);
  reminderTimer = null;
  if (!state.reminderEnabled) return;
  reminderTimer = window.setInterval(() => {
    if (dayTotal(state, todayKey()) >= state.goal) return;
    if (document.visibilityState === "visible") showToast("Kleine Erinnerung: Gönn dir einen Schluck Wasser 💧");
    else if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Zeit für einen Schluck?", { body: "Deine Rhea-Erinnerung ist da. Jeder Schluck zählt." });
    } else {
      showToast("Kleine Erinnerung: Gönn dir einen Schluck Wasser.");
    }
  }, state.reminderFrequency * 60 * 1000);
}

$$(".nav-item[data-view]").forEach(button => button.addEventListener("click", () => {
  const view = button.dataset.view;
  $$(".nav-item[data-view]").forEach(item => item.classList.toggle("active", item === button));
  ["today", "insights", "community"].forEach(name => {
    const section = $(`#${name}-view`);
    section.hidden = view !== name;
    section.classList.toggle("active", view === name);
  });
  $("#page-breadcrumb").textContent = { today: "Heute", insights: "Einblicke", community: "Community" }[view];
}));
$("#community-message").addEventListener("input", event => {
  $("#community-char-count").textContent = `${event.target.value.length}/280`;
});
$("#community-form").addEventListener("submit", event => {
  event.preventDefault();
  const message = $("#community-message").value.trim();
  if (!message) {
    showToast("Schreib zuerst einen kleinen Beitrag.");
    $("#community-message").focus();
    return;
  }
  if (state.communityPosts.length >= 100) {
    showToast("Du hast das lokale Beitragslimit erreicht.");
    return;
  }
  const post = {
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: message.slice(0, 280),
    createdAt: new Date().toISOString(),
    hydration: $("#share-progress").checked ? { amount: dayTotal(state, todayKey()), goal: state.goal } : null,
  };
  state.communityPosts.unshift(post);
  saveState();
  renderCommunity();
  $("#community-message").value = "";
  $("#community-char-count").textContent = "0/280";
  $("#share-progress").checked = false;
  showToast("Dein Beitrag wurde in deinem Browser gespeichert.");
});
$("#community-feed").addEventListener("click", event => {
  const button = event.target.closest("[data-post-id]");
  if (!button) return;
  const postId = button.dataset.postId;
  state.communityLikes = state.communityLikes.includes(postId)
    ? state.communityLikes.filter(id => id !== postId)
    : [...state.communityLikes, postId].slice(-200);
  saveState();
  renderCommunity();
});
$$(".quick-add-button[data-amount]").forEach(button => button.addEventListener("click", () => logDrink(Number(button.dataset.amount))));
$("#custom-drink").addEventListener("click", () => {
  $("#custom-input").value = "";
  openDialog("#custom-modal");
  window.setTimeout(() => $("#custom-input").focus(), 0);
});
$("#custom-form").addEventListener("submit", event => {
  if (event.submitter?.id !== "save-custom") return;
  event.preventDefault();
  const amount = Number($("#custom-input").value);
  if (!$("#custom-input").reportValidity()) return;
  $("#custom-modal").close();
  logDrink(amount);
});
$("#edit-goal").addEventListener("click", () => openDialog("#goal-modal"));
$("#goal-form").addEventListener("submit", event => {
  if (event.submitter?.id !== "save-goal") return;
  event.preventDefault();
  if (!$("#goal-input").reportValidity()) return;
  state.goal = validNumber($("#goal-input").value, 2000, 250, 6000);
  evaluateAchievements();
  saveState();
  render();
  $("#goal-modal").close();
  showToast("Dein Tagesziel wurde aktualisiert.");
});
$("#open-settings").addEventListener("click", () => openDialog("#settings-modal"));
$("#open-settings-top").addEventListener("click", () => openDialog("#settings-modal"));
$("#settings-modal").addEventListener("close", () => configureReminders());
$("#save-settings").addEventListener("click", () => {
  state.reminderEnabled = $("#reminder-toggle").checked;
  state.reminderFrequency = Number($("#reminder-frequency").value);
  state.flowerEnabled = $("#flower-toggle").checked;
  saveState();
  render();
  configureReminders();
});
$("#reset-data").addEventListener("click", () => {
  if (!window.confirm("Möchtest du deinen Trinkverlauf, dein Tagesziel und deine Erfolge auf diesem Gerät wirklich zurücksetzen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return;
  state = freshState();
  saveState();
  render();
  configureReminders();
  $("#settings-modal").close();
  showToast("Deine Daten wurden zurückgesetzt.");
});
$("#undo-drink").addEventListener("click", () => {
  const items = state.drinks.filter(item => item.date === todayKey()).sort((a, b) => b.time.localeCompare(a.time));
  if (!items.length) return;
  const latest = items[0];
  state.drinks.splice(state.drinks.indexOf(latest), 1);
  state.earned = state.earned.filter(id => id !== "first-sip" || state.drinks.length > 0);
  saveState();
  render();
  showToast("Dein letzter Eintrag wurde entfernt.");
});
$("#bottle-sip").addEventListener("click", () => logDrink(250, "bottle"));
$("#plant-info").addEventListener("click", () => openDialog("#info-modal"));
$$(".modal").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));
window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY) return;
  state = loadState();
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    render();
    evaluateAchievements();
  }
});

evaluateAchievements();
render();
configureReminders();
