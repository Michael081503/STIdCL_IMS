// ✅ inventory.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js";

console.log("✅ inventory.js loaded");

// ✅ Firebase config (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyAw2rSjJ3f_S98dntbsyl9kyXvi9MC44Dw",
  authDomain: "fir-inventory-2e62a.firebaseapp.com",
  projectId: "fir-inventory-2e62a",
  storageBucket: "fir-inventory-2e62a.firebasestorage.app",
  messagingSenderId: "380849220480",
  appId: "1:380849220480:web:5a43b227bab9f9a197af65",
  measurementId: "G-ERT87GL4XC"
};

// ✅ Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app, "gs://fir-inventory-2e62a.firebasestorage.app");


/* -------------------------
   Helpers for Date/Time
------------------------- */
function nowLocalDateTimeString() {
  const now = new Date();
  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0") + " " +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0");
}

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

/* -------------------------
   Fetch Inventory
------------------------- */
async function fetchInventory() {
  const tbody = document.getElementById("inventory-root");
  tbody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`; // placeholder

  // ✅ Stat counter elements
  const totalCountElem = document.getElementById("stat-total");
  const newCountElem = document.getElementById("stat-new");
  const goodCountElem = document.getElementById("stat-good");
  const maintenanceCountElem = document.getElementById("stat-maintenance");
  const replacementCountElem = document.getElementById("stat-replacement");

  // Reset counters
  [totalCountElem, newCountElem, goodCountElem, maintenanceCountElem, replacementCountElem]
    .forEach(el => el && (el.textContent = "0"));

  try {
    const snapshot = await getDocs(collection(db, "inventory"));

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="6">No inventory items found.</td></tr>`;
      return;
    }

    const allItems = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    // ✅ Update stats
    const totalItems = allItems.length;
    const newItems = allItems.filter(i => i.Condition === "New").length;
    const goodItems = allItems.filter(i => i.Condition === "Good").length;
    const maintenanceItems = allItems.filter(i => i.Condition === "For Maintenance").length;
    const replacementItems = allItems.filter(i => i.Condition === "For Replacement").length;

    if (totalCountElem) totalCountElem.textContent = totalItems;
    if (newCountElem) newCountElem.textContent = newItems;
    if (goodCountElem) goodCountElem.textContent = goodItems;
    if (maintenanceCountElem) maintenanceCountElem.textContent = maintenanceItems;
    if (replacementCountElem) replacementCountElem.textContent = replacementItems;

    updateChart(newItems, goodItems, maintenanceItems, replacementItems);

    // ✅ Location chart
    const locationCounts = {};
    allItems.forEach(item => {
      const loc = item.Laboratory || "Unknown";
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });
    updateLocationChart(locationCounts);

    // ✅ Latest items
    const latestList = document.getElementById("latest-items-list");
    if (latestList) {
      latestList.innerHTML = "";
      [...allItems]
        .sort((a, b) => new Date(b["Date added"]) - new Date(a["Date added"]))
        .slice(0, 10)
        .forEach(item => {
          const li = document.createElement("li");
          li.innerHTML = `<time>${parseStoredDateToLocal(item["Date added"])}</time> ${item.Name || "Unnamed"}`;
          latestList.appendChild(li);
        });
    }

    // ✅ Clear tbody and render rows
    tbody.innerHTML = "";
    allItems.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.id.slice(-6)}</td>
        <td><a href="https://reddjoseph.github.io/IMS_STI-NLP/item.html?id=${item.id}" 
               target="_blank" style="color:#000;text-decoration:none;">
              ${item.Name || "Unnamed"}</a></td>
        <td>${item.Laboratory || "Unknown"}</td>
        <td>${parseStoredDateToLocal(item["Date added"])}</td>
        <td><span class="condition-badge condition-${(item.Condition || "unknown").toLowerCase().replace(/\s/g,"-")}">
              ${item.Condition || "Unknown"}</span></td>
        <td class="actions-cell">
          <button class="edit-btn">✏️ Edit</button>
          <button class="delete-btn">🗑 Delete</button>
          <button class="qr-btn">🔗 QR</button>
        </td>
      `;
      tbody.appendChild(tr);

      // Wire up buttons
      tr.querySelector(".edit-btn").addEventListener("click", () => showEditItemForm(item.id, item));
      tr.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm(`Delete "${item.Name}"?`)) {
          await addDoc(collection(db, "trash"), {
            ...item,
            deletedAt: new Date().toISOString(),
            originalId: item.id
          });
          await deleteDoc(doc(db, "inventory", item.id));
          fetchInventory();
        }
      });
      tr.querySelector(".qr-btn").addEventListener("click", () => showQRModal(item.id));
    });

  } catch (err) {
    console.error("Error fetching inventory:", err);
    tbody.innerHTML = `<tr><td colspan="6">Error loading inventory.</td></tr>`;
  }
}


/* -------------------------
   Items Chart
------------------------- */
let inventoryChart = null;
function updateChart(newItems, goodItems, maintenanceItems, replacementItems) {
  const ctx = document.getElementById("inventory-pie")?.getContext("2d");
  if (!ctx || typeof Chart === "undefined") return;

  if (inventoryChart) inventoryChart.destroy();

  inventoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["New", "Good", "For Maintenance", "For Replacement"],
      datasets: [
        {
          data: [newItems, goodItems, maintenanceItems, replacementItems],
          backgroundColor: [
            "#10b981",
            "#3b82f6", 
            "#facc15", 
            "#ef4444"  
          ],
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
      ,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            pointStyle: "rect",
            usePointStyle: true,
            padding: 15,
            font: {
              family: "Arial, sans-serif",
              size: 14,
              weight: "0",
            },
            color: "#333",
          },
        },
              title: {
        display: true,
        text: "Item Status Summary",  
        font: {
          size: 16,
          weight: "bold"
        },
        color: "#333",  
        padding: {
          top: 10,
          bottom: 20
        }
      },
      },
    },
  });
}

/* -------------------------
   Location Bar Chart
------------------------- */
let locationChart = null;
function updateLocationChart(locationCounts) {
  const ctx = document.getElementById("location-bar")?.getContext("2d");
  if (!ctx || typeof Chart === "undefined") return;

  if (locationChart) locationChart.destroy();

  locationChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(locationCounts),
      datasets: [
        {
          label: "Items per Location",
          data: Object.values(locationCounts),
          backgroundColor: "#2D3E50",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { display: false },   
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: "#333" }
        }
      },
      plugins: {
        legend: { display: false },
              title: {
        display: true,
        text: "Most Populated Locations",  
        font: {
          size: 16,
          weight: "bold"
        },
        color: "#333", 
        padding: {
          top: 10,
          bottom: 20
        }
      },    
        tooltip: { enabled: true }
      }
    }
  });
}

/* -------------------------
   Archive Modal
------------------------- */
async function showTrashModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal modal--large";
  modal.style.maxWidth = "95vw";

  modal.innerHTML = `
    <h2><i class="fa-solid fa-box-archive"></i> Archived Items</h2>
    <table class="inventory-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Location</th>
          <th>Condition</th>
          <th>Date Added</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="trash-tbody"><tr><td colspan="5">Loading...</td></tr></tbody>
    </table>
    <button id="close-trash-btn">Close</button>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById("close-trash-btn").addEventListener("click", () => overlay.remove());

  const tbody = document.getElementById("trash-tbody");
  try {
    const snapshot = await getDocs(collection(db, "trash"));
    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5">Archive is empty.</td></tr>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.Name || "Unnamed"}</td>
        <td>${item.Laboratory || "Unknown"}</td>
        <td>${item.Condition || "Unknown"}</td>
        <td>${parseStoredDateToLocal(item["Date added"])}</td>
        <td class="actions-cell"></td>
      `;

      const actionsTd = tr.querySelector(".actions-cell");

      const restoreBtn = document.createElement("button");
      restoreBtn.textContent = "♻️ Restore";
      restoreBtn.addEventListener("click", async () => {
        try {
          await addDoc(collection(db, "inventory"), {
            Name: item.Name,
            Laboratory: item.Laboratory,
            Condition: item.Condition,
            "Date added": nowLocalDateTimeString()
          });
          await deleteDoc(doc(db, "trash", docSnap.id));
          alert("✅ Item restored!");
          overlay.remove();
          fetchInventory();
        } catch (err) {
          console.error(err);
          alert("❌ Failed to restore.");
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑️ Delete Permanently";
      deleteBtn.addEventListener("click", async () => {
        if (confirm(`Permanently delete "${item.Name}"?`)) {
          try {
            await deleteDoc(doc(db, "trash", docSnap.id));
            alert("❌ Item permanently deleted!");
            tr.remove();
          } catch (err) {
            console.error(err);
            alert("❌ Failed to delete.");
          }
        }
      });

      actionsTd.append(restoreBtn, deleteBtn);
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error fetching archive:", err);
    tbody.innerHTML = `<tr><td colspan="5">Error loading archive.</td></tr>`;
  }
}

/* -------------------------
   Add Item with Categories + Locations
------------------------- */
function showAddItemForm() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h2>Add New Inventory Item</h2>
    <form id="add-item-form">
      <label>Name:</label>
      <input type="text" id="item-name" placeholder="Select category first" disabled required />
      <select id="item-category" required>
        <option value="">Select Category</option>
        <option value="Computers">Computers</option>
        <option value="Electronics">Electronics</option>
        <option value="Appliances">Appliances</option>
        <option value="Kitchen">Kitchen</option>
      </select>

      <label>Location:</label>
      <input type="text" id="item-lab" placeholder="Select building first" disabled required />
      <select id="building-select" required>
        <option value="">Select Building</option>
        <option value="Main Building">Main Building</option>
        <option value="Annex">Annex</option>
      </select>

      <label>Condition:</label>
      <select id="item-condition" required>
        <option value="">Select Condition</option>
        <option>New</option>
        <option>Good</option>
        <option>Damaged</option>
        <option>For Maintenance</option>
        <option>For Replacement</option>
      </select>

      <label>Item Image (optional):</label>
      <input type="file" id="item-image" accept="image/*" />

      <button type="submit">➕ Add Item</button>
      <button type="button" id="close-modal-btn">Cancel</button>
    </form>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const nameInput = modal.querySelector("#item-name");
  const labInput = modal.querySelector("#item-lab");
  const categorySelect = modal.querySelector("#item-category");
  const buildingSelect = modal.querySelector("#building-select");

  // ✅ Category selection (sub-modal with icons)
  categorySelect.addEventListener("change", () => {
    const category = categorySelect.value;
    nameInput.value = "";
    delete nameInput.dataset.value;

    let options = [];
    if (category === "Computers") {
      options = [
        { name: "Intel PC", icon: "💻" },
        { name: "Ryzen PC", icon: "🖥️" }
      ];
    }
    if (category === "Electronics") {
      options = [
        { name: "Projector", icon: "📽️" },
        { name: "Modem", icon: "🌐" },
        { name: "Switch", icon: "🔀" }
      ];
    }
    if (category === "Appliances") {
      options = [
        { name: "Chair", icon: "🪑" },
        { name: "Aircon", icon: "❄️" },
        { name: "Table", icon: "📏" }
      ];
    }
    if (category === "Kitchen") {
      options = [
        { name: "Microwave", icon: "🍲" },
        { name: "Coffee Maker", icon: "☕" },
        { name: "Fridge", icon: "🧊" }
      ];
    }

    if (options.length === 0) return;

    const subOverlay = document.createElement("div");
    subOverlay.className = "modal-overlay";

    const subModal = document.createElement("div");
    subModal.className = "modal modal--small";
    subModal.style.width = "80%";
    subModal.style.maxWidth = "800px";
    subModal.style.minWidth = "600px";

    subModal.innerHTML = `
      <h3>Select ${category} Item</h3>
      <div id="sub-options"></div>
      <button type="button" id="sub-close">Cancel</button>
    `;

    subOverlay.appendChild(subModal);
    document.body.appendChild(subOverlay);

    const subOptions = subModal.querySelector("#sub-options");
    subOptions.innerHTML = "";
    const table = document.createElement("table");
    table.className = "inventory-table";
    const tbody = document.createElement("tbody");

    for (let i = 0; i < options.length; i += 5) {
      const row = document.createElement("tr");
      options.slice(i, i + 5).forEach(opt => {
        const cell = document.createElement("td");
        const btn = document.createElement("button");
        btn.className = "item-choice-btn";
        btn.innerHTML = `${opt.icon} ${opt.name}`;
        btn.addEventListener("click", () => {
          nameInput.value = opt.name;
          nameInput.dataset.value = opt.name;
          subOverlay.remove();
        });
        cell.appendChild(btn);
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    subOptions.appendChild(table);

    subModal.querySelector("#sub-close").addEventListener("click", () => subOverlay.remove());
  });

  // ✅ Building selection → Location sub-modal
  buildingSelect.addEventListener("change", () => {
    const building = buildingSelect.value;
    labInput.value = "";
    delete labInput.dataset.value;

    if (!building) return;

    let options = [];
    if (building === "Main Building") {
      options = [
        "Laboratory 1", "Laboratory 2", "Laboratory 3", "Laboratory 4",
        "Room 201", "Room 202", "Room 203", "Room 204",
        "Room 401", "Room 402", "Room 403"
      ];
    } else if (building === "Annex") {
      options = ["Room 201", "Room 202", "Room 203", "Room 204", "Auditorium"];
    }

    const subOverlay = document.createElement("div");
    subOverlay.className = "modal-overlay";

    const subModal = document.createElement("div");
    subModal.className = "modal modal--small";
    subModal.style.width = "80%";
    subModal.style.maxWidth = "600px";

    subModal.innerHTML = `
      <h3>Select ${building} Location</h3>
      <div id="lab-options"></div>
      <button type="button" id="sub-close-lab">Cancel</button>
    `;

    subOverlay.appendChild(subModal);
    document.body.appendChild(subOverlay);

    const labOptions = subModal.querySelector("#lab-options");
    labOptions.innerHTML = "";
    const table = document.createElement("table");
    table.className = "inventory-table";
    const tbody = document.createElement("tbody");

    for (let i = 0; i < options.length; i += 3) {
      const row = document.createElement("tr");
      options.slice(i, i + 3).forEach(opt => {
        const cell = document.createElement("td");
        const btn = document.createElement("button");
        btn.className = "item-choice-btn";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          labInput.value = `${building} (${opt})`;
          labInput.dataset.value = `${building} (${opt})`;
          subOverlay.remove();
        });
        cell.appendChild(btn);
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    labOptions.appendChild(table);

    subModal.querySelector("#sub-close-lab").addEventListener("click", () => subOverlay.remove());
  });

  modal.querySelector("#close-modal-btn").addEventListener("click", () => overlay.remove());

  modal.querySelector("#add-item-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = nameInput.dataset.value || "";
    const lab = labInput.dataset.value || "";
    const condition = modal.querySelector("#item-condition").value;
    if (!name || !lab || !condition) return alert("Fill all fields");

    const fileInput = modal.querySelector("#item-image");
    let imageURL = "";

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileRef = ref(storage, `item_images/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      imageURL = await getDownloadURL(fileRef);
    }

    try {
      await addDoc(collection(db, "inventory"), {
        Name: name,
        Laboratory: lab,
        Condition: condition,
        "Date added": nowLocalDateTimeString(),
        MaintenanceDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        imageURL: imageURL || ""
      });
      alert("✅ Item added!");
      overlay.remove();
      fetchInventory();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to add.");
    }
  });
}

