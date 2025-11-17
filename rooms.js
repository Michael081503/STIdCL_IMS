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

// --- Utilities ---
function parseStoredDateToLocal(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
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
    if (added.getMonth() === currentMonth && added.getFullYear() === currentYear) {
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
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Rooms" } },
        y: { title: { display: true, text: "Count" }, beginAtZero: true, ticks: { precision: 0 } }
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

    renderItemsChart(allItems);
  } catch (err) {
    console.error("Error fetching rooms:", err);
    tbody.innerHTML = `<tr><td colspan="2">Error loading rooms.</td></tr>`;
  }
}

// Normalize name and group by base type
function normalizeItemName(name) {
  let cleanName = (name || "")
    .toLowerCase()
    .replace(/\(no\.\s*\d+\)/gi, "")
    .replace(/#\d+/g, "")
    .replace(/\(\d+\)/g, "")
    .replace(/-\s*\d+$/g, "")
    .replace(/\s*\d+$/g, "")
    .trim();

  //if (!cleanName.endsWith("s")) cleanName += "s";

  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
}

function groupItems(itemsArray) {
  const grouped = {};

  itemsArray.forEach(item => {
    const baseName = normalizeItemName(item.Name);
    const condition = (item.Condition || "unknown").toLowerCase();

    if (!grouped[baseName]) {
      grouped[baseName] = { total: 0, good: 0, maintenance: 0, damaged: 0, list: [] };
    }

    grouped[baseName].total++;
    if (condition.includes("good")) grouped[baseName].good++;
    else if (condition.includes("maintenance")) grouped[baseName].maintenance++;
    else if (condition.includes("damage")) grouped[baseName].damaged++;

    grouped[baseName].list.push(item);
  });

  return grouped;
}

function updateStats(items) {
  const statsContainer = document.getElementById("stats-container");
  statsContainer.innerHTML = "";

  if (!items || items.length === 0) {
    statsContainer.innerHTML = `<p class="stats-placeholder">No items in this room</p>`;
    return;
  }

  const grouped = groupItems(items);

  Object.keys(grouped).forEach(name => {
    const group = grouped[name];
    const card = document.createElement("div");
    card.className = "item-card";

    const headerRow = document.createElement("div");
    headerRow.className = "item-card-header";
    headerRow.innerHTML = `
      <span class="item-name">${name}</span>
      <span class="item-total">Total: ${group.total} <i class="fas fa-chevron-down"></i></span>
    `;

    const condRow = document.createElement("div");
    condRow.className = "item-card-conditions";

    const addCond = (label, count, className) => {
      if (count > 0) {
        const div = document.createElement("div");
        div.className = `mini-condition-card ${className}`;
        div.textContent = count;
        div.setAttribute("data-status", label);
        condRow.appendChild(div);
      }
    };

    addCond("Good", group.good, "condition-good");
    addCond("Maintenance", group.maintenance, "condition-maintenance");
    addCond("Damaged", group.damaged, "condition-damaged");

    headerRow.addEventListener("click", () => {
      condRow.classList.toggle("show");
      headerRow.querySelector("i").classList.toggle("rotated");
    });

    card.appendChild(headerRow);
    card.appendChild(condRow);
    statsContainer.appendChild(card);
  });
}

// --- Show Items in Room ---
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
      <td class="item-name-cell" style="color:#2563eb;cursor:pointer;text-decoration:underline;">
        ${item.Name || "Unnamed"}
      </td>
      <td>
        <span class="condition-badge condition-${condition}">${item.Condition || "Unknown"}</span>
      </td>
      <td>${parseStoredDateToLocal(item["Date added"])}</td>
    `;

    tr.querySelector(".item-name-cell").addEventListener("click", () => openItemDetails(item));

    itemsBody.appendChild(tr);
  });

  updateStats(items);
}

// --- Item Details Modal ---
function openItemDetails(item) {
  const modal = document.getElementById("itemDetailsModal");
  const img = document.getElementById("details-image");

  document.getElementById("details-name").textContent = item.Name || "Unnamed";
  document.getElementById("details-location").textContent = item.Laboratory || "Unknown";
  document.getElementById("details-condition").textContent = item.Condition || "Unknown";
  document.getElementById("details-date").textContent = parseStoredDateToLocal(item["Date added"]);

  if (item.imageURL) {
    img.src = item.imageURL;
    img.style.display = "block";
  } else {
    img.src = "";
    img.style.display = "none";
  }

  document.getElementById("openFullPage").href =
    `https://michael081503.github.io/STIdCL_IMS/item.html?id=${item.id}`;

  modal.style.display = "flex";
}

// Get modal and close button directly
const modal = document.getElementById("itemDetailsModal");
const closeBtn = document.getElementById("closeItemDetails");

// Close modal on close button click
if (closeBtn && modal) {
  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });
}

