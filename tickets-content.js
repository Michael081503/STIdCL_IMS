// tickets-content.js (Converted to Firebase v10 modular SDK)
// Features:
// - All original ticket features preserved (pagination, admin flows, feedback, automate, etc.)
// - Multi-image upload using Firebase Storage (modular)
// - Save image URLs to Firestore as `imageUrls: []`
// - Click item name to view images modal (thumbnails) and click thumbnail -> lightbox
// - Uses your provided firebaseConfig (replace if needed)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js";

// --------------------------------------------------------
// Paste your firebaseConfig exactly as provided (you gave it earlier)
const firebaseConfig = {
  apiKey: "AIzaSyAw2rSjJ3f_S98dntbsyl9kyXvi9MC44Dw",
  authDomain: "fir-inventory-2e62a.firebaseapp.com",
  projectId: "fir-inventory-2e62a",
  storageBucket: "fir-inventory-2e62a.firebasestorage.app",
  messagingSenderId: "380849220480",
  appId: "1:380849220480:web:5a43b227bab9f9a197af65",
  measurementId: "G-ERT87GL4XC"
};
// --------------------------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Small helper to wait for element
function waitForElement(selector, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const start = Date.now();
    const iv = setInterval(() => {
      const found = document.querySelector(selector);
      if (found) {
        clearInterval(iv);
        resolve(found);
      } else if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error("Timed out waiting for " + selector));
      }
    }, 40);
  });
}