/* -------------------------
   QR Modal
------------------------- */
function showQRModal(itemId) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal modal--small";

  modal.innerHTML = `
    <h2>QR Code for ${itemId}</h2>
    <div id="qrCodeContainer" style="display:flex; justify-content:center; margin:20px 0;"></div>
    <div style="text-align:center;">
      <button id="close-qr-btn" class="cancel-btn">Close</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function generate() {
    const qrContainer = document.getElementById("qrCodeContainer");
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: `https://reddjoseph.github.io/IMS_STI-NLP/item.html?id=${itemId}`,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  if (typeof QRCode === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
    script.onload = generate;
    document.body.appendChild(script);
  } else {
    generate();
  }

  modal.querySelector("#close-qr-btn").addEventListener("click", () => overlay.remove());
}

/* -------------------------
   Edit Item Modal
------------------------- */
function showEditItemForm(itemId, itemData) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <h2>Edit Item</h2>
    <form id="edit-item-form">
      <label>Name:</label>
      <input type="text" id="edit-name" value="${itemData.Name || ""}" required />

      <label>Location:</label>
      <input type="text" id="edit-lab" value="${itemData.Laboratory || ""}" required />

      <label>Condition:</label>
      <select id="edit-condition" required>
        <option ${itemData.Condition==="New"?"selected":""}>New</option>
        <option ${itemData.Condition==="Good"?"selected":""}>Good</option>
        <option ${itemData.Condition==="Damaged"?"selected":""}>Damaged</option>
        <option ${itemData.Condition==="For Maintenance"?"selected":""}>For Maintenance</option>
        <option ${itemData.Condition==="For Replacement"?"selected":""}>For Replacement</option>
      </select>

      <button type="submit">💾 Save Changes</button>
      <button type="button" id="edit-cancel">Cancel</button>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector("#edit-cancel").addEventListener("click", () => overlay.remove());

  modal.querySelector("#edit-item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = modal.querySelector("#edit-name").value.trim();
    const newLab = modal.querySelector("#edit-lab").value;
    const newCondition = modal.querySelector("#edit-condition").value;

    if (!newName || !newLab || !newCondition) {
      alert("❌ Please fill all fields.");
      return;
    }

    try {
      await updateDoc(doc(db, "inventory", itemId), {
        Name: newName,
        Laboratory: newLab,
        Condition: newCondition
      });
      alert("✅ Item updated!");
      overlay.remove();
      fetchInventory();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update item.");
    }
  });
}

/* -------------------------
   Event Listeners
------------------------- */
document.getElementById("add-item-btn")?.addEventListener("click", showAddItemForm);
document.getElementById("trash-btn")?.addEventListener("click", showTrashModal);
fetchInventory();
