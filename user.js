// user.js — with Search + Role Filter + Editable Roles
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

console.log("✅ user.js loaded");

const firebaseConfig = {
  apiKey: "AIzaSyAw2rSjJ3f_S98dntbsyl9kyXvi9MC44Dw",
  authDomain: "fir-inventory-2e62a.firebaseapp.com",
  projectId: "fir-inventory-2e62a",
  storageBucket: "fir-inventory-2e62a.firebasestorage.app",
  messagingSenderId: "380849220480",
  appId: "1:380849220480:web:5a43b227bab9f9a197af65",
  measurementId: "G-ERT87GL4XC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let allUsers = []; //Local save (For more efficiency)

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

      allUsers = []; // reset cache
      snapshot.forEach((docSnap) => {
        const u = docSnap.data();
        allUsers.push({ id: docSnap.id, ...u });
      });

      renderTable(allUsers, user.uid);
      setupFilters(user.uid);

    } catch (err) {
      console.error("Error loading users:", err);
      tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Error loading user data.</td></tr>`;
    }
  });
}

// ================================
// 🧩 Render Table with Filters
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

    // Disable self-edit
    if (u.id === currentUid) {
      roleSelect.disabled = true;
      roleSelect.title = "You cannot change your own role";
      roleSelect.style.opacity = "0.6";
      roleSelect.style.cursor = "not-allowed";
    }

    // Update role
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
// 🔍 Search + Filter Setup
// ================================
function setupFilters(currentUid) {
  const searchInput = document.getElementById("search-input");
  const roleFilter = document.getElementById("role-filter");

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRole = roleFilter.value;

    let filtered = allUsers.filter((u) => {
      const matchesSearch =
        (u.email || "").toLowerCase().includes(searchTerm) ||
        (`${u.firstName || ""} ${u.lastName || ""}`)
          .toLowerCase()
          .includes(searchTerm);
      const matchesRole =
        selectedRole === "All" || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });

    renderTable(filtered, currentUid);
  }

  searchInput.addEventListener("input", applyFilters);
  roleFilter.addEventListener("change", applyFilters);
}

// Run automatically
fetchUsers();