(async function initTicketsContent() {
  try {
    await waitForElement("#tc-ticketsTableBody");

    // DOM elements
    const ticketsTableBody = document.getElementById("tc-ticketsTableBody");
    const createTicketBtn = document.getElementById("tc-createTicketBtn");
    const modal = document.getElementById("tc-ticketModal");
    const closeModal = document.getElementById("tc-closeModal");
    const submitTicketBtn = document.getElementById("tc-submitTicketBtn");
    const ticketConcern = document.getElementById("tc-ticketConcern");

    ticketConcern.addEventListener("change", () => {
    if (ticketConcern.value.startsWith("Others")) {
      ticketDescription.focus();
      }
    });


    const ticketDescription = document.getElementById("tc-ticketDescription");
    const ticketItem = document.getElementById("tc-ticketItem");
    const ticketImagesInput = document.getElementById("tc-ticketImages"); // NEW file input
    const searchInput = document.getElementById("tc-searchInput");
    const prevPageBtn = document.getElementById("tc-prevPage");
    const nextPageBtn = document.getElementById("tc-nextPage");

    // feedback/description modals
    const viewFeedbackModal = document.getElementById("viewFeedbackModal");
    const closeViewFeedback = document.getElementById("closeViewFeedback");
    const feedbackTimeline = document.getElementById("feedbackTimeline");

    const viewDescriptionModal = document.getElementById("viewDescriptionModal");
    const closeViewDescription = document.getElementById("closeViewDescription");
    const fullDescriptionText = document.getElementById("fullDescriptionText");

    // review (admin) modal buttons
    const reviewModal = document.getElementById("reviewSubmissionModal");
    const closeReviewModal = document.getElementById("closeReviewModal");
    const markSolvedBtn = document.getElementById("markSolvedBtn");
    const markUnsolvedBtn = document.getElementById("markUnsolvedBtn");

    // Notifications
    function showToast(message) {
      let toastContainer = document.getElementById("toastContainer");
      if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toastContainer";
        toastContainer.style.position = "fixed";
        toastContainer.style.bottom = "20px";
        toastContainer.style.left = "20px";
        toastContainer.style.zIndex = "9999";
        document.body.appendChild(toastContainer);
      }

      const toast = document.createElement("div");
      toast.textContent = message;
      toast.style.background = "#2ecc71";
      toast.style.color = "white";
      toast.style.padding = "10px 16px";
      toast.style.marginTop = "10px";
      toast.style.borderRadius = "8px";
      toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      toast.style.fontSize = "14px";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";

      toastContainer.appendChild(toast);

      requestAnimationFrame(() => {
        toast.style.opacity = "1";
      });

      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 5000);
    }

    // image view modal & lightbox
    const viewImagesModal = document.getElementById("viewTicketImagesModal");
    const closeViewImagesModal = document.getElementById("closeViewImagesModal");
    const ticketImagesContainer = document.getElementById("ticketImagesContainer");
    const imageLightbox = document.getElementById("imageLightbox");
    const lightboxImage = document.getElementById("lightboxImage");

    const headerRow = document.getElementById("tc-headerRow");

    // Firestore collections (modular)
    const ticketsCollectionRef = collection(db, "tickets");
    const inventoryCollectionRef = collection(db, "inventory");
    const notificationsCollectionRef = collection(db, "notifications");

    // Helper functions using modular API
    async function getUserRole() {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        return userDoc.exists() ? userDoc.data().role : null;
      } catch (err) {
        console.warn("getUserRole error:", err);
        return null;
      }
    }

    async function getMaintenanceUsers() {
      try {
        const q = query(collection(db, "users"));
        const snap = await getDocs(q);
        // filter locally for role === "Maintenance"
        return snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.role === "Maintenance")
          .map(d => ({ id: d.id, name: `${d.firstName || ""} ${d.lastName || ""}`.trim() || d.email }));
      } catch (err) {
        console.error("getMaintenanceUsers error:", err);
        return [];
      }
    }

    async function getTickets() {
      try {
        const q = query(ticketsCollectionRef, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error("Error loading tickets:", err);
        return [];
      }
    }

    async function saveTicket(ticket) {
      const docRef = await addDoc(ticketsCollectionRef, ticket);
      return docRef.id;
    }

    async function deleteTicket(id) {
      await deleteDoc(doc(db, "tickets", id));
    }

    async function getInventoryItems() {
      try {
        const snap = await getDocs(inventoryCollectionRef);
        return snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.Name ?? d.id,
            lab: data.Laboratory ?? ""
          };
        });
      } catch (err) {
        console.error("Error fetching inventory items:", err);
        return [];
      }
    }

    let tickets = await getTickets();
    let filteredTickets = [...tickets];
    let currentPage = 1;
    const pageSize = 5;

    const currentRole = await getUserRole();
    let maintenanceUsers = [];

    if (currentRole === "Admin") {
      maintenanceUsers = await getMaintenanceUsers();
      const feedbackTh = [...headerRow.children].find(th => th.textContent.trim() === "Feedback");
      if (feedbackTh) feedbackTh.remove();
      const handlerTh = document.createElement("th");
      handlerTh.textContent = "Handler";
      headerRow.appendChild(handlerTh);
    }

    function paginate(array, pageNumber, size) {
      const start = (pageNumber - 1) * size;
      return array.slice(start, start + size);
    }

    function escapeHtml(s = "") {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function shortenId(id = "") {
      return id.slice(-5);
    }
    
    // ====== Handle Save Deadline Modal ======
    const deadlineModal = document.getElementById("setDeadlineModal");
    const closeDeadlineModal = document.getElementById("closeDeadlineModal");
    const saveDeadlineBtn = document.getElementById("saveDeadlineBtn");

    if (saveDeadlineBtn && deadlineModal) {
      saveDeadlineBtn.addEventListener("click", async () => {
        const ticketId = deadlineModal.dataset.ticketId;
        const userId = deadlineModal.dataset.userId;
        const userName = deadlineModal.dataset.userName;
        const deadlineDate = document.getElementById("deadlineDate").value;
        const note = document.getElementById("deadlineNote").value.trim();

        if (!ticketId || !userId) {
          alert("Missing ticket or handler information.");
          return;
        }

        try {
          // Update Firestore ticket
          await updateDoc(doc(db, "tickets", ticketId), {
            assignedTo: userId,
            assignedToName: userName,
            deadline: deadlineDate ? Timestamp.fromDate(new Date(deadlineDate)) : null,
            assignmentNote: note || "",
            status: "Assigned",
          });

          // Add notification for the maintenance user
          await addDoc(collection(db, "notifications"), {
            message: `Ticket assigned to ${userName} (${userId})`,
            ticketId,
            createdAt: serverTimestamp(),
            type: "assignment",
          });

          alert("Handler assigned successfully!");
          deadlineModal.style.display = "none";
          deadlineModal.setAttribute("aria-hidden", "true");

          // refresh list
          tickets = await getTickets();
          filteredTickets = [...tickets];
          renderTickets();
        } catch (err) {
          console.error("Failed to save deadline:", err);
          alert("Failed to assign handler. Please try again.");
        }
      });
    }

    if (closeDeadlineModal && deadlineModal) {
      closeDeadlineModal.addEventListener("click", () => {
        deadlineModal.style.display = "none";
        deadlineModal.setAttribute("aria-hidden", "true");
      });
    }

    // Render tickets into table (keeps existing layout but item is clickable to view images)
    function renderTickets() {
      ticketsTableBody.innerHTML = "";
      const pageTickets = paginate(filteredTickets, currentPage, pageSize);

      pageTickets.forEach((t, index) => {
        const tr = document.createElement("tr");
        const createdAtValue = t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : "";
        tr.dataset.createdAt = createdAtValue;

        const statusClass = "status-" + (t.status || "pending").toLowerCase();
        const desc = t.description || "";
        const showButton = desc.length > 80;

        let assignColumn = "";
        if (currentRole === "Admin") {
          if (t.status === "Review" && t.assignedToName) {
            assignColumn = `
              <td>
                <span class="handler-clickable" data-id="${t.id}" data-user="${t.assignedToName}">
                  ${t.assignedToName}
                </span>
              </td>`;
          } else if (t.status === "Solved" && t.assignedToName) {
            assignColumn = `
              <td>
                <span class="handler-name">${t.assignedToName}</span>
              </td>`;
          } else {
            // 🧩 Handler assignment column logic for Admin
            const assignedTo = t.assignedToName || "Unassigned";
            const isDisabled =
              t.status &&
              ["Assigned", "Urgent", "Review", "Solved"].includes(t.status);

            assignColumn = `
              <td>
                <select class="assign-select" data-id="${t.id}" ${
                  isDisabled ? "disabled title='Handler already assigned'" : ""
                }>
                  <option value="">${assignedTo}</option>
                  ${maintenanceUsers
                    .map(
                      (u) =>
                        `<option value="${u.id}" ${
                          u.name === assignedTo ? "selected" : ""
                        }>${u.name}</option>`
                    )
                    .join("")}
                </select>
              </td>`;
          }
        }

        // item cell clickable to open images modal
        tr.innerHTML = `
          <td>${shortenId(t.id)}</td>
          <td><span class="ticket-item-link" data-id="${t.id}" style="color:#2563eb;cursor:pointer;text-decoration:underline;">${escapeHtml(t.item)}</span></td>
          <td>${escapeHtml(t.concern)}</td>
          <td class="ticket-description" style="text-align:center;">
            <button class="note-btn" data-desc="${escapeHtml(desc)}">📝 View Note</button>
          </td>
          <td>
            <span class="status-badge ${statusClass}" 
              data-id="${t.id}" 
              data-status="${t.status}">
              ${escapeHtml(t.status)}
            </span>
          </td>
          <td><button class="btn-delete" data-index="${index}" title="Delete Ticket">Delete</button></td>
          ${
            currentRole === "Admin"
              ? assignColumn
              : `<td><button class="btn-feedback" data-id="${t.id}">View Feedback</button></td>`
          }
        `;
        ticketsTableBody.appendChild(tr);
      });

      // Admin handler select
      if (currentRole === "Admin") {
        ticketsTableBody.querySelectorAll(".assign-select").forEach(select => {
          select.addEventListener("change", async (e) => {
            const ticketId = e.target.dataset.id;
            const selectedId = e.target.value;
            if (!selectedId) return;
            const selectedUser = maintenanceUsers.find(u => u.id === selectedId);
            if (!selectedUser) return;
            const modalEl = document.getElementById("setDeadlineModal");
            modalEl.style.display = "flex";
            modalEl.dataset.ticketId = ticketId;
            modalEl.dataset.userId = selectedId;
            modalEl.dataset.userName = selectedUser.name;
          });
        });

        // handler-clickable
        document.querySelectorAll(".handler-clickable").forEach((el) => {
          el.addEventListener("click", () => {
            const ticketId = el.dataset.id;
            const submittedBy = el.dataset.user;
            const modalEl = document.getElementById("reviewSubmissionModal");
            modalEl.dataset.ticketId = ticketId;
            document.getElementById("submittedByName").textContent = submittedBy;
            modalEl.style.display = "flex";
          });
        });
      }

      // Status badge click (Admin)
      if (currentRole === "Admin") {
        const statusModal = document.getElementById("statusModal");
        const closeStatusModal = document.getElementById("closeStatusModal");
        const markUrgentBtn = document.getElementById("markUrgentBtn");

        ticketsTableBody.querySelectorAll(".status-badge").forEach((badge) => {
          badge.addEventListener("click", () => {
            const ticketId = badge.dataset.id;
            const status = badge.dataset.status;
            if (status === "Assigned") {
              statusModal.style.display = "flex";
              statusModal.dataset.ticketId = ticketId;
            }
          });
        });

        closeStatusModal.addEventListener("click", () => {
          statusModal.style.display = "none";
        });

        markUrgentBtn.addEventListener("click", async () => {
          const ticketId = statusModal.dataset.ticketId;
          if (!ticketId) return;
          try {
            await updateDoc(doc(db, "tickets", ticketId), { status: "Urgent" });
            alert("🚨 Ticket marked as Urgent!");
            statusModal.style.display = "none";
            tickets = await getTickets();
            filteredTickets = [...tickets];
            renderTickets();
          } catch (err) {
            console.error("Failed to mark urgent:", err);
            alert("Failed to update status.");
          }
        });
      }

      // Delete buttons
      ticketsTableBody.querySelectorAll(".btn-delete").forEach((btn, idx) => {
        btn.addEventListener("click", () =>
          onDeleteTicket((currentPage - 1) * pageSize + idx)
        );
      });

      // Feedback buttons for non-admins
      if (currentRole !== "Admin") {
        ticketsTableBody.querySelectorAll(".btn-feedback").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const ticketId = btn.dataset.id;
            const docSnap = await getDoc(doc(db, "tickets", ticketId));
            const history = docSnap.exists() ? docSnap.data().feedbackHistory || [] : [];
            feedbackTimeline.innerHTML = history.length
              ? history.map(f => `
                <div class="feedback-entry">
                  <strong>${escapeHtml(f.admin)}</strong>
                  <span class="date">${f.timestamp?.toDate?.().toLocaleString() || ""}</span>
                  <p>${escapeHtml(f.message)}</p>
                </div>`).join("")
              : "<p>No feedback yet.</p>";
            viewFeedbackModal.style.display = "flex";
            viewFeedbackModal.setAttribute("aria-hidden", "false");
          });
        });
      }

      // Description view buttons
      ticketsTableBody.querySelectorAll(".note-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest("tr");
        if (!row) return;

        const shortId = row.cells[0]?.textContent.trim();
        const ticket = tickets.find(t => t.id.endsWith(shortId));
        const desc = ticket?.description || "No description available.";
        const submitter = ticket?.issuedBy || "Unknown user";

        fullDescriptionText.innerHTML = `
    Submitted by: ${submitter}
    
    ${desc}
        `;
        fullDescriptionText.style.whiteSpace = "pre-line";
        fullDescriptionText.style.fontFamily = "inherit";
        fullDescriptionText.style.fontSize = "0.95rem";
        fullDescriptionText.style.color = "#222";

        viewDescriptionModal.style.display = "flex";
        viewDescriptionModal.setAttribute("aria-hidden", "false");
      });
    });



      prevPageBtn.disabled = currentPage === 1;
      nextPageBtn.disabled = currentPage * pageSize >= filteredTickets.length;
    }


    // -----------------------------
    // Review modal status update
    // -----------------------------
    async function updateReviewStatus(ticketId, newStatus) {
      if (!ticketId) return;
      try {
        await updateDoc(doc(db, "tickets", ticketId), { status: newStatus });
        alert(`✅ Ticket marked as ${newStatus}!`);
        if (reviewModal) reviewModal.style.display = "none";

        // refresh local state and UI
        tickets = await getTickets();
        filteredTickets = [...tickets];
        renderTickets();
      } catch (err) {
        console.error("Failed to update review status:", err);
        alert("Failed to update ticket status. See console for details.");
      }
    }

    if (closeReviewModal && reviewModal) {
      closeReviewModal.addEventListener("click", () => (reviewModal.style.display = "none"));
    }

    if (markSolvedBtn && markUnsolvedBtn && reviewModal) {
      markSolvedBtn.addEventListener("click", () => {
        const ticketId = reviewModal.dataset.ticketId;
        updateReviewStatus(ticketId, "Solved");
      });
      markUnsolvedBtn.addEventListener("click", () => {
        const ticketId = reviewModal.dataset.ticketId;
        updateReviewStatus(ticketId, "Unsolved");
      });
    }

    // Search
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      filteredTickets = tickets.filter(
        (t) =>
          (t.id && t.id.toLowerCase().includes(q)) ||
          (t.item && t.item.toLowerCase().includes(q)) ||
          (t.concern && t.concern.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.status && t.status.toLowerCase().includes(q))
      );
      currentPage = 1;
      renderTickets();
    });

    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTickets();
      }
    });

    nextPageBtn.addEventListener("click", () => {
      if (currentPage * pageSize < filteredTickets.length) {
        currentPage++;
        renderTickets();
      }
    });

    async function onDeleteTicket(index) {
      const ticketToDelete = filteredTickets[index];
      if (!ticketToDelete) return;
      if (confirm("Are you sure you want to delete this ticket?")) {
        try {
          await deleteTicket(ticketToDelete.id);
          tickets = tickets.filter((t) => t.id !== ticketToDelete.id);
          filteredTickets = [...tickets];
          renderTickets();
        } catch (err) {
          console.error("delete ticket error:", err);
          alert("Failed to delete ticket. Please try again.");
        }
      }
    }

    // create ticket modal open
    createTicketBtn.addEventListener("click", async () => {
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");

      ticketConcern.value = "";
      ticketDescription.value = "";
      selectedItemId = null;
      selectedItemName = null;

      document.getElementById("tc-selectedItemLabel").textContent = "No item selected";
      document.getElementById("tc-selectedItemLabel").style.color = "#2563eb";
      submitTicketBtn.textContent = "Submit";
      if (ticketImagesInput) ticketImagesInput.value = "";
    });


    // close create modal
    closeModal.addEventListener("click", () => {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    });

    // click outside to close modals (some)
    window.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
      }
      if (e.target === viewDescriptionModal) {
        viewDescriptionModal.style.display = "none";
        viewDescriptionModal.setAttribute("aria-hidden", "true");
      }
    });
    // =============================
    // ITEM SELECTION MODAL
    // =============================
    let selectedItemId = null;
    let selectedItemName = null;

    function showItemSelectionModal(items) {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.style.zIndex = "9999";

      const modal = document.createElement("div");
      modal.className = "modal modal--medium";
      modal.style.zIndex = "10000";
      //modal.style.maxWidth = "700px";
      modal.innerHTML = `
        <h2 style="text-align:center; color:#2D3E50; margin-bottom:5px;">Select an Inventory Item</h2>
        <p style="text-align:center; color:#6b7280; font-size:0.9rem; margin-bottom:15px;">
          Hover on items to see item ID
        </p>
        <div id="item-select-container" class="item-select-container"></div>
        <div style="text-align:center; margin-top:20px;">
          <button id="close-item-select" class="cancel-btn">Close</button>
        </div>
      `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const container = modal.querySelector("#item-select-container");

      const grouped = {};
      items.forEach(item => {
        const lab = item.lab || "Unassigned";
        if (!grouped[lab]) grouped[lab] = [];
        grouped[lab].push(item);
      });

      for (const [lab, groupItems] of Object.entries(grouped)) {
        const section = document.createElement("div");
        section.className = "item-group";

        const labHeader = document.createElement("h3");
        labHeader.textContent = lab;
        labHeader.className = "item-group-title";
        section.appendChild(labHeader);

        const grid = document.createElement("div");
        grid.className = "item-grid";

        groupItems.forEach(it => {
          const card = document.createElement("button");
          card.className = "item-card";
          card.textContent = it.name;
          card.title = `Item ID: ${it.id}`;
          card.addEventListener("click", () => {
            selectedItemId = it.id;
            selectedItemName = it.name;
            const shortId = it.id.slice(-5);
            const label = document.getElementById("tc-selectedItemLabel");
            label.textContent = `${it.name} (Item ID: ${shortId})`;
            label.style.color = "#111";
            overlay.remove();
          });
          grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);
      }

      modal.querySelector("#close-item-select").addEventListener("click", () => overlay.remove());
    }


    // Bind button to open item modal
    const selectItemBtn = document.getElementById("tc-selectItemBtn");
if (selectItemBtn) {
  selectItemBtn.addEventListener("click", async () => {
    try {
      const items = await getInventoryItems();
      if (!items || items.length === 0) {
        alert("No inventory items found.");
        return;
      }
      showItemSelectionModal(items);
    } catch (err) {
      console.error("Failed to load items:", err);
      alert("Error loading items. See console for details.");
    }
  });
} else {
  console.warn("⚠️ Select Item button not found in DOM yet.");
}


    // ========== Submit Ticket (with multi-image upload) ==========
    submitTicketBtn.addEventListener("click", async () => {
      const concern = ticketConcern.value.trim();
      const description = ticketDescription.value.trim();
      if (!concern || !description || !selectedItemId || !selectedItemName) {
        alert("Please fill in all fields, including selecting an item.");
        return;
      }
      const itemId = selectedItemId;
      const itemName = selectedItemName;


      const currentUser = auth.currentUser;
      let role = "User";
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          role = userDoc.exists() ? userDoc.data().role : "User";
        } catch (err) {
          console.warn("Could not determine user role:", err);
        }
      }

      const newTicket = {
        item: itemName,
        itemId,
        concern,
        description,
        status: "Pending",
        feedbackHistory: [],
        createdAt: serverTimestamp(),
        issuedBy: currentUser?.email || "Unknown user",
        issuedById: currentUser?.uid || null,
        createdByRole: role,
      };

      try {
        showToast("✅ Ticket created successfully!");
        // save ticket doc
        const newId = await saveTicket(newTicket);

        // handle file uploads if any
        if (ticketImagesInput && ticketImagesInput.files && ticketImagesInput.files.length > 0) {
          const files = Array.from(ticketImagesInput.files);
          const uploadPromises = files.map(async (file) => {
            const path = `ticket_images/${newId}/${Date.now()}_${file.name}`;
            const sRef = storageRef(storage, path);
            const snap = await uploadBytes(sRef, file);
            // get download URL
            const url = await getDownloadURL(snap.ref);
            return url;
          });

          const urls = await Promise.all(uploadPromises);
          try {
            await updateDoc(doc(db, "tickets", newId), { imageUrls: urls });
          } catch (err) {
            console.error("Failed to save imageUrls to ticket doc:", err);
          }
        }

        // add a notification document (best-effort)
        try {
          await addDoc(notificationsCollectionRef, {
            message: `${newTicket.issuedBy} issued a ticket regarding ${itemName}`,
            itemName,
            issuedBy: newTicket.issuedBy,
            createdAt: serverTimestamp(),
            createdByRole: role,
          });
        } catch (err) {
          console.warn("Failed to create notification:", err);
        }

        // update UI
        newTicket.id = newId;
        tickets.unshift(newTicket);
        filteredTickets = [...tickets];
        currentPage = 1;
        renderTickets();

        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        if (ticketImagesInput) ticketImagesInput.value = "";
      } catch (err) {
        console.error("Ticket save failed:", err);
        alert("Failed to save ticket. Please try again.");
      }
    });
    // ===============================================================

    // Close feedback & description modals
    closeViewFeedback.addEventListener("click", () => {
      viewFeedbackModal.style.display = "none";
      viewFeedbackModal.setAttribute("aria-hidden", "true");
    });

    closeViewDescription.addEventListener("click", () => {
      viewDescriptionModal.style.display = "none";
      viewDescriptionModal.setAttribute("aria-hidden", "true");
    });

    // ========== Image viewing modal & lightbox logic ==========
    // Open the "Attached Images" modal when clicking the item name (ticket-item-link)
    ticketsTableBody.addEventListener("click", async (e) => {
      const el = e.target;
      if (!el) return;
      if (el.classList && el.classList.contains("ticket-item-link")) {
        const ticketId = el.dataset.id;
        if (!ticketId) return;
        try {
          const docSnap = await getDoc(doc(db, "tickets", ticketId));
          const data = docSnap.exists() ? docSnap.data() : null;
          const images = (data && data.imageUrls) ? data.imageUrls : [];
          if (ticketImagesContainer) {
            if (!images || images.length === 0) {
              ticketImagesContainer.innerHTML = "<p>No images attached.</p>";
            } else {
              ticketImagesContainer.innerHTML = images.map(url => {
                // small thumbnail markup; class used for click listener
                return `<img src="${url}" class="ticket-thumb" alt="attachment" style="width:100px;height:100px;object-fit:cover;border-radius:8px;cursor:pointer;margin:6px;" />`;
              }).join("");
            }
          }
          if (viewImagesModal) {
            viewImagesModal.style.display = "flex";
            viewImagesModal.setAttribute("aria-hidden", "false");
          }
        } catch (err) {
          console.error("Failed to load ticket images:", err);
          alert("Failed to load images for this ticket.");
        }
      }
    });

    // click thumbnail -> open lightbox
    if (ticketImagesContainer && imageLightbox && lightboxImage) {
      ticketImagesContainer.addEventListener("click", (e) => {
        const target = e.target;
        if (!target) return;
        if (target.tagName === "IMG" && target.classList.contains("ticket-thumb")) {
          const src = target.src;
          if (!src) return;
          lightboxImage.src = src;
          imageLightbox.style.display = "flex";
          imageLightbox.setAttribute("aria-hidden", "false");
        }
      });

      // close lightbox when clicked anywhere
      imageLightbox.addEventListener("click", () => {
        imageLightbox.style.display = "none";
        imageLightbox.setAttribute("aria-hidden", "true");
        lightboxImage.src = "";
      });
    }

    // close images modal
    if (closeViewImagesModal && viewImagesModal) {
      closeViewImagesModal.addEventListener("click", () => {
        viewImagesModal.style.display = "none";
        viewImagesModal.setAttribute("aria-hidden", "true");
      });
    }
    // ===============================================================

    // INITIAL render
    renderTickets();
  } catch (err) {
    console.error("tickets-content init error:", err);
  }
})();

