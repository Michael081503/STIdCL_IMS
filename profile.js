// ✅ profile.js — safer, resilient version (drop-in replacement)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js";

// === Your Firebase configuration ===
const firebaseConfig = {
  apiKey: "AIzaSyAw2rSjJ3f_S98dntbsyl9kyXvi9MC44Dw",
  authDomain: "fir-inventory-2e62a.firebaseapp.com",
  projectId: "fir-inventory-2e62a",
  storageBucket: "fir-inventory-2e62a.firebasestorage.app",
  messagingSenderId: "380849220480",
  appId: "1:380849220480:web:5a43b227bab9f9a197af65",
  measurementId: "G-ERT87GL4XC"
};

// === Initialize Firebase services ===
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app, "gs://fir-inventory-2e62a.firebasestorage.app");

// === DOM elements (safely) ===
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("avatar-upload");
const nameEl = document.getElementById("profile-name");
const emailEl = document.getElementById("profile-email");
const roleEl = document.getElementById("profile-role");
const createdEl = document.getElementById("profile-created");
const positionEl = document.getElementById("profile-position");

// ==================== Edit Name Elements ====================
const editBtn = document.getElementById("edit-name-btn");
const editModal = document.getElementById("edit-name-modal");
const saveNameBtn = document.getElementById("save-name-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const editFirst = document.getElementById("edit-first-name");
const editLast = document.getElementById("edit-last-name");
const editMsg = document.getElementById("edit-name-msg");

// === Helper: safely load avatar, ensure correct element, and bypass cache ===
async function loadAvatar(url) {
  console.log("🖼️ Trying to load avatar:", url);

  try {
    const avatarImg = document.getElementById("profile-avatar");
    if (!avatarImg) {
      console.warn("⚠️ Avatar element not found in DOM.");
      return;
    }

    // HEAD might be blocked by CORS on some storage setups; keep this tolerant
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!res.ok) throw new Error("HEAD returned " + res.status);
    } catch (headErr) {
      // HEAD failed — we'll still try to set src (some hosts block HEAD)
      console.info("ℹ️ HEAD check failed or blocked, will still try to set src:", headErr.message);
    }

    // append timestamp query to bust cache
    const freshUrl = url + "?t=" + Date.now();
    avatarImg.style.background = "none";
    avatarImg.src = freshUrl;
    console.log("✅ Avatar src updated to:", freshUrl);
  } catch (err) {
    console.error("❌ Avatar load failed:", err);
    const avatarImg = document.getElementById("profile-avatar");
    if (avatarImg) avatarImg.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  }
}

// === Utility: convert Firestore createdAt-like values to readable string ===
function formatCreatedAt(createdVal) {
  if (!createdVal) return "N/A";

  // Firestore Timestamp object
  if (typeof createdVal.toDate === "function") {
    try {
      return createdVal.toDate().toLocaleString();
    } catch (e) { console.warn("Failed to toDate() timestamp:", e); }
  }

  // Raw { seconds: ... } shaped object
  if (createdVal.seconds) {
    try {
      return new Date(createdVal.seconds * 1000).toLocaleString();
    } catch (e) { console.warn("Failed to parse seconds:", e); }
  }

  // ISO string or numeric millis
  try {
    const dt = new Date(createdVal);
    if (!isNaN(dt)) return dt.toLocaleString();
  } catch (e) { /* ignore */ }

  return "N/A";
}

