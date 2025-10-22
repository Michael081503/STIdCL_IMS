// ✅ profile.js — Fully working & auto-refreshing avatar (CORS-safe + DOM-sync fix)
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

// === DOM elements ===
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("avatar-upload");
const nameEl = document.getElementById("profile-name");
const emailEl = document.getElementById("profile-email");
const roleEl = document.getElementById("profile-role");
const createdEl = document.getElementById("profile-created");

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
      console.warn("⚠️ Avatar element not found in DOM yet.");
      return;
    }

    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    console.log("HEAD status:", res.status);

    if (res.ok) {
      const freshUrl = url + "?t=" + Date.now();
      avatarImg.style.background = "none";
      avatarImg.src = freshUrl;
      console.log("✅ Avatar src updated to:", freshUrl);
    } else {
      avatarImg.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
      console.warn("⚠️ Avatar URL invalid, using default.");
    }
  } catch (err) {
    console.error("❌ Avatar load failed:", err);
    const avatarImg = document.getElementById("profile-avatar");
    if (avatarImg)
      avatarImg.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  }
}

// === Load user profile ===
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.querySelector(".profile-container").innerHTML = `
      <p style="color:red; text-align:center;">Please log in to view your profile.</p>`;
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      const data = userDoc.data();
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      nameEl.textContent = fullName || user.email.split("@")[0];
      emailEl.textContent = data.email || user.email;
      roleEl.textContent = data.role || "User";
      createdEl.textContent = data.createdAt
        ? data.createdAt.toDate().toLocaleString()
        : "N/A";

      if (data.avatarURL) {
        await loadAvatar(data.avatarURL);
      } else {
        const avatarImg = document.getElementById("profile-avatar");
        avatarImg.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
      }
    } else {
      emailEl.textContent = user.email;
      roleEl.textContent = "N/A";
      createdEl.textContent = "N/A";
    }
  } catch (err) {
    console.error("Error loading profile:", err);
  }
});

// ==================== Edit Name Modal Logic ====================
editBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      editFirst.value = data.firstName || "";
      editLast.value = data.lastName || "";
    }
    editMsg.textContent = "";
    editModal.style.display = "block";
  } catch (err) {
    console.error("Error loading name:", err);
  }
});

cancelEditBtn.addEventListener("click", () => {
  editModal.style.display = "none";
});

saveNameBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const newFirst = editFirst.value.trim();
  const newLast = editLast.value.trim();

  if (!newFirst || !newLast) {
    editMsg.style.color = "red";
    editMsg.textContent = "❌ Both fields are required.";
    return;
  }

  try {
    await updateDoc(doc(db, "users", user.uid), {
      firstName: newFirst,
      lastName: newLast
    });

    // ✅ Update displayed name immediately
    nameEl.textContent = `${newFirst} ${newLast}`.trim();
    editMsg.style.color = "green";
    editMsg.textContent = "✅ Name updated successfully!";
    setTimeout(() => editModal.style.display = "none", 1200);
  } catch (err) {
    editMsg.style.color = "red";
    editMsg.textContent = "❌ Update failed: " + err.message;
  }
});

// === Handle avatar upload ===
uploadBtn.addEventListener("click", () => fileInput.click());

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

    // Wait a short delay before updating image to ensure DOM is stable
    setTimeout(() => loadAvatar(url), 500);

    alert("Profile photo updated successfully!");
  } catch (err) {
    console.error("❌ Upload failed:", err);
    alert("Error uploading photo: " + err.message);
  }
});
