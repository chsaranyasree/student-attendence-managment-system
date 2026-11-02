const API = "/api";
const $ = (selector) => document.querySelector(selector);
const state = { students: [], attendance: {}, selectedDate: localDateString(), pendingDeleteId: null };

function localDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}
function showNotice(message, type = "success") {
  const notice = $("#notice");
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => { notice.hidden = true; }, 5000);
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}
function currentStatus(studentId) {
  return state.attendance[String(studentId)] || "";
}
function renderStudents() {
  const query = $("#student-search").value.trim().toLowerCase();
  const students = state.students.filter(s => s.name.toLowerCase().includes(query) || s.roll_number.toLowerCase().includes(query));
  const tbody = $("#student-table");
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">${state.students.length ? "No students match your search." : "No students yet. Add your first student below."}</td></tr>`;
  } else {
    tbody.innerHTML = students.map(student => {
      const status = currentStatus(student.id);
      return `<tr data-student-id="${student.id}">
        <td><div class="student-name"><span class="avatar">${escapeHtml(initials(student.name))}</span><span>${escapeHtml(student.name)}</span></div></td>
        <td><span class="roll">${escapeHtml(student.roll_number)}</span></td>
        <td><div class="status-control">
          <label class="status-option ${status === "present" ? "selected-present" : ""}"><input type="radio" name="status-${student.id}" value="present" ${status === "present" ? "checked" : ""}> Present</label>
          <label class="status-option ${status === "absent" ? "selected-absent" : ""}"><input type="radio" name="status-${student.id}" value="absent" ${status === "absent" ? "checked" : ""}> Absent</label>
          <button type="button" class="delete-btn" data-delete="${student.id}" aria-label="Delete ${escapeHtml(student.name)}" title="Delete student">✕</button>
        </div></td></tr>`;
    }).join("");
  }
  $("#visible-count").textContent = `${students.length} of ${state.students.length} students shown`;
  renderSummary();
}
function renderSummary() {
  const total = state.students.length;
  const statuses = state.students.map(s => currentStatus(s.id));
  const present = statuses.filter(s => s === "present").length;
  const absent = statuses.filter(s => s === "absent").length;
  const marked = present + absent;
  $("#total-students").textContent = total;
  $("#present-count").textContent = present;
  $("#absent-count").textContent = absent;
  $("#present-percent").textContent = marked ? `${Math.round(present / marked * 100)}% of marked attendance` : "No attendance marked yet";
  $("#report-present").textContent = present;
  $("#report-absent").textContent = absent;
  $("#report-unmarked").textContent = total - marked;
  $("#attendance-progress").style.width = `${total ? present / total * 100 : 0}%`;
  $("#report-caption").textContent = total ? `${marked} of ${total} students have a saved status for this date.` : "Add students to begin taking attendance.";
}
async function loadAttendance() {
  const data = await request(`/attendance?date=${encodeURIComponent(state.selectedDate)}`);
  state.attendance = {};
  for (const record of data.attendance) state.attendance[String(record.student_id)] = record.status;
}
async function loadAll() {
  $("#attendance-date").value = state.selectedDate;
  $("#today-label").textContent = new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  try {
    const health = await request("/health");
    $("#connection-label").textContent = health.database === "connected" ? "Database connected" : "Server online";
    $(".connection-dot").style.background = health.database === "connected" ? "#24a879" : "#e6a044";
    const data = await request("/students");
    state.students = data.students;
    await loadAttendance();
    renderStudents();
  } catch (error) {
    $("#connection-label").textContent = "Connection issue";
    $(".connection-dot").style.background = "#d94f4f";
    $("#student-table").innerHTML = `<tr><td colspan="3" class="empty">${escapeHtml(error.message)}<br><br>Check that the server is running and Supabase is configured.</td></tr>`;
    showNotice(error.message, "error");
  }
}
$("#student-search").addEventListener("input", renderStudents);
$("#attendance-date").addEventListener("change", async event => {
  state.selectedDate = event.target.value || localDateString();
  $("#today-label").textContent = new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  try { await loadAttendance(); renderStudents(); }
  catch (error) { showNotice(error.message, "error"); }
});
$("#student-table").addEventListener("change", event => {
  const input = event.target;
  if (input.matches('input[type="radio"]')) {
    const id = input.name.replace("status-", "");
    state.attendance[id] = input.value;
    renderStudents();
  }
});
$("#mark-all-present").addEventListener("click", () => {
  state.students.forEach(student => { state.attendance[String(student.id)] = "present"; });
  renderStudents();
  showNotice("All students are marked present in this form. Select Save attendance to store the changes.");
});
$("#save-attendance").addEventListener("click", async () => {
  const missing = state.students.filter(s => !currentStatus(s.id));
  if (missing.length) { showNotice(`Please mark attendance for every student. ${missing.length} student(s) are unmarked.`, "error"); return; }
  const button = $("#save-attendance");
  button.disabled = true; button.textContent = "Saving…";
  try {
    await request("/attendance/bulk", { method: "PUT", body: JSON.stringify({
      date: state.selectedDate,
      records: state.students.map(student => ({ studentId: student.id, status: currentStatus(student.id) }))
    }) });
    showNotice("Attendance saved successfully to Supabase.");
    await loadAttendance(); renderStudents();
  } catch (error) { showNotice(error.message, "error"); }
  finally { button.disabled = false; button.innerHTML = 'Save attendance <span>→</span>'; }
});
$("#add-student-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await request("/students", { method: "POST", body: JSON.stringify({ name: formData.get("name"), rollNumber: formData.get("rollNumber") }) });
    form.reset();
    await loadAll();
    showNotice("Student added successfully.");
  } catch (error) { showNotice(error.message, "error"); }
  finally { button.disabled = false; }
});
$("#student-table").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  state.pendingDeleteId = Number(button.dataset.delete);
  const student = state.students.find(s => s.id === state.pendingDeleteId);
  $("#confirm-text").textContent = `Delete ${student ? student.name : "this student"} and their attendance history? This cannot be undone.`;
  $("#confirm-dialog").showModal();
});
$("#confirm-delete").addEventListener("click", async event => {
  event.preventDefault();
  if (!state.pendingDeleteId) return;
  const button = event.currentTarget; button.disabled = true;
  try {
    await request(`/students/${state.pendingDeleteId}`, { method: "DELETE" });
    $("#confirm-dialog").close();
    await loadAll();
    showNotice("Student and their attendance records were deleted.");
  } catch (error) { showNotice(error.message, "error"); }
  finally { button.disabled = false; state.pendingDeleteId = null; }
});
$("#confirm-dialog").addEventListener("click", event => {
  if (event.target === $("#confirm-dialog")) $("#confirm-dialog").close();
});
loadAll();
