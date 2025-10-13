// =============================
// 🧰 TASKS PAGE JS (with Maintenance Due Dates Table)
// =============================
(async function initTasksPage() {
  const auth = firebase.auth();
  const db = firebase.firestore();
  const ticketsCollection = db.collection("tickets");
  const inventoryCollection = db.collection("inventory");

  const tasksTableBody = document.getElementById("tasksTableBody");
  const loadingText = document.getElementById("loadingText");

  // ==============================
  // 🧩 Create Note Modal
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
  // ✅ Create Submit Confirmation Modal
  // ==============================
  const submitModal = document.createElement("div");
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

  let currentSubmitTicketId = null;

  try {
    // Show loading message while waiting for auth
    if (loadingText) {
      loadingText.style.display = "block";
      loadingText.textContent = "Loading your tasks...";
    }

    // Wait for Firebase Auth
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

    // Get user role
    const userDoc = await db.collection("users").doc(user.uid).get();
    const role = userDoc.exists ? userDoc.data().role : null;

    if (role !== "Maintenance") {
      if (loadingText) {
        loadingText.style.display = "block";
        loadingText.textContent = "You must be a maintenance user to view tasks.";
      }
      return;
    }

    // ✅ Listen for tasks assigned to this user
    ticketsCollection
      .where("assignedTo", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        tasksTableBody.innerHTML = "";

        // Hide loading text once snapshot arrives
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
          const deadline = t.deadline
            ? new Date(t.deadline).toLocaleDateString()
            : "Not set";
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

          const canSubmit =
            !["review", "solved", "unsolved"].includes(normalizedStatus);

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${doc.id.slice(-5)}</td>
            <td>${t.item || "Unnamed Item"}</td>
            <td>${t.concern || "—"}</td>
            <td>${description}</td>
            <td>${deadline}</td>
            <td class="text-center">
              ${
                note
                  ? `<span class="note-icon" data-note="${note.replace(
                      /"/g,
                      "&quot;"
                    )}" title="View note">📝</span>`
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

        // Modal listeners
        document.querySelectorAll(".note-icon").forEach((icon) => {
          icon.addEventListener("click", () => {
            const noteText = icon.dataset.note || "No note provided.";
            document.getElementById("noteText").textContent = noteText;
            noteModal.style.display = "flex";
          });
        });

        document.querySelectorAll(".submit-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            currentSubmitTicketId = btn.dataset.id;
            submitModal.style.display = "flex";
          });
        });
      });

    // Confirm submit
    document
      .getElementById("confirmSubmitBtn")
      .addEventListener("click", async () => {
        if (!currentSubmitTicketId) return;
        try {
          await ticketsCollection.doc(currentSubmitTicketId).update({
            status: "Review",
          });
          submitModal.style.display = "none";
          alert("✅ Task marked for review!");
        } catch (err) {
          console.error("Error submitting for review:", err);
          alert("❌ Failed to mark for review. Check console.");
        }
      });

// =============================
// 🧰 Maintenance Due Dates Table
// =============================
async function loadMaintenanceTable() {
  const tableBody = document.getElementById("maintenanceTableBody");
  if (!tableBody) return;

  try {
    const snapshot = await inventoryCollection.get();
    let items = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Case-insensitive field lookup
      const name =
        data.Name ||
        data.name ||
        data.ItemName ||
        data.itemName ||
        doc.id;

      const dueRaw =
        data.MaintenanceDueDate ||
        data.maintenanceDueDate ||
        data.dueDate ||
        data.DueDate;

      let due = null;

      // Handle both Firestore Timestamp and string dates
      if (dueRaw?.toDate && typeof dueRaw.toDate === "function") {
        due = dueRaw.toDate();
      } else if (typeof dueRaw === "string" && !isNaN(Date.parse(dueRaw))) {
        due = new Date(dueRaw);
      }

      return { name, dueDate: due };
    });

    // Sort items: earliest due date first, then those with N/A last
    items.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate - b.dueDate;
    });

    const now = new Date();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    tableBody.innerHTML = items.length
      ? items
          .map((item) => {
            if (!item.dueDate) {
              return `
              <tr>
                <td>${item.name}</td>
                <td>N/A</td>
                <td><span class="tracking-badge tracking-badge-gray">N/A</span></td>
              </tr>`;
            }

            const diffDays = Math.ceil(
              (item.dueDate - now) / (1000 * 60 * 60 * 24)
            );

            let badgeClass = "tracking-badge-green";
            if (diffDays < 10) badgeClass = "tracking-badge-red";
            else if (diffDays < 20) badgeClass = "tracking-badge-orange";

            return `
              <tr class="${item.dueDate - now <= threeDays ? "due-soon" : ""}">
                <td>${item.name}</td>
                <td>${item.dueDate.toLocaleDateString()}</td>
                <td><span class="tracking-badge ${badgeClass}">${diffDays} days</span></td>
              </tr>`;
          })
          .join("")
      : `<tr><td colspan="3">No items found.</td></tr>`;
  } catch (err) {
    console.error("Error loading maintenance due dates:", err);
  }
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
