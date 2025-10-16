import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc); dayjs.extend(tz);

const els = {
  rows: document.getElementById("rows"),
  addChildBtn: document.getElementById("addChildBtn"),
  importCsvBtn: document.getElementById("importCsvBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  sendReceiptsBtn: document.getElementById("sendReceiptsBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  csvFileInput: document.getElementById("csvFileInput"),
  weekInput: document.getElementById("weekInput"),
  amountInput: document.getElementById("amountInput"),
  searchInput: document.getElementById("searchInput"),
  childDialog: document.getElementById("childDialog"),
  childForm: document.getElementById("childForm"),
  childDialogTitle: document.getElementById("childDialogTitle"),
  childName: document.getElementById("childName"),
  parentEmail: document.getElementById("parentEmail"),
  childAmount: document.getElementById("childAmount"),
  childWeek: document.getElementById("childWeek"),
  settingsDialog: document.getElementById("settingsDialog"),
  settingsForm: document.getElementById("settingsForm"),
  emailjsPublicKey: document.getElementById("emailjsPublicKey"),
  emailjsServiceId: document.getElementById("emailjsServiceId"),
  emailjsTemplatePaid: document.getElementById("emailjsTemplatePaid"),
  emailjsTemplateUnpaid: document.getElementById("emailjsTemplateUnpaid"),
  statusbar: document.getElementById("statusbar"),
};

const store = {
  get() { return JSON.parse(localStorage.getItem("children") || "[]"); },
  set(list) { localStorage.setItem("children", JSON.stringify(list)); },
  getSettings() {
    return JSON.parse(localStorage.getItem("emailSettings") || "{}");
  },
  setSettings(s) { localStorage.setItem("emailSettings", JSON.stringify(s)); }
};

let state = { children: store.get(), editingId: null, filter: "" };

function initEmail() {
  const s = store.getSettings();
  if (s.publicKey) {
    try { window.emailjs?.init(s.publicKey); } catch (e) {}
  }
}

function fmtAmount(v) { return (Number(v || 0)).toFixed(2); }
function nowDate() { return dayjs().format("YYYY-MM-DD"); }

function render() {
  const q = state.filter.trim().toLowerCase();
  els.rows.innerHTML = "";
  state.children
    .filter(c => !q || `${c.name} ${c.email}`.toLowerCase().includes(q))
    .forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.name}</td>
        <td>${c.email}</td>
        <td>£${fmtAmount(c.amount)}</td>
        <td>${c.week || ""}</td>
        <td>
          <label style="display:flex;gap:8px;align-items:center;">
            <input type="checkbox" ${c.paid ? "checked" : ""} data-id="${c.id}" class="paidToggle" />
            ${c.paid ? `<span class="badge success">Paid ${c.datePaid || ""}</span>` : `<span class="badge warn">Owes</span>`}
          </label>
        </td>
        <td>${c.receiptSent ? '<span class="badge muted">Sent</span>' : '<span class="badge">Pending</span>'}</td>
        <td class="actions">
          <button data-id="${c.id}" class="editBtn">Edit</button>
          <button data-id="${c.id}" class="deleteBtn">Delete</button>
        </td>
      `;
      els.rows.appendChild(tr);
    });

  els.statusbar.textContent = statusSummary();
}

function statusSummary() {
  const total = state.children.length;
  const paid = state.children.filter(c => c.paid).length;
  const owing = total - paid;
  const sent = state.children.filter(c => c.receiptSent).length;
  return `Total: ${total} • Paid: ${paid} • Owing: ${owing} • Receipts sent: ${sent}`;
}

function addChild(data) {
  const child = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    email: data.email.trim(),
    amount: Number(data.amount || els.amountInput.value || 0),
    week: data.week || els.weekInput.value || "",
    paid: false,
    datePaid: "",
    receiptSent: false,
  };
  state.children.push(child);
  store.set(state.children);
  render();
}

function updateChild(id, patch) {
  const i = state.children.findIndex(c => c.id === id);
  if (i >= 0) {
    state.children[i] = { ...state.children[i], ...patch };
    store.set(state.children);
    render();
  }
}

function deleteChild(id) {
  state.children = state.children.filter(c => c.id !== id);
  store.set(state.children);
  render();
}

function openChildDialog(child) {
  state.editingId = child?.id || null;
  els.childDialogTitle.textContent = child ? "Edit Child" : "Add Child";
  els.childName.value = child?.name || "";
  els.parentEmail.value = child?.email || "";
  els.childAmount.value = child?.amount ?? "";
  els.childWeek.value = child?.week || els.weekInput.value || "";
  els.childDialog.showModal();
}

function bindEvents() {
  els.addChildBtn.onclick = () => openChildDialog(null);
  els.childForm.onsubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: els.childName.value,
      email: els.parentEmail.value,
      amount: els.childAmount.value,
      week: els.childWeek.value
    };
    if (state.editingId) updateChild(state.editingId, payload);
    else addChild(payload);
    els.childDialog.close();
  };

  els.searchInput.oninput = () => { state.filter = els.searchInput.value; render(); };
  els.weekInput.oninput = () => {}; // stored per child
  els.amountInput.oninput = () => {}; // default used when adding

  els.importCsvBtn.onclick = () => els.csvFileInput.click();
  els.csvFileInput.onchange = handleImportCsv;
  els.exportCsvBtn.onclick = exportCsv;

  els.sendReceiptsBtn.onclick = sendAllReceipts;

  els.settingsBtn.onclick = () => {
    const s = store.getSettings();
    els.emailjsPublicKey.value = s.publicKey || "";
    els.emailjsServiceId.value = s.serviceId || "";
    els.emailjsTemplatePaid.value = s.templatePaid || "";
    els.emailjsTemplateUnpaid.value = s.templateUnpaid || "";
    els.settingsDialog.showModal();
  };

  els.settingsForm.onsubmit = (e) => {
    e.preventDefault();
    const s = {
      publicKey: els.emailjsPublicKey.value.trim(),
      serviceId: els.emailjsServiceId.value.trim(),
      templatePaid: els.emailjsTemplatePaid.value.trim(),
      templateUnpaid: els.emailjsTemplateUnpaid.value.trim(),
    };
    store.setSettings(s);
    els.settingsDialog.close();
    initEmail();
    toast("Settings saved.");
  };

  els.rows.addEventListener("click", (e) => {
    const t = e.target;
    if (t.classList.contains("editBtn")) {
      const id = t.dataset.id;
      const c = state.children.find(x => x.id === id);
      openChildDialog(c);
    } else if (t.classList.contains("deleteBtn")) {
      const id = t.dataset.id;
      deleteChild(id);
    }
  });

  els.rows.addEventListener("change", (e) => {
    const t = e.target;
    if (t.classList.contains("paidToggle")) {
      const id = t.dataset.id;
      const checked = t.checked;
      updateChild(id, { paid: checked, datePaid: checked ? nowDate() : "", receiptSent: false });
    }
  });
}

function toast(msg) {
  els.statusbar.textContent = msg;
  setTimeout(() => els.statusbar.textContent = statusSummary(), 2500);
}

function csvToRows(text) {
  // expects headers: child,parent_email,amount,week
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = lines.shift().split(",").map(h => h.trim().toLowerCase());
  const hi = (k) => headers.indexOf(k);
  const out = [];
  for (const line of lines) {
    const cols = line.split(",");
    out.push({
      name: cols[hi("child")]?.trim() || "",
      email: cols[hi("parent_email")]?.trim() || "",
      amount: cols[hi("amount")]?.trim() || "",
      week: cols[hi("week")]?.trim() || ""
    });
  }
  return out.filter(r => r.name && r.email);
}

function handleImportCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = csvToRows(String(reader.result));
      rows.forEach(addChild);
      toast(`Imported ${rows.length} records.`);
    } catch (err) {
      toast("Failed to import CSV.");
    } finally {
      els.csvFileInput.value = "";
    }
  };
  reader.readAsText(file);
}

function exportCsv() {
  const headers = ["child","parent_email","amount","week","paid","date_paid","receipt_sent"];
  const lines = [headers.join(",")];
  state.children.forEach(c => {
    lines.push([
      safeCsv(c.name),
      safeCsv(c.email),
      fmtAmount(c.amount),
      safeCsv(c.week || ""),
      c.paid ? "yes" : "no",
      safeCsv(c.datePaid || ""),
      c.receiptSent ? "yes" : "no"
    ].join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `weekly_payments_${nowDate()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function safeCsv(v) {
  const s = String(v ?? "");
  return s.includes(",") ? `"${s.replace(/"/g,'""')}"` : s;
}

async function sendAllReceipts() {
  const s = store.getSettings();
  if (!s.publicKey || !s.serviceId || !s.templatePaid || !s.templateUnpaid) {
    toast("Configure EmailJS settings first.");
    return;
  }
  initEmail();

  const toSend = state.children.filter(c => (c.paid || !c.paid) && !c.receiptSent);
  if (!toSend.length) { toast("No pending receipts."); return; }

  let sentCount = 0, failCount = 0;
  for (const c of toSend) {
    const params = {
      childName: c.name,
      parentEmail: c.email,
      amount: fmtAmount(c.amount),
      week: c.week || els.weekInput.value || "",
      datePaid: c.datePaid || nowDate()
    };
    const templateId = c.paid ? s.templatePaid : s.templateUnpaid;
    try {
      await window.emailjs.send(s.serviceId, templateId, params);
      updateChild(c.id, { receiptSent: true });
      sentCount++;
    } catch (err) {
      failCount++;
    }
  }
  toast(`Receipts sent: ${sentCount} • Failed: ${failCount}`);
}

function loadInitial() {
  // Demo data if empty
  if (state.children.length === 0) {
    state.children = [
      { id: crypto.randomUUID(), name: "Ava Johnson", email: "parent1@example.com", amount: 25, week: "", paid: false, datePaid: "", receiptSent: false },
      { id: crypto.randomUUID(), name: "Liam Smith", email: "parent2@example.com", amount: 25, week: "", paid: true, datePaid: nowDate(), receiptSent: false }
    ];
    store.set(state.children);
  }
}

loadInitial();
bindEvents();
initEmail();
render();