// Close modal when clicking outside modal-box
if (modal) {
  modal.addEventListener("click", e => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
}

// =========== CALENDAR WITH AUTOMATIC MAINTENANCE HIGHLIGHT ============
async function renderCalendar() {
  const container = document.getElementById('calendarContainer');
  const calendarPanel = document.querySelector('.calendar-panel');

  if (!container || !calendarPanel) return console.error("Calendar container or panel not found!");
  container.innerHTML = '';

  const now = new Date();
  let currentMonth = now.getMonth();
  let currentYear = now.getFullYear();

  // --- Header ---
  const headerExists = calendarPanel.querySelector('.calendar-header');
  let header = headerExists || document.createElement('div');
  header.className = 'calendar-header';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '◀';
  prevBtn.onclick = () => { 
    currentMonth--; 
    if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
    updateCalendar(); 
  };

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '▶';
  nextBtn.onclick = () => { 
    currentMonth++; 
    if (currentMonth > 11) { currentMonth = 0; currentYear++; } 
    updateCalendar(); 
  };

  const title = document.createElement('span');
  title.style.fontSize = '14px';
  title.style.fontWeight = '600';

  header.innerHTML = '';
  header.appendChild(prevBtn);
  header.appendChild(title);
  header.appendChild(nextBtn);

  if (!headerExists) calendarPanel.insertBefore(header, container);

  // --- Weekdays ---
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  weekdays.forEach(day => {
    const wd = document.createElement('div');
    wd.className = 'calendar-weekday';
    wd.textContent = day;
    container.appendChild(wd);
  });

  // --- Fetch all items with MaintenanceDueDate ---
  async function fetchItemsWithMaintenance() {
    const snapshot = await getDocs(collection(db, "inventory"));
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item.MaintenanceDueDate);
  }

  // --- Update calendar ---
  async function updateCalendar() {
    container.querySelectorAll('.calendar-day').forEach(e => e.remove());

    title.textContent = `${new Date(currentYear, currentMonth).toLocaleString('default',{month:'long'})} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i=0;i<firstDay;i++) container.appendChild(document.createElement('div'));

    // Fetch items with maintenance dates
    const maintenanceItems = await fetchItemsWithMaintenance();
    const maintenanceDatesMap = {};
    maintenanceItems.forEach(item => {
      const dateStr = item.MaintenanceDueDate.split('T')[0];
      if (!maintenanceDatesMap[dateStr]) maintenanceDatesMap[dateStr] = [];
      maintenanceDatesMap[dateStr].push(item);
    });

    for (let day=1; day<=daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.classList.add('calendar-day');
      cell.textContent = day;

      const cellDateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

      // Highlight dates with maintenance
      if (maintenanceDatesMap[cellDateStr]) {
        cell.classList.add('has-maintenance');
        cell.title = 'Maintenance scheduled';
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
          openItemsModal(maintenanceDatesMap[cellDateStr]);
        });
      }

      // Highlight today
      if (day === now.getDate() && currentMonth===now.getMonth() && currentYear===now.getFullYear()) {
        cell.classList.add('today');
        cell.title = 'Today';
      }

      container.appendChild(cell);
    }
  }

  updateCalendar();
}

// --- Modal for multiple items ---
function openItemsModal(items) {
  let currentIndex = 0;
  const modal = document.getElementById("itemDetailsModal");
  const img = document.getElementById("details-image");
  const modalBox = modal.querySelector(".modal-box");

  if (!modalBox) return console.error("Modal box not found!");

  function showItem(index){
    const item = items[index];
    document.getElementById("details-name").textContent = item.Name || "Unnamed";
    document.getElementById("details-location").textContent = item.Laboratory || "Unknown";
    document.getElementById("details-condition").textContent = item.Condition || "Unknown";
    document.getElementById("details-date").textContent = item.MaintenanceDueDate ? new Date(item.MaintenanceDueDate).toLocaleString() : 'N/A';

    if(item.imageURL){ img.src=item.imageURL; img.style.display="block"; }
    else{ img.src=""; img.style.display="none"; }

    document.getElementById("openFullPage").href = `https://michael081503.github.io/STIdCL_IMS/item.html?id=${item.id}`;
  }

  showItem(currentIndex);
  modal.style.display="flex";

  // Remove previous nav buttons
  modalBox.querySelectorAll(".modal-nav-btn").forEach(btn=>btn.remove());

  if(items.length>1){
    const navContainer = document.createElement("div");
    navContainer.style.display = "flex";
    navContainer.style.justifyContent = "flex-start";
    navContainer.style.marginTop = "10px";

    const prevBtn = document.createElement("button");
    prevBtn.textContent="◀ Previous";
    prevBtn.className="modal-nav-btn modal-btn";
    prevBtn.style.marginRight="10px";
    prevBtn.onclick = ()=>{ currentIndex=(currentIndex-1+items.length)%items.length; showItem(currentIndex); };

    const nextBtn = document.createElement("button");
    nextBtn.textContent="Next ▶";
    nextBtn.className="modal-nav-btn modal-btn";
    nextBtn.onclick = ()=>{ currentIndex=(currentIndex+1)%items.length; showItem(currentIndex); };

    navContainer.appendChild(prevBtn);
    navContainer.appendChild(nextBtn);
    modalBox.appendChild(navContainer);
  }
}

// --- Close modal logic ---
const modal1 = document.getElementById("itemDetailsModal");
const closeBtn1 = document.getElementById("closeItemDetails");
if(closeBtn1 && modal1) closeBtn1.addEventListener("click",()=>modal1.style.display="none");
if(modal1) modal1.addEventListener("click",e=>{if(e.target===modal1) modal1.style.display="none";});

// --- Initialize ---
renderCalendar();

fetchRooms();
console.log("🚀 Loaded NEW rooms.js version");

window.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 200);
});