// === Load user profile ===
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const container = document.querySelector(".profile-container");
    if (container) {
      container.innerHTML = `<p style="color:red; text-align:center;">Please log in to view your profile.</p>`;
    }
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      const data = userDoc.data();

      // name
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      if (nameEl) nameEl.textContent = fullName || (user.email ? user.email.split("@")[0] : "User");

      // email
      if (emailEl) emailEl.textContent = data.email || user.email || "N/A";

      // role
      if (roleEl) roleEl.textContent = data.role || "User";

      // position: show literal "undefined" when there is no position set
      // requirement: If user doesn't have a position yet, it should show as undefined
      const posValue = (data.position === undefined || data.position === null || data.position === "") ? "undefined" : data.position;
      if (positionEl) positionEl.textContent = posValue;

      // createdAt: robust formatting
      const createdText = formatCreatedAt(data.createdAt);
      if (createdEl) createdEl.textContent = createdText;

      // avatar (keep isolated so errors won't stop other UI)
      if (data.avatarURL) {
        await loadAvatar(data.avatarURL).catch(err => console.warn("Avatar load error (non-fatal):", err));
      } else {
        const avatarImg = document.getElementById("profile-avatar");
        if (avatarImg) avatarImg.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
      }
    } else {
      // no doc
      if (emailEl) emailEl.textContent = user.email || "N/A";
      if (roleEl) roleEl.textContent = "N/A";
      if (positionEl) positionEl.textContent = "undefined";
      if (createdEl) createdEl.textContent = "N/A";
    }
  } catch (err) {
    console.error("Error loading profile:", err);
    // keep UI responsive: set sensible fallbacks
    if (emailEl && !emailEl.textContent) emailEl.textContent = user.email || "N/A";
    if (roleEl && !roleEl.textContent) roleEl.textContent = "N/A";
    if (positionEl && !positionEl.textContent) positionEl.textContent = "undefined";
    if (createdEl && !createdEl.textContent) createdEl.textContent = "N/A";
  }
});

// ==================== Edit Name Modal Logic ====================
if (editBtn) {
  editBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (editFirst) editFirst.value = data.firstName || "";
        if (editLast) editLast.value = data.lastName || "";
      }
      if (editMsg) editMsg.textContent = "";
      if (editModal) editModal.style.display = "block";
    } catch (err) {
      console.error("Error loading name:", err);
    }
  });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    if (editModal) editModal.style.display = "none";
  });
}

if (saveNameBtn) {
  saveNameBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const newFirst = (editFirst?.value || "").trim();
    const newLast = (editLast?.value || "").trim();

    if (!newFirst || !newLast) {
      if (editMsg) {
        editMsg.style.color = "red";
        editMsg.textContent = "❌ Both fields are required.";
      }
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        firstName: newFirst,
        lastName: newLast
      });

      // Update displayed name immediately
      if (nameEl) nameEl.textContent = `${newFirst} ${newLast}`.trim();
      if (editMsg) {
        editMsg.style.color = "green";
        editMsg.textContent = "✅ Name updated successfully!";
      }
      setTimeout(() => { if (editModal) editModal.style.display = "none"; }, 1200);
    } catch (err) {
      if (editMsg) {
        editMsg.style.color = "red";
        editMsg.textContent = "❌ Update failed: " + err.message;
      }
      console.error("Save name failed:", err);
    }
  });
}

// === Handle avatar upload ===
if (uploadBtn) {
  uploadBtn.addEventListener("click", () => fileInput?.click());
}

if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const user = auth.currentUser;
    if (!user) return alert("Please log in first.");

    const file = e.target.files[0];
    if (!file) return;

    try {
      console.log("Uploading file...");
      const fileRef = ref(storage, `avatars/${user.uid}.jpg`);
      await uploadBytes(fileRef, file);
      console.log("✅ Upload complete");

      const url = await getDownloadURL(fileRef);
      console.log("✅ Download URL obtained:", url);

      await updateDoc(doc(db, "users", user.uid), { avatarURL: url });
      console.log("✅ Firestore updated with new avatar URL");

      // Update avatar with a slight delay to let storage stabilize
      setTimeout(() => loadAvatar(url), 500);

      alert("Profile photo updated successfully!");
    } catch (err) {
      console.error("❌ Upload failed:", err);
      alert("Error uploading photo: " + err.message);
    }
  });
}
