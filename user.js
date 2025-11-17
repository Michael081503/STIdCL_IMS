// users.js — Fixed table loading + role & position dropdowns + add user
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

console.log("✅ users.js loaded");

const firebaseConfig = {
  apiKey: "AIzaSyAw2rSjJ3f_S98dntbsyl9kyXvi9MC44Dw",
  authDomain: "fir-inventory-2e62a.firebaseapp.com",
  projectId: "fir-inventory-2e62a",
  storageBucket: "fir-inventory-2e62a.firebasestorage.app",
  messagingSenderId: "380849220480",
  appId: "1:380849220480:web:5a43b227bab9f9a197af65",
  measurementId: "G-ERT87GL4XC",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Secondary app for creating users
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

let allUsers = [];
let currentUser = null;

// ================================
// 🔐 Auth listener
// ================================
onAuthStateChanged(auth, async (user) => {
  const tbody = document.getElementById("user-table-body");

  if (!user) {
    tbody.innerHTML =
      `<tr><td colspan="5" style="color:red;text-align:center;">Please log in as Admin to view users.</td></tr>`;
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    currentUser = userDoc.data();

    if (!currentUser || currentUser.role !== "Admin") {
      tbody.innerHTML =
        `<tr><td colspan="5" style="color:red;text-align:center;">Access denied. Admins only.</td></tr>`;
      return;
    }

    // Load users
    fetchUsers();

  } catch (err) {
    console.error("Error fetching current user:", err);
    tbody.innerHTML =
      `<tr><td colspan="5" style="color:red;text-align:center;">Error loading user data.</td></tr>`;
  }
});

// ================================
// 📥 Fetch all users
// ================================
async function fetchUsers() {
  const tbody = document.getElementById("user-table-body");
  tbody.innerHTML = `<tr><td colspan="5" class="loading">Loading users...</td></tr>`;

  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>`;
      return;
    }

    allUsers = [];
    snapshot.forEach((docSnap) => {
      const u = docSnap.data();
      allUsers.push({ id: docSnap.id, ...u });
    });

    renderTable(allUsers, auth.currentUser.uid);
    setupFilters(auth.currentUser.uid);
    setupAddUserFeature(auth.currentUser.uid);

  } catch (err) {
    console.error("Error loading users:", err);
    tbody.innerHTML =
      `<tr><td colspan="5" style="color:red;text-align:center;">Error loading user data.</td></tr>`;
  }
}

// ================================
// 🧩 Render Table
// ================================
function renderTable(users, currentUid) {
  const tbody = document.getElementById("user-table-body");
  tbody.innerHTML = "";

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No matching users found.</td></tr>`;
    return;
  }

  users.forEach((u) => {
    const email = u.email || "—";
    const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
    const role = u.role || "User";
    const position = u.position || "Undefined";
    const date = u.createdAt?.toDate
      ? u.createdAt.toDate().toLocaleString()
      : "—";

    // Role select
    const roleSelect = document.createElement("select");
    roleSelect.className = "role-select";
    ["Admin", "Maintenance", "User"].forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (r === role) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    if (u.id === currentUid) {
      roleSelect.disabled = true;
      roleSelect.title = "You cannot change your own role";
      roleSelect.style.opacity = "0.6";
      roleSelect.style.cursor = "not-allowed";
    }
    roleSelect.addEventListener("change", async (e) => {
      const newRole = e.target.value;
      try {
        await updateDoc(doc(db, "users", u.id), { role: newRole });
        e.target.style.backgroundColor = "#d4edda";
        setTimeout(() => (e.target.style.backgroundColor = ""), 1000);
      } catch (err) {
        console.error("Failed to update role:", err);
        e.target.style.backgroundColor = "#f8d7da";
        setTimeout(() => (e.target.style.backgroundColor = ""), 1000);
      }
    });

    // Position select
    const positionSelect = document.createElement("select");
    positionSelect.className = "position-select";
    ["Super Admin", "Owner", "Head", "Manager", "Staff", "Undefined"].forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (position === p) opt.selected = true;
      positionSelect.appendChild(opt);
    });
    if (u.id === currentUid) {
      positionSelect.disabled = true;
      positionSelect.title = "You cannot change your own position";
      positionSelect.style.opacity = "0.6";
      positionSelect.style.cursor = "not-allowed";
    }
    positionSelect.addEventListener("change", async (e) => {
      const newPos = e.target.value;
      try {
        await updateDoc(doc(db, "users", u.id), { position: newPos });
        e.target.style.backgroundColor = "#d4edda";
        setTimeout(() => (e.target.style.backgroundColor = ""), 1000);
      } catch (err) {
        console.error("Failed to update position:", err);
        e.target.style.backgroundColor = "#f8d7da";
        setTimeout(() => (e.target.style.backgroundColor = ""), 1000);
      }
    });

    // Build table row properly
    const tr = document.createElement("tr");

    const emailCell = document.createElement("td");
    emailCell.textContent = email;

    const nameCell = document.createElement("td");
    nameCell.textContent = name;

    const roleCell = document.createElement("td");
    roleCell.appendChild(roleSelect);

    const positionCell = document.createElement("td");
    positionCell.appendChild(positionSelect);

    const dateCell = document.createElement("td");
    dateCell.textContent = date;

    [emailCell, nameCell, roleCell, positionCell, dateCell].forEach(cell => tr.appendChild(cell));

    tbody.appendChild(tr);
  });
}

