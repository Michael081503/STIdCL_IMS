// user.js — Fixed Add User session issue + Rounded Add Button + Stay on Page
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

console.log("✅ user.js loaded");

const firebaseConfig = {
  apiKey: "AIzaSyAw2rSjJ3f_S98dntbsyl9kyXvi9MC44Dw",
  authDomain: "fir-inventory-2e62a.firebaseapp.com",
  projectId: "fir-inventory-2e62a",
  storageBucket: "fir-inventory-2e62a.firebasestorage.app",
  messagingSenderId: "380849220480",
  appId: "1:380849220480:web:5a43b227bab9f9a197af65",
  measurementId: "G-ERT87GL4XC",
};

// ✅ Main app (current session)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ✅ Secondary app (for creating users)
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

let allUsers = [];

// ================================
// 📥 Fetch Users
// ================================
async function fetchUsers() {
  const tbody = document.getElementById("user-table-body");
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading users...</td></tr>`;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:red;text-align:center;">Please log in as Admin to view users.</td></tr>`;
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const currentUser = userDoc.data();

      if (!currentUser || currentUser.role !== "Admin") {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;text-align:center;">Access denied. Admins only.</td></tr>`;
        return;
      }

      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No users found.</td></tr>`;
        return;
      }

      allUsers = [];
      snapshot.forEach((docSnap) => {
        const u = docSnap.data();
        allUsers.push({ id: docSnap.id, ...u });
      });

      renderTable(allUsers, user.uid);
      setupFilters(user.uid);
      setupAddUserFeature(user.uid); // pass admin ID

    } catch (err) {
      console.error("Error loading users:", err);
      tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Error loading user data.</td></tr>`;
    }
  });
}

// ================================
// 🧩 Render Table
// ================================
function renderTable(users, currentUid) {
  const tbody = document.getElementById("user-table-body");
  tbody.innerHTML = "";

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No matching users found.</td></tr>`;
    return;
  }

  users.forEach((u) => {
    const tr = document.createElement("tr");
    const email = u.email || "—";
    const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
    const role = u.role || "User";
    const date = u.createdAt?.toDate
      ? u.createdAt.toDate().toLocaleString()
      : "—";

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

    const roleCell = document.createElement("td");
    roleCell.appendChild(roleSelect);

    tr.innerHTML = `
      <td>${email}</td>
      <td>${name}</td>
      <td></td>
      <td>${date}</td>
    `;
    tr.children[2].replaceWith(roleCell);
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
        (`${u.firstName || ""} ${u.lastName || ""}`)
          .toLowerCase()
          .includes(searchTerm);
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

  addBtn.style.borderRadius = "8px"; // ✅ Rounded square button

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
      // ✅ Check if email already exists
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("A user with this email already exists!");
        return;
      }

      const password = generatePassword(12);
      auSubmit.disabled = true;
      auSubmit.textContent = "Creating...";

      // ✅ Create new user with secondary auth (no logout)
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
        createdAt: serverTimestamp(),
      });

      closeAddModal();
      passwordBox.textContent = password;
      passwordModal.classList.add("active");
      fetchUsers();

      // Sign out of secondary auth (keep admin signed in)
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

fetchUsers();
