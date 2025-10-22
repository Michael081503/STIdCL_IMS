// =============================
// 🧰 TASKS PAGE JS (with Maintenance Due Dates Table + Item Modal)
// =============================
(async function initTasksPage() {
  const auth = firebase.auth();
  const db = firebase.firestore();
  const ticketsCollection = db.collection("tickets");
  const inventoryCollection = db.collection("inventory");

  const tasksTableBody = document.getElementById("tasksTableBody");
  const loadingText = document.getElementById("loadingText");

  // ==============================
  // Create Note Modal
  // ==============================
  const noteModal = document.createElement("div");
  noteModal.className = "tc-modal";
  noteModal.id = "viewNoteModal";
  noteModal.innerHTML = `
    <div class="tc-modal__content">
      <button id="closeNoteModal" class="tc-modal__close">&times;</button>
      <h3>Assignment Note</h3>
      <p id="noteText"></p>
    </div>
  `;
  document.body.appendChild(noteModal);

  document
    .getElementById("closeNoteModal")
    .addEventListener("click", () => (noteModal.style.display = "none"));

  // ==============================
  // Create Submit Confirmation Modal
  // ==============================
  let submitModal = document.getElementById("submitConfirmModal");
  if (!submitModal) {
    submitModal = document.createElement("div");
    submitModal.className = "tc-modal";
    submitModal.id = "submitConfirmModal";
    submitModal.innerHTML = `
      <div class="tc-modal__content">
        <h3>Submit Task for Review</h3>
        <p>Are you sure you want to mark this task as completed for review?</p>
        <div class="modal-actions">
          <button id="confirmSubmitBtn" class="confirm-btn">Yes, Submit</button>
          <button id="cancelSubmitBtn" class="cancel-btn">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(submitModal);

    document
      .getElementById("cancelSubmitBtn")
      .addEventListener("click", () => (submitModal.style.display = "none"));
  }

  // ==============================
  // Firebase Auth & User Role Initialization
  // ==============================
  let currentSubmitTicketId = null;

  try {
    if (loadingText) {
      loadingText.style.display = "block";
      loadingText.textContent = "Loading your tasks...";
    }

    const user = await new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged((u) => {
        unsub();
        resolve(u);
      });
    });

    if (!user) {
      if (loadingText) {
        loadingText.style.display = "block";
        loadingText.textContent = "Please log in to view your tasks.";
      }
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    const role = userDoc.exists ? userDoc.data().role : null;

    if (role !== "Maintenance") {
      if (loadingText) {
        loadingText.style.display = "block";
        loadingText.textContent = "You must be a maintenance user to view tasks.";
      }
      return;
    }

    // ==============================
    // My Assigned Tasks Table
    // ==============================
    ticketsCollection
      .where("assignedTo", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        tasksTableBody.innerHTML = "";

        if (loadingText) loadingText.style.display = "none";

        if (snapshot.empty) {
          tasksTableBody.innerHTML = `
            <tr>
              <td colspan="8" class="empty-placeholder">No tasks assigned yet.</td>
            </tr>`;
          return;
        }

        const thead = tasksTableBody.closest("table").querySelector("thead tr");
        if (
          thead &&
          ![...thead.children].some((th) => th.textContent === "Actions")
        ) {
          const th = document.createElement("th");
          th.textContent = "Actions";
          thead.appendChild(th);
        }

        snapshot.forEach((doc) => {
          const t = doc.data();
          let deadline = "Not set";
          if (t.deadline) {
            try {
              if (t.deadline.toDate && typeof t.deadline.toDate === "function") {
                deadline = t.deadline.toDate().toLocaleDateString();
              } else if (typeof t.deadline === "string" && !isNaN(Date.parse(t.deadline))) {
                deadline = new Date(t.deadline).toLocaleDateString();
              }
            } catch (err) {
              console.warn("Invalid deadline format:", t.deadline);
              deadline = "Invalid";
            }
          }

          const note = t.assignmentNote || t.note || null;
          const description = t.description || "—";
          const status = (t.status || "Pending").trim();
          const normalizedStatus = status.toLowerCase();

          let badgeClass = "status-badge default";
          if (normalizedStatus.includes("pending"))
            badgeClass = "status-badge pending";
          else if (normalizedStatus.includes("assigned"))
            badgeClass = "status-badge assigned";
          else if (normalizedStatus.includes("progress"))
            badgeClass = "status-badge in-progress";
          else if (normalizedStatus.includes("review"))
            badgeClass = "status-badge review";
          else if (normalizedStatus.includes("solved"))
            badgeClass = "status-badge solved";
          else if (normalizedStatus.includes("unsolved"))
            badgeClass = "status-badge unsolved";
          else if (normalizedStatus.includes("completed"))
            badgeClass = "status-badge completed";
          else if (normalizedStatus.includes("closed"))
            badgeClass = "status-badge closed";
          else if (normalizedStatus.includes("urgent"))
            badgeClass = "status-badge urgent";

          const canSubmit = !["review", "solved", "unsolved"].includes(normalizedStatus);

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${doc.id.slice(-5)}</td>
            <td>
              <span class="clickable-item" data-source="tasks" data-id="${t.itemId || ''}" data-name="${(t.item || 'Unnamed Item').replace(/"/g,'&quot;')}">
                ${t.item || "Unnamed Item"}
              </span>
            </td>
            <td>${t.concern || "—"}</td>
            <td>${description}</td>
            <td>${deadline}</td>
            <td class="text-center">
              ${
                note
                  ? `<span class="note-icon" data-note="${note.replace(/"/g, "&quot;")}" title="View note">📝</span>`
                  : "—"
              }
            </td>
            <td><span class="${badgeClass}">${status}</span></td>
            <td class="text-center">
              ${
                canSubmit
                  ? `<button class="submit-btn" data-id="${doc.id}">Submit</button>`
                  : ""
              }
            </td>
          `;
          tasksTableBody.appendChild(tr);
        });

        document.querySelectorAll(".note-icon").forEach((icon) => {
          icon.addEventListener("click", () => {
            const noteText = icon.dataset.note || "No note provided.";
            document.getElementById("noteText").textContent = noteText;
            noteModal.style.display = "flex";
          });
        });

        document.querySelectorAll(".submit-btn[data-id]").forEach((btn) => {
          btn.addEventListener("click", () => {
            currentSubmitTicketId = btn.dataset.id;
            submitModal.style.display = "flex";
          });
        });

        // Reattach modal click event for item names (both tasks and maintenance rows)
        attachItemModalListeners();
      });

    // ==============================
    // Submit Task
    // ==============================
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

    document
      .getElementById("confirmSubmitBtn")
      .addEventListener("click", async () => {
        if (!currentSubmitTicketId) return;
        try {
          await ticketsCollection.doc(currentSubmitTicketId).update({
            status: "Review",
          });

          submitModal.style.display = "none";

          const submitBtn = document.querySelector(
            `.submit-btn[data-id="${currentSubmitTicketId}"]`
          );
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitted";
            submitBtn.classList.add("disabled-btn");
          }

          showToast("✅ Finish Task Request Submitted");
        } catch (err) {
          console.error("Error submitting for review:", err);
          showToast("❌ Failed to submit task. Check console.");
        }
      });

    // ==============================
    // Maintenance Due Dates Table
    // ==============================
    async function loadMaintenanceTable() {
      const tableBody = document.getElementById("maintenanceTableBody");
      if (!tableBody) return;

      try {
        const snapshot = await inventoryCollection.get({ source: "server" });
        let items = snapshot.docs.map((doc) => {
          const data = doc.data();
          const name = data.Name || data.name || data.ItemName || data.itemName || doc.id;

          const dueRaw =
            data.MaintenanceDueDate ||
            data.maintenanceDueDate ||
            data.dueDate ||
            data.DueDate;

          let due = null;
          let isUrgent = false;

          if (typeof dueRaw === "string") {
            if (dueRaw.toUpperCase() === "URGENT") {
              isUrgent = true;
            } else if (!isNaN(Date.parse(dueRaw))) {
              due = new Date(dueRaw);
            }
          } else if (dueRaw?.toDate && typeof dueRaw.toDate === "function") {
            due = dueRaw.toDate();
          }

          return { id: doc.id, name, dueDate: due, isUrgent };
        });

        // Sort items
        items.sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate - b.dueDate;
        });

        const now = new Date();
        const threeDays = 3 * 24 * 60 * 60 * 1000;

        // Render each item
        tableBody.innerHTML = items.length
          ? items
              .map((item) => {
                // mark clickable items with data-source="maintenance"
                if (item.isUrgent) {
                  return `
                    <tr class="urgent-row">
                      <td><span class="clickable-item" data-source="maintenance" data-id="${item.id}" data-name="${item.name}">${item.name}</span></td>
                      <td>URGENT</td>
                      <td><span class="tracking-badge tracking-badge-urgent">URGENT</span></td>
                    </tr>`;
                }

                if (!item.dueDate) {
                  return `
                    <tr>
                      <td><span class="clickable-item" data-source="maintenance" data-id="${item.id}" data-name="${item.name}">${item.name}</span></td>
                      <td>N/A</td>
                      <td><span class="tracking-badge tracking-badge-gray">N/A</span></td>
                    </tr>`;
                }

                const diffDays = Math.ceil((item.dueDate - now) / (1000 * 60 * 60 * 24));
                let badgeClass = "tracking-badge-green";
                if (diffDays < 10) badgeClass = "tracking-badge-red";
                else if (diffDays < 20) badgeClass = "tracking-badge-orange";

                return `
                  <tr class="${item.dueDate - now <= threeDays ? "due-soon" : ""}">
                    <td><span class="clickable-item" data-source="maintenance" data-id="${item.id}" data-name="${item.name}">${item.name}</span></td>
                    <td>${item.dueDate.toLocaleDateString()}</td>
                    <td><span class="tracking-badge ${badgeClass}">${diffDays} days</span></td>
                  </tr>`;
              })
              .join("")
          : `<tr><td colspan="3">No items found.</td></tr>`;

        // Attach listeners after rendering
        attachItemModalListeners();
      } catch (err) {
        console.error("Error loading maintenance due dates:", err);
      }
    }

    // ==============================
    // Shared function for Item Info Modal
    // ==============================
    function attachItemModalListeners() {
      // Remove previous listeners by cloning nodes (prevents double handlers if called repeatedly)
      document.querySelectorAll(".clickable-item").forEach((el) => {
        // clone node to remove previously attached listeners safely
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
      });

      document.querySelectorAll(".clickable-item").forEach((el) => {
        el.addEventListener("click", async () => {
          const id = el.dataset.id;
          const name = el.dataset.name;
          const source = el.dataset.source || "maintenance"; // default to maintenance

          let modal = document.getElementById("itemInfoModal");
          if (!modal) {
            modal = document.createElement("div");
            modal.className = "tc-modal";
            modal.id = "itemInfoModal";
            modal.innerHTML = `
              <div class="tc-modal__content">
                <button id="closeItemInfoModal" class="tc-modal__close">&times;</button>
                <h3 id="itemInfoTitle">Item Information</h3>
                <div id="itemInfoDetails" style="text-align:left; margin-top:10px;"></div>
                <div style="margin-top:20px;">
                  <button id="finishMaintenanceBtn" class="finish-btn">Finish</button>
                </div>
              </div>`;
            document.body.appendChild(modal);
          }

          const title = document.getElementById("itemInfoTitle");
          const details = document.getElementById("itemInfoDetails");
          const finishBtn = document.getElementById("finishMaintenanceBtn");

          // Show or hide Finish button depending on source
          if (finishBtn) {
            if (source === "tasks") {
              finishBtn.style.display = "none";
            } else {
              finishBtn.style.display = ""; // show (use default)
            }
          }

          try {
            let docSnap = id ? await inventoryCollection.doc(id).get() : null;
            if (!docSnap || !docSnap.exists) {
              const fallbackSnap = await inventoryCollection.where("Name", "==", name).limit(1).get();
              docSnap = fallbackSnap.docs[0];
            }

            if (!docSnap || !docSnap.exists) {
              // no matching inventory doc found
              title.textContent = name || "Item Information";
              details.innerHTML = `<p>No inventory record found for this item.</p>`;
              if (finishBtn) finishBtn.dataset.docId = ""; // clear
              modal.style.display = "flex";
              return;
            }

            const data = docSnap.data();
            title.textContent = data.Name || data.name || name;
            details.innerHTML = `
              <p><strong>Item ID:</strong> ${docSnap.id}</p>
              <p><strong>Category:</strong> ${data.Category || "N/A"}</p>
              <p><strong>Condition:</strong> ${data.Condition || "N/A"}</p>
              <p><strong>Location:</strong> ${data.Laboratory || data.location || "N/A"}</p>
              <p><strong>Last Maintenance:</strong> ${data.LastMaintenanceDate ? new Date(data.LastMaintenanceDate.toDate ? data.LastMaintenanceDate.toDate() : data.LastMaintenanceDate).toLocaleDateString() : "N/A"}</p>
              <p><strong>Due Date:</strong> ${data.MaintenanceDueDate ? new Date(data.MaintenanceDueDate.toDate ? data.MaintenanceDueDate.toDate() : data.MaintenanceDueDate).toLocaleDateString() : "N/A"}</p>`;
            if (finishBtn) finishBtn.dataset.docId = docSnap.id;
            modal.style.display = "flex";
          } catch (err) {
            console.error("Error loading item info:", err);
            details.innerHTML = `<p>Error loading data.</p>`;
            if (finishBtn) finishBtn.dataset.docId = "";
            modal.style.display = "flex";
          }
        });
      });
    }

    // ===============================
    // Global Modal & Finish Handlers (with Toast Notification)
    // ===============================
    if (!window.__finishMaintenanceHandlerAttached) {
      window.__finishMaintenanceHandlerAttached = true;

      document.body.addEventListener("click", async (e) => {
        if (e.target.id === "closeItemInfoModal") {
          const modal = document.getElementById("itemInfoModal");
          if (modal) modal.style.display = "none";
        }

        if (e.target.id === "finishMaintenanceBtn") {
          e.stopPropagation();
          const btn = e.target;
          const docId = btn.dataset.docId;
          if (!docId) return showToast("❌ No item selected.");

          const newDueDate = new Date();
          newDueDate.setDate(newDueDate.getDate() + 30);

          try {
            const docRef = firebase.firestore().collection("inventory").doc(docId);
            const docSnap = await docRef.get({ source: "server" });

            if (!docSnap.exists) {
              showToast("❌ Item not found.");
              return;
            }

            const data = docSnap.data();
            const dueKey =
              "MaintenanceDueDate" in data
                ? "MaintenanceDueDate"
                : "maintenanceDueDate" in data
                ? "maintenanceDueDate"
                : "DueDate";
            const lastKey =
              "LastMaintenanceDate" in data
                ? "LastMaintenanceDate"
                : "lastMaintenanceDate";
            const trackingKey =
              "Tracking" in data ? "Tracking" : "tracking";

            await docRef.update({
              [dueKey]: firebase.firestore.Timestamp.fromDate(newDueDate),
              [lastKey]: firebase.firestore.Timestamp.fromDate(new Date()),
              [trackingKey]: "30 days",
            });

            showToast("✅ Maintenance finished! Next due date set to 30 days from now.");
            const modal = document.getElementById("itemInfoModal");
            if (modal) modal.style.display = "none";
            await loadMaintenanceTable();
          } catch (err) {
            console.error("Error updating item:", err);
            showToast("❌ Failed to update maintenance date.");
          }
        }
      });
    }

    await loadMaintenanceTable();
  } catch (err) {
    console.error("💥 initTasksPage error:", err);
    if (loadingText) {
      loadingText.style.display = "block";
      loadingText.textContent = "Error loading tasks. Check console.";
    }
  }
})();