// ================================
// 🔍 Filters
// ================================
function setupFilters(currentUid) {
  const searchInput = document.getElementById("search-input");
  const roleFilter = document.getElementById("role-filter");

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRole = roleFilter.value;

    const filtered = allUsers.filter((u) => {
      const matchesSearch =
        (u.email || "").toLowerCase().includes(searchTerm) ||
        (`${u.firstName || ""} ${u.lastName || ""}`).toLowerCase().includes(searchTerm);
      const matchesRole = selectedRole === "All" || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });

    renderTable(filtered, currentUid);
  }

  searchInput.addEventListener("input", applyFilters);
  roleFilter.addEventListener("change", applyFilters);
}

// ================================
// 👤 Add User Feature
// ================================
function setupAddUserFeature(adminUid) {
  const addBtn = document.getElementById("addUserBtn");
  const addModal = document.getElementById("addUserModal");
  const auCancel = document.getElementById("au-cancel");
  const auClose = document.getElementById("au-close");
  const auSubmit = document.getElementById("au-submit");
  const firstInput = document.getElementById("au-firstName");
  const lastInput = document.getElementById("au-lastName");
  const emailInput = document.getElementById("au-email");
  const roleSelect = document.getElementById("au-role");

  const passwordModal = document.getElementById("au-passwordModal");
  const passwordBox = document.getElementById("au-passwordBox");
  const copyBtn = document.getElementById("au-copyPassword");
  const closePwBtn = document.getElementById("au-closePassword");

  if (!addBtn) return;

  addBtn.style.borderRadius = "8px";

  addBtn.addEventListener("click", () => {
    addModal.classList.add("active");
    firstInput.focus();
  });

  function closeAddModal() {
    addModal.classList.remove("active");
    firstInput.value = "";
    lastInput.value = "";
    emailInput.value = "";
    roleSelect.value = "User";
  }

  [auCancel, auClose].forEach((el) =>
    el.addEventListener("click", closeAddModal)
  );
  closePwBtn.addEventListener("click", () =>
    passwordModal.classList.remove("active")
  );

  function generatePassword(len = 12) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=";
    let out = "";
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
    return out;
  }

  auSubmit.addEventListener("click", async () => {
    const first = firstInput.value.trim();
    const last = lastInput.value.trim();
    const email = emailInput.value.trim();
    const role = roleSelect.value || "User";
    if (!first || !last || !email) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("A user with this email already exists!");
        return;
      }

      const password = generatePassword(12);
      auSubmit.disabled = true;
      auSubmit.textContent = "Creating...";

      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      const uid = cred.user.uid;

      await setDoc(doc(db, "users", uid), {
        firstName: first,
        lastName: last,
        email,
        role,
        position: "Undefined",
        createdAt: serverTimestamp(),
      });

      closeAddModal();
      passwordBox.textContent = password;
      passwordModal.classList.add("active");
      fetchUsers();

      await secondaryAuth.signOut();
    } catch (err) {
      console.error("Add user failed:", err);
      alert("Failed to create user. Check console for details.");
    } finally {
      auSubmit.disabled = false;
      auSubmit.textContent = "Create User";
    }
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(passwordBox.textContent);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
    } catch {
      alert("Copy failed, please copy manually.");
    }
  });
}

// ================================
// ⚡ Initialize
// ================================
window.addEventListener("DOMContentLoaded", () => {
  // Table will load automatically after auth listener fires
});