// ==================================================
// =                    AUTOMATE                    =
// ==================================================
window.showTicketsAutomateModal = function () {
  const existing = document.getElementById('tickets-automate-overlay');
  if (existing) existing.remove();

  const tableBody = document.getElementById('tc-ticketsTableBody');
  if (!tableBody) {
    alert('No ticket data found.');
    return;
  }

  const rows = Array.from(tableBody.querySelectorAll('tr'));
  const total = rows.length;
  let pending = 0, assigned = 0, urgent = 0, solved = 0, unsolved = 0, review = 0;

  rows.forEach(row => {
    const badge = row.querySelector('.status-badge');
    if (!badge) return;
    const s = badge.textContent.trim().toLowerCase();
    if (s.includes('pending')) pending++;
    else if (s.includes('assigned')) assigned++;
    else if (s.includes('urgent')) urgent++;
    else if (s.includes('solved')) solved++;
    else if (s.includes('unsolved')) unsolved++;
    else if (s.includes('review')) review++;
  });

  const summaryHTML = `
    As of this moment, there are a total of <strong>${total}</strong> <u>tickets</u> currently listed in the system. 
    Out of these, <strong>${pending}</strong> are still <u>pending</u>, 
    <strong>${assigned}</strong> have been <u>assigned</u>, 
    and <strong>${urgent}</strong> are flagged as <u>urgent</u>. 
    Meanwhile, <strong>${solved}</strong> have already been <u>resolved</u>, 
    <strong>${unsolved}</strong> remain <u>unsolved</u>, and 
    <strong>${review}</strong> are currently under <u>review</u>. 
    This provides administrators with a clear snapshot of the current ticket distribution and workload.
  `.replace(/\s+/g, ' ').trim();

  // create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'tickets-automate-overlay';
  overlay.className = 'tc-modal';
  overlay.style.display = 'flex';

  const content = document.createElement('div');
  content.className = 'tc-modal__content';
  content.innerHTML = `
    <h3 style="text-align:center; font-weight:600;">🤖 Automated Tickets Summary</h3>
    <div id="tickets-automate-text" style="font-size:15px; line-height:1.6; text-align:justify; color:#111;"></div>
    <div id="tickets-qa-container" style="margin-top:15px; font-size:15px; line-height:1.6; text-align:justify;"></div>
    <div id="tickets-automate-qa" style="margin-top:20px; display:none;">
      <input id="tickets-qa-input" type="text" placeholder="Ask something..." 
        style="padding:8px; width:70%; border-radius:6px; border:1px solid #ccc; font-size:0.9rem;">
      <button id="tickets-qa-btn" class="ask-btn">
        <span class="btn-text">Ask</span>
        <span class="spinner" style="display:none;"></span>
      </button>
    </div>
    <div style="text-align:center; margin-top:20px;">
      <button id="close-tickets-automate-btn" class="close-automate-btn">Close</button>
    </div>
  `;
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // helper: try to extract createdAt string from a row (many fallbacks)
  function extractCreatedAtFromRow(row) {
    if (row.dataset && row.dataset.createdAt) return row.dataset.createdAt;

    const byData = row.querySelector('[data-createdat], [data-created-at]');
    if (byData) {
      return byData.dataset.createdat || byData.dataset['createdAt'] || byData.dataset['created-at'] || byData.textContent.trim();
    }

    const byClass = row.querySelector('.created-at');
    if (byClass) return byClass.textContent.trim();

    const text = row.textContent || '';
    const isoMatch = text.match(/\d{4}-\d{2}-\d{2}T?\d{0,2}:?\d{0,2}:?\d{0,2}Z?/);
    if (isoMatch) return isoMatch[0];

    const readableMatch = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?/i);
    if (readableMatch) return readableMatch[0];

    const slashMatch = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/);
    if (slashMatch) return slashMatch[0];

    return null;
  }

  function parseMaybeDate(str) {
    if (!str) return null;
    try {
      const d = new Date(str);
      if (isNaN(d)) return null;
      return d;
    } catch {
      return null;
    }
  }

  function typeText(element, htmlText, speed = 22, onComplete) {
    document.querySelectorAll('.typing-cursor').forEach(c => c.remove());
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    cursor.textContent = '|';
    cursor.style.display = 'inline-block';
    cursor.style.marginLeft = '3px';
    cursor.style.color = '#111';
    element.appendChild(cursor);

    function typeStep() {
      if (i >= htmlText.length) {
        cursor.classList.add('blink-tickets');
        if (onComplete) onComplete();
        return;
      }
      i++;
      const upto = (() => {
        const partial = htmlText.slice(0, i);
        const lastOpen = partial.lastIndexOf('<');
        const lastClose = partial.lastIndexOf('>');
        if (lastOpen > lastClose) {
          const nextClose = htmlText.indexOf('>', i);
          return nextClose === -1 ? htmlText.length : nextClose + 1;
        }
        return i;
      })();
      element.innerHTML = htmlText.substring(0, upto);
      element.appendChild(cursor);
      i = upto;
      setTimeout(typeStep, speed);
    }
    typeStep();
  }

  // type summary
  const textEl = document.getElementById('tickets-automate-text');
  typeText(textEl, summaryHTML, 22, () => {
    document.getElementById('tickets-automate-qa').style.display = 'block';
  });

  // Q&A handler
  document.getElementById('tickets-qa-btn').addEventListener('click', () => {
    const inputEl = document.getElementById('tickets-qa-input');
    const btnEl = document.getElementById('tickets-qa-btn');
    const spinner = btnEl.querySelector('.spinner');
    const btnText = btnEl.querySelector('.btn-text');

    const question = inputEl.value.trim();
    if (!question) return;

    // disable while processing
    inputEl.disabled = true;
    btnEl.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.style.display = 'none';

    const qaContainer = document.getElementById('tickets-qa-container');

    // append question block
    const qBlock = document.createElement('div');
    qBlock.style.marginTop = '15px';
    qBlock.innerHTML = `<strong>Q:</strong> ${escapeHtml(question)}`;
    qaContainer.appendChild(qBlock);

    // prepare answer block
    const aBlock = document.createElement('div');
    aBlock.style.marginTop = '5px';
    aBlock.style.fontSize = '15px';
    aBlock.style.lineHeight = '1.6';
    qaContainer.appendChild(aBlock);

    let answerText = `<em>Please ask questions related to this page only like "most recently created tickets", "oldest ticket", or "most reported ticket" information.</em>`;
    const qLower = question.toLowerCase();

    //  1. Most reported item
    if (qLower.includes('most') && qLower.includes('report')) {
      const counts = {};
      const itemReports = {};

      rows.forEach(row => {
        const itemCell = row.cells[1];
        const itemName = itemCell ? itemCell.textContent.trim() : null;
        if (!itemName) return;
        counts[itemName] = (counts[itemName] || 0) + 1;
        if (!itemReports[itemName]) itemReports[itemName] = [];
        itemReports[itemName].push(row);
      });

      let maxItem = null;
      let maxCount = 0;
      for (const [name, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxItem = name;
          maxCount = count;
        }
      }

      if (maxItem) {
        const reportRows = itemReports[maxItem];
        const rowsWithDates = reportRows.map(r => {
          const raw = extractCreatedAtFromRow(r);
          return { row: r, rawDateStr: raw, parsed: parseMaybeDate(raw) };
        });
        const withParsed = rowsWithDates.filter(e => e.parsed);
        let latestEntry;
        if (withParsed.length) {
          withParsed.sort((a, b) => b.parsed - a.parsed);
          latestEntry = withParsed[0];
        } else {
          const lastRow = reportRows[reportRows.length - 1];
          latestEntry = { row: lastRow, rawDateStr: extractCreatedAtFromRow(lastRow), parsed: null };
        }

        const latestRow = latestEntry.row;
        const descEl = latestRow.querySelector('.ticket-description');
        const latestDesc = descEl ? descEl.textContent.trim() : (latestRow.cells[2] ? latestRow.cells[2].textContent.trim() : 'No description available');
        const idCell = latestRow.cells[0];
        const itemId = idCell ? idCell.textContent.trim() : 'N/A';
        const latestDateStr = latestEntry.parsed ? latestEntry.parsed.toLocaleString() : (latestEntry.rawDateStr || 'date unavailable');

        answerText = `
          The current item with the most reports is
          <strong>${escapeHtml(maxItem)}</strong> (ID: <u>${escapeHtml(itemId)}</u>),
          with <strong>${maxCount}</strong> reports.
          The most recent report describes: "<em>${escapeHtml(latestDesc)}</em>",
          which was issued last on <strong>${escapeHtml(String(latestDateStr))}</strong>.
        `.replace(/\s+/g, ' ').trim();
      } else {
        answerText = `<em>No item reports found.</em>`;
      }
    }

    //  2. Most recently created ticket
    else if (qLower.includes('most') && qLower.includes('recent')) {
      const rowsWithDates = rows
        .map(r => ({
          row: r,
          parsed: parseMaybeDate(extractCreatedAtFromRow(r))
        }))
        .filter(e => e.parsed);

      if (rowsWithDates.length > 0) {
        rowsWithDates.sort((a, b) => b.parsed - a.parsed);
        const newest = rowsWithDates[0].row;
        const dateStr = rowsWithDates[0].parsed.toLocaleString();
        const id = newest.cells[0]?.textContent.trim() || 'N/A';
        const item = newest.cells[1]?.textContent.trim() || 'N/A';
        const status = newest.querySelector('.status-badge')?.textContent.trim() || 'N/A';

        answerText = `
          The most recently created ticket is
          <strong>ID: <u>${escapeHtml(id)}</u></strong> for
          <strong>${escapeHtml(item)}</strong>,
          issued on <strong>${escapeHtml(dateStr)}</strong>.
          Its current status is <strong>${escapeHtml(status)}</strong>.
        `.replace(/\s+/g, ' ').trim();
      } else {
        answerText = `<em>No valid ticket creation dates found.</em>`;
      }
    }

    //  3. Oldest ticket
    else if (qLower.includes('oldest')) {
      const rowsWithDates = rows
        .map(r => ({
          row: r,
          parsed: parseMaybeDate(extractCreatedAtFromRow(r))
        }))
        .filter(e => e.parsed);

      if (rowsWithDates.length > 0) {
        rowsWithDates.sort((a, b) => a.parsed - b.parsed);
        const oldest = rowsWithDates[0].row;
        const dateStr = rowsWithDates[0].parsed.toLocaleString();
        const id = oldest.cells[0]?.textContent.trim() || 'N/A';
        const item = oldest.cells[1]?.textContent.trim() || 'N/A';
        const status = oldest.querySelector('.status-badge')?.textContent.trim() || 'N/A';

        answerText = `
          The oldest ticket is
          <strong>ID: <u>${escapeHtml(id)}</u></strong> for
          <strong>${escapeHtml(item)}</strong>,
          issued on <strong>${escapeHtml(dateStr)}</strong>.
          Its current status is <strong>${escapeHtml(status)}</strong>.
        `.replace(/\s+/g, ' ').trim();
      } else {
        answerText = `<em>No valid ticket creation dates found.</em>`;
      }
    }

    typeText(aBlock, `<strong>A:</strong> ${answerText}`, 20, () => {
      inputEl.disabled = false;
      btnEl.disabled = false;
      spinner.style.display = 'none';
      btnText.style.display = 'inline';
      inputEl.value = '';
      inputEl.focus();
    });

    setTimeout(() => {
      aBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 600);
  });

  // ==================== Styles ====================
  if (!document.getElementById('tickets-automate-blink-style')) {
    const s = document.createElement('style');
    s.id = 'tickets-automate-blink-style';
    s.innerHTML = `
      @keyframes blink-caret { 50% { opacity: 0; } }
      .blink-tickets { animation: blink-caret 0.8s steps(1) infinite; }

      .close-automate-btn {
        background-color: #2D3E50;
        color: #fff;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: transform 0.15s ease, background-color 0.2s ease;
      }
      .close-automate-btn:hover { 
        transform: scale(1.05);
        background-color: #3a506b;
      }

      .ask-btn {
        background-color: #2D3E50;    /* 🔹 Same as close button */
        color: #fff;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 600;
        transition: transform 0.15s ease, background-color 0.2s ease;
      }
      .ask-btn:hover {
        transform: scale(1.05);
        background-color: #3a506b;   /* 🔹 Same hover color */
      }

      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #fff;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(s);
  }

  // ==================== Close ====================
  document.getElementById('close-tickets-automate-btn').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  });

  document.body.style.overflow = 'hidden';

  function escapeHtml(str) {
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
};

// ==================== FAQS HANDLER ====================
document.querySelectorAll(".faq-question").forEach((btn) => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".faq-item");
    const answer = item.querySelector(".faq-answer");
    const icon = btn.querySelector(".faq-icon");
    answer.classList.toggle("open");
    if (answer.classList.contains("open")) {
      icon.textContent = "−";
      answer.style.maxHeight = answer.scrollHeight + "px";
    } else {
      icon.textContent = "+";
      answer.style.maxHeight = null;
    }
  });
});
