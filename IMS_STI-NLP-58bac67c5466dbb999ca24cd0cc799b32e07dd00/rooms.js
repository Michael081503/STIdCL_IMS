import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Firebase config
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

function parseStoredDateToLocal(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0") + " " +
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0");
}

// --- Chart.js Setup ---
let itemsChart = null;
function renderItemsChart(items) {
  const ctx = document.getElementById("itemsChart").getContext("2d");
  if (itemsChart) itemsChart.destroy();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const roomCounts = {};
  items.forEach(item => {
    const added = new Date(item["Date added"]);
    if (
      added.getMonth() === currentMonth &&
      added.getFullYear() === currentYear
    ) {
      const lab = item.Laboratory || "Unknown";
      roomCounts[lab] = (roomCounts[lab] || 0) + 1;
    }
  });

  const labels = Object.keys(roomCounts);
  const data = Object.values(roomCounts);

  itemsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Items Added",
          data,
          backgroundColor: "#2D3E50"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { title: { display: true, text: "Rooms" } },
        y: {
          title: { display: true, text: "Count" },
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

// --- Fetch Rooms ---
async function fetchRooms() {
  const tbody = document.getElementById("rooms-root");
  tbody.innerHTML = `<tr><td colspan="2">Loading...</td></tr>`;

  try {
    const snapshot = await getDocs(collection(db, "inventory"));
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="2">No rooms found.</td></tr>`;
      return;
    }

    const allItems = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    // Group by Laboratory
    const roomsMap = {};
    allItems.forEach(item => {
      const lab = item.Laboratory || "Unknown";
      if (!roomsMap[lab]) roomsMap[lab] = [];
      roomsMap[lab].push(item);
    });

    tbody.innerHTML = "";
    Object.keys(roomsMap).forEach(lab => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${lab}</td>
        <td>${roomsMap[lab].length}</td>
      `;
      tr.addEventListener("click", () => showItems(roomsMap[lab]));
      tbody.appendChild(tr);
    });

    // Render the monthly graph
    renderItemsChart(allItems);

  } catch (err) {
    console.error("Error fetching rooms:", err);
    tbody.innerHTML = `<tr><td colspan="2">Error loading rooms.</td></tr>`;
  }
}

// --- Stats Overview (Collapsible Item Cards) ---
function updateStats(items) {
  const statsContainer = document.getElementById("stats-container");
  statsContainer.innerHTML = "";

  if (!items || items.length === 0) {
    statsContainer.innerHTML = `<p class="stats-placeholder">No items in this room</p>`;
    return;
  }

  const itemMap = {};
  items.forEach(item => {
    const name = item.Name || "Unnamed";
    if (!itemMap[name]) {
      itemMap[name] = { total: 0, conditions: {} };
    }
    itemMap[name].total++;
    const cond = (item.Condition || "Unknown").toLowerCase();
    if (!itemMap[name].conditions[cond]) {
      itemMap[name].conditions[cond] = 0;
    }
    itemMap[name].conditions[cond]++;
  });

  Object.keys(itemMap).forEach(name => {
    const card = document.createElement("div");
    card.className = "item-card";

    const headerRow = document.createElement("div");
    headerRow.className = "item-card-header";
    headerRow.innerHTML = `
      <span class="item-name">${name}</span>
      <span class="item-total">Total: ${itemMap[name].total} <i class="fas fa-chevron-down"></i></span>
    `;

    const condRow = document.createElement("div");
    condRow.className = "item-card-conditions"; // hidden by CSS default

 Object.entries(itemMap[name].conditions).forEach(([cond, count]) => {
  const condDiv = document.createElement("div");
  condDiv.className = `mini-condition-card condition-${cond.replace(/\s/g, "-")}`;
  condDiv.textContent = count;

  // ✅ Force remove any old title attribute
  condDiv.removeAttribute("title");

  // ✅ Capitalize condition label and store in data-status for custom tooltip
  const statusLabel = cond.charAt(0).toUpperCase() + cond.slice(1);
  condDiv.setAttribute("data-status", statusLabel);

  condRow.appendChild(condDiv);
});


    headerRow.addEventListener("click", () => {
      condRow.classList.toggle("show");
      headerRow.querySelector("i").classList.toggle("rotated");
    });

    card.appendChild(headerRow);
    card.appendChild(condRow);
    statsContainer.appendChild(card);
  });
}



// --- Show Items in Selected Room ---
function showItems(items) {
  const itemsBody = document.getElementById("items-body");
  itemsBody.innerHTML = "";

  if (!items || items.length === 0) {
    itemsBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No items in this room</td></tr>`;
    updateStats([]);
    return;
  }

  items.forEach(item => {
    const condition = (item.Condition || "Unknown").toLowerCase().replace(/\s/g, "-");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.Name || "Unnamed"}</td>
      <td><span class="condition-badge condition-${condition}">${item.Condition || "Unknown"}</span></td>
      <td>${parseStoredDateToLocal(item["Date added"])}</td>
    `;
    itemsBody.appendChild(tr);
  });

  updateStats(items);
}
console.log("🚀 Loaded NEW rooms.js version");

fetchRooms();
