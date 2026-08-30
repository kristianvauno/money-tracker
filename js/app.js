(() => {
  const DEFAULT_CATEGORIES = [
    { id: "food", name: "Food", emoji: "🍜" },
    { id: "transport", name: "Transport", emoji: "🛵" },
    { id: "bills", name: "Bills", emoji: "💡" },
    { id: "shopping", name: "Shopping", emoji: "🛍️" },
    { id: "health", name: "Health", emoji: "💊" },
    { id: "fun", name: "Fun", emoji: "🎬" },
    { id: "work", name: "Work", emoji: "💼" },
    { id: "other", name: "Other", emoji: "📦" },
  ];

  const SYMBOL = { PHP: "₱", CAD: "$", USD: "$" };
  const LOCAL_KEY = "weekly-expense-tracker-v1";

  const els = {
    weekTitle: document.getElementById("week-title"),
    weekRange: document.getElementById("week-range"),
    weekPrev: document.getElementById("week-prev"),
    weekNext: document.getElementById("week-next"),
    weekToday: document.getElementById("week-today"),
    kpis: document.getElementById("kpis"),
    story: document.getElementById("story"),
    days: document.getElementById("days"),
    chips: document.getElementById("category-chips"),
    form: document.getElementById("expense-form"),
    formTitle: document.getElementById("form-title"),
    formHint: document.getElementById("form-hint"),
    editId: document.getElementById("edit-id"),
    amount: document.getElementById("amount"),
    date: document.getElementById("date"),
    payee: document.getElementById("payee"),
    note: document.getElementById("note"),
    receipt: document.getElementById("receipt"),
    receiptName: document.getElementById("receipt-name"),
    saveBtn: document.getElementById("save-btn"),
    cancelEdit: document.getElementById("cancel-edit"),
    currencyMark: document.getElementById("currency-mark"),
    list: document.getElementById("expense-list"),
    search: document.getElementById("search"),
    bars: document.getElementById("category-bars"),
    catCount: document.getElementById("cat-count"),
    history: document.getElementById("history"),
    settingsBtn: document.getElementById("settings-btn"),
    settingsDialog: document.getElementById("settings-dialog"),
    settingsForm: document.getElementById("settings-form"),
    closeSettings: document.getElementById("close-settings"),
    weeklyBudget: document.getElementById("weekly-budget"),
    currency: document.getElementById("currency"),
    weekStart: document.getElementById("week-start"),
    displayName: document.getElementById("display-name"),
    exportBtn: document.getElementById("export-btn"),
    confirmDialog: document.getElementById("confirm-dialog"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmText: document.getElementById("confirm-text"),
    toast: document.getElementById("toast"),
  };

  let data = emptyData();
  let viewMonday = startOfWeek(new Date(), 1);
  let selectedDay = isoDate(new Date());
  let selectedCategory = "food";
  let pendingReceipt = null;
  let filterDay = null;
  let query = "";

  function emptyData() {
    return {
      settings: {
        currency: "PHP",
        weekStartsOn: 1,
        weeklyBudget: 0,
        displayName: "",
      },
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      expenses: [],
    };
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : "e" + Date.now() + Math.random().toString(16).slice(2);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isoDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseISO(s) {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function startOfWeek(date, weekStartsOn) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    d.setDate(d.getDate() - diff);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function sameDay(a, b) {
    return isoDate(a) === isoDate(b);
  }

  function money(n, currency) {
    const cur = currency || data.settings.currency || "PHP";
    const amount = Number(n) || 0;
    try {
      const locale = cur === "PHP" ? "en-PH" : cur === "CAD" ? "en-CA" : "en-US";
      return new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return (SYMBOL[cur] || "") + amount.toFixed(2);
    }
  }

  function weekDays(monday) {
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }

  function inWeek(dateStr, monday) {
    const d = parseISO(dateStr);
    const end = addDays(monday, 7);
    return d >= monday && d < end;
  }

  function weekExpenses(monday) {
    return data.expenses.filter((e) => inWeek(e.date, monday));
  }

  function catById(id) {
    return data.categories.find((c) => c.id === id) || { id, name: id, emoji: "•" };
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), 2200);
  }

  async function load() {
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          data = normalize(json.data);
          persistLocal();
          return;
        }
      }
    } catch {
      /* file:// or server down — use local copy */
    }
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        data = normalize(JSON.parse(raw));
      } catch {
        data = emptyData();
      }
    }
  }

  function normalize(raw) {
    const base = emptyData();
    const settings = { ...base.settings, ...(raw.settings || {}) };
    settings.weekStartsOn = Number(settings.weekStartsOn) === 0 ? 0 : 1;
    settings.weeklyBudget = Number(settings.weeklyBudget) || 0;
    const categories = Array.isArray(raw.categories) && raw.categories.length
      ? raw.categories
      : base.categories;
    const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
    return { settings, categories, expenses };
  }

  function persistLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  }

  async function save() {
    persistLocal();
    try {
      await fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      /* still saved locally */
    }
  }

  async function uploadReceipt(file) {
    const res = await fetch("/api/upload?name=" + encodeURIComponent(file.name), {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error("upload failed");
    const json = await res.json();
    return json.file;
  }

  function renderChips() {
    els.chips.innerHTML = "";
    data.categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (selectedCategory === cat.id ? " active" : "");
      btn.textContent = cat.emoji + " " + cat.name;
      btn.addEventListener("click", () => {
        selectedCategory = cat.id;
        renderChips();
      });
      els.chips.appendChild(btn);
    });
  }

  function render() {
    const start = Number(data.settings.weekStartsOn) || 0;
    viewMonday = startOfWeek(viewMonday, start);
    const today = new Date();
    const thisMonday = startOfWeek(today, start);
    const days = weekDays(viewMonday);
    const items = weekExpenses(viewMonday);
    const spent = items.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const budget = Number(data.settings.weeklyBudget) || 0;
    const left = budget ? budget - spent : null;
    const dayIndex = Math.max(0, Math.min(6, Math.round((today - viewMonday) / 86400000)));
    const daysElapsed = sameDay(viewMonday, thisMonday) ? dayIndex + 1 : 7;
    const daysLeft = Math.max(0, 7 - daysElapsed);
    const avg = items.length ? spent / daysElapsed : 0;
    const isThisWeek = isoDate(viewMonday) === isoDate(thisMonday);

    els.weekTitle.textContent = isThisWeek ? "This week" : "Week of " + viewMonday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    els.weekRange.textContent =
      days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " – " +
      days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    els.currencyMark.textContent = SYMBOL[data.settings.currency] || data.settings.currency;

    const remainingClass = left == null ? "" : left < 0 ? "danger" : left / budget < 0.2 ? "warn" : "ok";
    els.kpis.innerHTML = [
      kpi("Spent this week", money(spent), items.length + " expense" + (items.length === 1 ? "" : "s")),
      kpi("Budget left", left == null ? "Set a budget" : money(left), budget ? "of " + money(budget) : "Open Settings to add one", remainingClass),
      kpi("Daily average", money(avg), daysElapsed + " day" + (daysElapsed === 1 ? "" : "s") + " so far"),
      kpi("Days left", String(isThisWeek ? daysLeft : 0), isThisWeek ? "in this week" : "viewing a past week"),
    ].join("");

    const byCat = {};
    items.forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
    });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const lastMonday = addDays(viewMonday, -7);
    const lastSpent = weekExpenses(lastMonday).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const vsLast = lastSpent ? spent - lastSpent : null;
    let story = items.length
      ? money(spent) + " across " + items.length + " expense" + (items.length === 1 ? "" : "s") + "."
      : "No expenses logged this week yet. Add the first one on the left.";
    if (topCat && spent) {
      const cat = catById(topCat[0]);
      story += " " + cat.name + " is " + Math.round((topCat[1] / spent) * 100) + "% of the week.";
    }
    if (left != null && items.length) {
      story += left >= 0 ? " " + money(left) + " left of this week’s budget." : " Over budget by " + money(Math.abs(left)) + ".";
    }
    if (vsLast != null && lastSpent) {
      story += vsLast >= 0
        ? " " + money(vsLast) + " more than last week."
        : " " + money(Math.abs(vsLast)) + " less than last week.";
    }
    els.story.textContent = story;

    els.days.innerHTML = days.map((d) => {
      const key = isoDate(d);
      const daySum = items.filter((e) => e.date === key).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const active = filterDay === key;
      const isToday = sameDay(d, today);
      return `<button type="button" class="day${active ? " active" : ""}${isToday ? " today" : ""}" data-day="${key}">
        <span class="dow">${d.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span class="dom">${d.getDate()}</span>
        <span class="sum">${daySum ? money(daySum) : "—"}</span>
      </button>`;
    }).join("");

    const visible = items
      .filter((e) => !filterDay || e.date === filterDay)
      .filter((e) => {
        if (!query) return true;
        const hay = (e.payee + " " + e.note + " " + catById(e.category).name).toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || "").localeCompare(a.createdAt || "")));

    if (!visible.length) {
      els.list.innerHTML = `<div class="empty">
        <h3>${items.length ? "No matches" : "This week is empty"}</h3>
        <p>${items.length ? "Try another search or tap a different day." : "Log food, load, fare, bills — whatever you spent. The week total updates as you go."}</p>
      </div>`;
    } else {
      els.list.innerHTML = visible.map((e) => {
        const cat = catById(e.category);
        const day = parseISO(e.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        const receipt = e.receipt && e.receipt.url
          ? `<a class="link-btn" href="${e.receipt.url}" target="_blank" rel="noopener">Receipt</a>`
          : "";
        return `<article class="row" data-id="${e.id}">
          <div class="when">${day}</div>
          <div>
            <div class="who">${escapeHtml(e.payee || cat.name)}</div>
            <div class="meta">${cat.emoji} ${escapeHtml(cat.name)}${e.note ? " · " + escapeHtml(e.note) : ""}</div>
          </div>
          <div>
            <div class="amt">${money(e.amount)}</div>
            <div class="row-actions">
              ${receipt}
              <button type="button" class="link-btn" data-edit="${e.id}">Edit</button>
              <button type="button" class="link-btn" data-del="${e.id}">Remove</button>
            </div>
          </div>
        </article>`;
      }).join("");
    }

    const maxCat = Math.max(1, ...Object.values(byCat), 0);
    const catRows = data.categories
      .map((c) => ({ ...c, total: byCat[c.id] || 0 }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
    els.catCount.textContent = catRows.length ? catRows.length + " categor" + (catRows.length === 1 ? "y" : "ies") : "No spend yet";
    els.bars.innerHTML = catRows.length
      ? catRows.map((c) => `<div class="bar-row">
          <div class="bar-top"><strong>${c.emoji} ${escapeHtml(c.name)}</strong><span>${money(c.total)}</span></div>
          <div class="track"><i style="width:${Math.round((c.total / maxCat) * 100)}%"></i></div>
        </div>`).join("")
      : `<p class="empty">Category bars show up after the first expense.</p>`;

    const hist = [];
    for (let i = 0; i < 8; i++) {
      const m = addDays(startOfWeek(today, start), -7 * i);
      const total = weekExpenses(m).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      hist.push({ monday: m, total, label: i === 0 ? "This week" : i === 1 ? "Last week" : m.toLocaleDateString(undefined, { month: "short", day: "numeric" }) });
    }
    const histMax = Math.max(1, ...hist.map((h) => h.total));
    els.history.innerHTML = hist.map((h) => `<div class="hist">
      <button type="button" data-week="${isoDate(h.monday)}">${h.label}</button>
      <strong>${h.total ? money(h.total) : "—"}</strong>
      <div class="mini"><i style="width:${Math.round((h.total / histMax) * 100)}%"></i></div>
    </div>`).join("");

    if (!els.date.value) els.date.value = selectedDay;
  }

  function kpi(label, value, sub, extra) {
    return `<article class="kpi ${extra || ""}"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></article>`;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function resetForm() {
    els.editId.value = "";
    els.formTitle.textContent = "Add expense";
    els.formHint.textContent = "Takes about 10 seconds";
    els.saveBtn.textContent = "Save expense";
    els.cancelEdit.classList.add("hidden");
    els.amount.value = "";
    els.payee.value = "";
    els.note.value = "";
    els.receipt.value = "";
    els.receiptName.textContent = "";
    pendingReceipt = null;
    els.date.value = filterDay || selectedDay || isoDate(new Date());
    selectedCategory = "food";
    renderChips();
  }

  function fillForm(exp) {
    els.editId.value = exp.id;
    els.formTitle.textContent = "Edit expense";
    els.formHint.textContent = "Update and save";
    els.saveBtn.textContent = "Save changes";
    els.cancelEdit.classList.remove("hidden");
    els.amount.value = exp.amount;
    els.payee.value = exp.payee || "";
    els.note.value = exp.note || "";
    els.date.value = exp.date;
    selectedCategory = exp.category || "other";
    pendingReceipt = exp.receipt || null;
    els.receiptName.textContent = pendingReceipt ? pendingReceipt.name : "";
    renderChips();
    els.amount.focus();
  }

  function confirmRemove() {
    return new Promise((resolve) => {
      const dialog = els.confirmDialog;
      const onClose = () => {
        dialog.removeEventListener("close", onClose);
        resolve(dialog.returnValue === "ok");
      };
      dialog.addEventListener("close", onClose);
      dialog.showModal();
    });
  }

  els.weekPrev.addEventListener("click", () => {
    viewMonday = addDays(viewMonday, -7);
    filterDay = null;
    render();
  });
  els.weekNext.addEventListener("click", () => {
    viewMonday = addDays(viewMonday, 7);
    filterDay = null;
    render();
  });
  els.weekToday.addEventListener("click", () => {
    viewMonday = startOfWeek(new Date(), Number(data.settings.weekStartsOn) || 0);
    selectedDay = isoDate(new Date());
    filterDay = null;
    els.date.value = selectedDay;
    render();
  });

  els.days.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-day]");
    if (!btn) return;
    selectedDay = btn.dataset.day;
    filterDay = filterDay === selectedDay ? null : selectedDay;
    els.date.value = selectedDay;
    render();
  });

  els.search.addEventListener("input", () => {
    query = els.search.value.trim().toLowerCase();
    render();
  });

  els.receipt.addEventListener("change", () => {
    const file = els.receipt.files && els.receipt.files[0];
    els.receiptName.textContent = file ? file.name : "";
  });

  els.cancelEdit.addEventListener("click", resetForm);

  els.form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const amount = Number(els.amount.value);
    if (!(amount > 0)) {
      toast("Enter an amount greater than 0.");
      els.amount.focus();
      return;
    }
    const date = els.date.value || isoDate(new Date());
    let receipt = pendingReceipt;
    const file = els.receipt.files && els.receipt.files[0];
    if (file) {
      try {
        receipt = await uploadReceipt(file);
      } catch {
        toast("Could not store the receipt file. Expense will still save.");
      }
    }
    const payload = {
      id: els.editId.value || uid(),
      amount,
      currency: data.settings.currency,
      date,
      category: selectedCategory || "other",
      payee: els.payee.value.trim(),
      note: els.note.value.trim(),
      receipt: receipt || null,
      createdAt: new Date().toISOString(),
    };
    const idx = data.expenses.findIndex((e) => e.id === payload.id);
    if (idx >= 0) {
      payload.createdAt = data.expenses[idx].createdAt || payload.createdAt;
      data.expenses[idx] = payload;
      toast("Expense updated.");
    } else {
      data.expenses.push(payload);
      toast("Expense saved to this week.");
    }
    viewMonday = startOfWeek(parseISO(date), Number(data.settings.weekStartsOn) || 0);
    await save();
    resetForm();
    els.date.value = date;
    selectedDay = date;
    render();
    els.amount.focus();
  });

  els.list.addEventListener("click", async (ev) => {
    const edit = ev.target.closest("[data-edit]");
    const del = ev.target.closest("[data-del]");
    if (edit) {
      const exp = data.expenses.find((e) => e.id === edit.dataset.edit);
      if (exp) fillForm(exp);
      return;
    }
    if (del) {
      const ok = await confirmRemove();
      if (!ok) return;
      data.expenses = data.expenses.filter((e) => e.id !== del.dataset.del);
      await save();
      toast("Expense removed.");
      resetForm();
      render();
    }
  });

  els.history.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-week]");
    if (!btn) return;
    viewMonday = parseISO(btn.dataset.week);
    filterDay = null;
    render();
  });

  els.settingsBtn.addEventListener("click", () => {
    els.weeklyBudget.value = data.settings.weeklyBudget || "";
    els.currency.value = data.settings.currency || "PHP";
    els.weekStart.value = String(data.settings.weekStartsOn ?? 1);
    els.displayName.value = data.settings.displayName || "";
    els.settingsDialog.showModal();
  });
  els.closeSettings.addEventListener("click", () => els.settingsDialog.close());
  els.settingsForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    data.settings.weeklyBudget = Number(els.weeklyBudget.value) || 0;
    data.settings.currency = els.currency.value;
    data.settings.weekStartsOn = Number(els.weekStart.value);
    data.settings.displayName = els.displayName.value.trim();
    viewMonday = startOfWeek(viewMonday, data.settings.weekStartsOn);
    await save();
    els.settingsDialog.close();
    render();
    toast("Settings saved.");
  });

  els.exportBtn.addEventListener("click", () => {
    const rows = [["Date", "Amount", "Currency", "Category", "Paid to", "Note"]];
    data.expenses
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((e) => {
        rows.push([e.date, e.amount, e.currency || data.settings.currency, catById(e.category).name, e.payee || "", e.note || ""]);
      });
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "weekly-expenses.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  (async function init() {
    await load();
    const start = Number(data.settings.weekStartsOn) || 0;
    viewMonday = startOfWeek(new Date(), start);
    selectedDay = isoDate(new Date());
    els.date.value = selectedDay;
    renderChips();
    render();
  })();
})();
