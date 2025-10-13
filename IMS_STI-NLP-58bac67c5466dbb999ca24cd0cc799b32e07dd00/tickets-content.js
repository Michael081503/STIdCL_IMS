// ✅ tickets-content.js (Admin: Review Modal + Clickable Handler + Deadline Modal + Full Feature)

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

    const ticketsTableBody = document.getElementById("tc-ticketsTableBody");
    const createTicketBtn = document.getElementById("tc-createTicketBtn");
    const modal = document.getElementById("tc-ticketModal");
    const closeModal = document.getElementById("tc-closeModal");
    const submitTicketBtn = document.getElementById("tc-submitTicketBtn");
    const ticketConcern = document.getElementById("tc-ticketConcern");
    const ticketDescription = document.getElementById("tc-ticketDescription");
    const ticketItem = document.getElementById("tc-ticketItem");
    const searchInput = document.getElementById("tc-searchInput");
    const prevPageBtn = document.getElementById("tc-prevPage");
    const nextPageBtn = document.getElementById("tc-nextPage");

    const viewFeedbackModal = document.getElementById("viewFeedbackModal");
    const closeViewFeedback = document.getElementById("closeViewFeedback");
    const feedbackTimeline = document.getElementById("feedbackTimeline");

    const viewDescriptionModal = document.getElementById("viewDescriptionModal");
    const closeViewDescription = document.getElementById("closeViewDescription");
    const fullDescriptionText = document.getElementById("fullDescriptionText");

    const headerRow = document.getElementById("tc-headerRow");

    const ticketsCollection = firebase.firestore().collection("tickets");
    const inventoryCollection = firebase.firestore().collection("inventory");
    const notificationsCollection = firebase.firestore().collection("notifications");
    const auth = firebase.auth();
    const db = firebase.firestore();

    async function getUserRole() {
      const user = auth.currentUser;
      if (!user) return null;
      const doc = await db.collection("users").doc(user.uid).get();
      return doc.exists ? doc.data().role : null;
    }

    async function getMaintenanceUsers() {
      const snapshot = await db.collection("users").where("role", "==", "Maintenance").get();
      return snapshot.docs.map(d => ({
        id: d.id,
        name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.data().email
      }));
    }

    async function getTickets() {
      try {
        const snapshot = await ticketsCollection.orderBy("createdAt", "desc").get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error("Error loading tickets:", error);
        return [];
      }
    }

    async function saveTicket(ticket) {
      const docRef = await ticketsCollection.add(ticket);
      return docRef.id;
    }

    async function deleteTicket(id) {
      await ticketsCollection.doc(id).delete();
    }

    async function getInventoryItems() {
      try {
        const snapshot = await inventoryCollection.get();
        return snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.Name ?? d.id,
            lab: data.Laboratory ?? "",
          };
        });
      } catch (err) {
        console.error("Error fetching inventory items:", err);
        return [];
      }
    }

    async function loadItemsDropdown() {
      const items = await getInventoryItems();
      ticketItem.innerHTML = "";
      if (items.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No items available";
        ticketItem.appendChild(opt);
        return;
      }
      items.forEach((it) => {
        const opt = document.createElement("option");
        opt.value = it.id;
        opt.textContent = `${it.name} (${it.lab || "No Lab"})`;
        opt.dataset.name = it.name;
        ticketItem.appendChild(opt);
      });
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

    function renderTickets() {
      ticketsTableBody.innerHTML = "";
      const pageTickets = paginate(filteredTickets, currentPage, pageSize);

      pageTickets.forEach((t, index) => {
        const tr = document.createElement("tr");
        const statusClass = "status-" + (t.status || "pending").toLowerCase();
        const desc = t.description || "";
        const showButton = desc.length > 80;

        let assignColumn = "";
        if (currentRole === "Admin") {
          if (t.status === "Review" && t.assignedToName) {
            // 🔹 Clickable name for Review status
            assignColumn = `
              <td>
                <span class="handler-clickable" data-id="${t.id}" data-user="${t.assignedToName}">
                  ${t.assignedToName}
                </span>
              </td>`;
          } else if (t.status === "Solved" && t.assignedToName) {
            // ✅ Show maintenance name (non-editable) when ticket is solved
            assignColumn = `
              <td>
                <span class="handler-name">${t.assignedToName}</span>
              </td>`;
          } else {
            // 🔸 Normal dropdown for assignment
            const assignedTo = t.assignedToName || "Unassigned";
            assignColumn = `
              <td>
                <select class="assign-select" data-id="${t.id}">
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

        tr.innerHTML = `
          <td>${shortenId(t.id)}</td>
          <td>${escapeHtml(t.item)}</td>
          <td>${escapeHtml(t.concern)}</td>
          <td class="ticket-description">
            ${escapeHtml(desc)}
            ${
              showButton
                ? `<button class="btn-view-description" data-desc="${escapeHtml(desc)}">View Details</button>`
                : ""
            }
          </td>
            <td>
              <span class="status-badge ${statusClass}">
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

      // ✅ Admin handler modal logic
      if (currentRole === "Admin") {
        // --- Handler select for new assignment ---
        ticketsTableBody.querySelectorAll(".assign-select").forEach(select => {
          select.addEventListener("change", async (e) => {
            const ticketId = e.target.dataset.id;
            const selectedId = e.target.value;
            if (!selectedId) return;
            const selectedUser = maintenanceUsers.find(u => u.id === selectedId);
            if (!selectedUser) return;
            const modal = document.getElementById("setDeadlineModal");
            modal.style.display = "flex";
            modal.dataset.ticketId = ticketId;
            modal.dataset.userId = selectedId;
            modal.dataset.userName = selectedUser.name;
          });
        });

        // --- Clickable handler for review modal ---
        document.querySelectorAll(".handler-clickable").forEach((el) => {
          el.addEventListener("click", () => {
            const ticketId = el.dataset.id;
            const submittedBy = el.dataset.user;
            const modal = document.getElementById("reviewSubmissionModal");
            modal.dataset.ticketId = ticketId;
            document.getElementById("submittedByName").textContent = submittedBy;
            modal.style.display = "flex";
          });
        });

        // --- Deadline modal actions ---
        const closeBtn = document.getElementById("closeDeadlineModal");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            const modal = document.getElementById("setDeadlineModal");
            modal.style.display = "none";
            document.getElementById("deadlineDate").value = "";
            document.getElementById("deadlineNote").value = "";
          });
        }

        const saveBtn = document.getElementById("saveDeadlineBtn");
        if (saveBtn) {
          saveBtn.addEventListener("click", async () => {
            const modal = document.getElementById("setDeadlineModal");
            const ticketId = modal.dataset.ticketId;
            const userId = modal.dataset.userId;
            const userName = modal.dataset.userName;
            const deadline = document.getElementById("deadlineDate").value;
            const note = document.getElementById("deadlineNote").value.trim();
            if (!deadline) {
              alert("Please select a deadline date before saving.");
              return;
            }
            try {
              await ticketsCollection.doc(ticketId).update({
                assignedTo: userId,
                assignedToName: userName,
                deadline: firebase.firestore.Timestamp.fromDate(new Date(deadline)),
                assignmentNote: note,
                status: "Assigned",
              });
              alert(`✅ Ticket assigned to ${userName} with deadline set!`);
              modal.style.display = "none";
              document.getElementById("deadlineDate").value = "";
              document.getElementById("deadlineNote").value = "";
              tickets = await getTickets();
              filteredTickets = [...tickets];
              renderTickets();
            } catch (err) {
              console.error("Error saving deadline:", err);
              alert("Failed to save deadline.");
            }
          });
        }

        // --- Review modal actions ---
        const closeReviewModal = document.getElementById("closeReviewModal");
        const markSolvedBtn = document.getElementById("markSolvedBtn");
        const markUnsolvedBtn = document.getElementById("markUnsolvedBtn");
        const reviewModal = document.getElementById("reviewSubmissionModal");

        if (closeReviewModal) {
          closeReviewModal.onclick = () => (reviewModal.style.display = "none");
        }

        async function updateReviewStatus(ticketId, newStatus) {
          try {
            await ticketsCollection.doc(ticketId).update({ status: newStatus });
            alert(`✅ Ticket marked as ${newStatus}!`);
            reviewModal.style.display = "none";
            tickets = await getTickets();
            filteredTickets = [...tickets];
            renderTickets();
          } catch (err) {
            console.error("Failed to update review status:", err);
          }
        }

        if (markSolvedBtn && markUnsolvedBtn) {
          markSolvedBtn.onclick = () => {
            const ticketId = reviewModal.dataset.ticketId;
            updateReviewStatus(ticketId, "Solved");
          };
          markUnsolvedBtn.onclick = () => {
            const ticketId = reviewModal.dataset.ticketId;
            updateReviewStatus(ticketId, "Unsolved");
          };
        }
      }

      // ✅ Delete buttons
      ticketsTableBody.querySelectorAll(".btn-delete").forEach((btn, idx) => {
        btn.addEventListener("click", () =>
          onDeleteTicket((currentPage - 1) * pageSize + idx)
        );
      });

      // ✅ Feedback buttons
      if (currentRole !== "Admin") {
        ticketsTableBody.querySelectorAll(".btn-feedback").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const ticketId = btn.dataset.id;
            const doc = await ticketsCollection.doc(ticketId).get();
            const history = doc.data().feedbackHistory || [];
            feedbackTimeline.innerHTML = history.length
              ? history.map(f => `
                <div class="feedback-entry">
                  <strong>${escapeHtml(f.admin)}</strong>
                  <span class="date">${f.timestamp?.toDate().toLocaleString() || ""}</span>
                  <p>${escapeHtml(f.message)}</p>
                </div>`).join("")
              : "<p>No feedback yet.</p>";
            viewFeedbackModal.style.display = "flex";
            viewFeedbackModal.setAttribute("aria-hidden", "false");
          });
        });
      }

      // ✅ Description buttons
      ticketsTableBody.querySelectorAll(".btn-view-description").forEach((btn) => {
        btn.addEventListener("click", () => {
          const desc = btn.dataset.desc || "No description available.";
          fullDescriptionText.textContent = desc;
          viewDescriptionModal.style.display = "flex";
          viewDescriptionModal.setAttribute("aria-hidden", "false");
        });
      });

      prevPageBtn.disabled = currentPage === 1;
      nextPageBtn.disabled = currentPage * pageSize >= filteredTickets.length;
    }

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
        } catch {
          alert("Failed to delete ticket. Please try again.");
        }
      }
    }

    createTicketBtn.addEventListener("click", async () => {
      await loadItemsDropdown();
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      ticketConcern.value = "";
      ticketDescription.value = "";
      submitTicketBtn.textContent = "Submit";
    });

    closeModal.addEventListener("click", () => {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    });

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

    submitTicketBtn.addEventListener("click", async () => {
      const concern = ticketConcern.value.trim();
      const description = ticketDescription.value.trim();
      const selectedOption = ticketItem.options[ticketItem.selectedIndex];
      const itemId = selectedOption?.value;
      const itemName = selectedOption?.dataset.name;
      if (!concern || !description || !itemId || !itemName) {
        alert("Please fill in all fields.");
        return;
      }
      const currentUser = auth.currentUser;
      let role = "User";
      if (currentUser) {
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        role = userDoc.exists ? userDoc.data().role : "User";
      }
      const newTicket = {
        item: itemName,
        itemId,
        concern,
        description,
        status: "Pending",
        feedbackHistory: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        issuedBy: currentUser?.email || "Unknown user",
        issuedById: currentUser?.uid || null,
        createdByRole: role,
      };
      try {
        const newId = await saveTicket(newTicket);
        newTicket.id = newId;
        await notificationsCollection.add({
          message: `${newTicket.issuedBy} issued a ticket regarding ${itemName}`,
          itemName,
          issuedBy: newTicket.issuedBy,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdByRole: role,
        });
        tickets.unshift(newTicket);
        filteredTickets = [...tickets];
        currentPage = 1;
        renderTickets();
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
      } catch (err) {
        console.error("Ticket save failed:", err);
        alert("Failed to save ticket. Please try again.");
      }
    });

    closeViewFeedback.addEventListener("click", () => {
      viewFeedbackModal.style.display = "none";
      viewFeedbackModal.setAttribute("aria-hidden", "true");
    });

    closeViewDescription.addEventListener("click", () => {
      viewDescriptionModal.style.display = "none";
      viewDescriptionModal.setAttribute("aria-hidden", "true");
    });

    renderTickets();
  } catch (err) {
    console.error("tickets-content init error:", err);
  }
})();

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
