// ==================== MAIN SCRIPT ====================
window.onload = function () {
  console.log("Script loaded and window.onload triggered");
  document.body.classList.add('firebase-initialized');
  loadPage('home');

  // ==================== FIREBASE CONFIGURATION ====================
  const firebaseConfig = {
    apiKey: "AIzaSyAw2rSjJ3f_S98dntbsyl9kyXvi9MC44Dw",
    authDomain: "fir-inventory-2e62a.firebaseapp.com",
    projectId: "fir-inventory-2e62a",
    storageBucket: "fir-inventory-2e62a.firebasestorage.app",
    messagingSenderId: "380849220480",
    appId: "1:380849220480:web:5a43b227bab9f9a197af65",
    measurementId: "G-ERT87GL4XC"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // ==================== DOM ELEMENTS ====================
  const loginModal = document.getElementById('login-modal');
  const sideNav = document.querySelector('.side-nav');
  const loginBtn = document.querySelector('.login-btn');
  const closeLogin = document.getElementById('close-login');
  const toggleRegister = document.getElementById('toggle-register');
  const toggleLogin = document.getElementById('toggle-login');
  const registerBtn = document.getElementById('register-btn');
  const loginActionBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const profileBtn = document.getElementById('profile-btn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');
  const avatar = document.getElementById('user-avatar');
  const avatarDropdown = document.getElementById('avatar-dropdown');
  const inventoryLink = document.getElementById('inventory-link');
  const myTicketsLink = document.getElementById('my-tickets-link');
  const loginGroup = document.querySelector('.login-avatar-group');
  const roleSelect = document.getElementById('role-select');
  const modalTitle = loginModal.querySelector('h2');

  // ==================== NOTIFICATION ELEMENTS ====================
  const notifWrapper = document.getElementById('notification-wrapper');
  const notifBtn = document.getElementById('notification-btn');
  const notifCount = document.getElementById('notification-count');
  const notifDropdown = document.getElementById('notification-dropdown');
  const notifList = document.getElementById('notification-list');

  let ticketUnsub = null;
  let notifUnsub = null;

  // ==================== NOTIFICATION HELPERS ====================
  async function getDismissed(uid) {
    if (!uid) return [];
    try {
      const doc = await db.collection("users").doc(uid).get();
      return doc.exists && Array.isArray(doc.data().dismissedNotifs)
        ? doc.data().dismissedNotifs
        : [];
    } catch {
      return [];
    }
  }

  async function addDismissed(uid, notifId) {
    if (!uid || !notifId) return;
    try {
      await db.collection("users").doc(uid).set(
        { dismissedNotifs: firebase.firestore.FieldValue.arrayUnion(notifId) },
        { merge: true }
      );
    } catch (e) {
      console.error("Error adding dismissed notification:", e);
    }
  }

  function showNotification(count) {
    if (!notifCount) return;
    if (count > 0) {
      notifCount.classList.remove("count-animate");
      void notifCount.offsetWidth;
      notifCount.classList.add("count-animate");
      notifCount.textContent = count;
      notifCount.style.display = "inline-flex";
    } else {
      notifCount.style.display = "none";
    }
  }

  // ==================== NOTIFICATION RENDERER ====================
  async function renderNotifications(docs, isAdmin = false) {
    notifList.innerHTML = "";
    const uid = auth.currentUser ? auth.currentUser.uid : null;
    if (!uid) return;
    const dismissed = await getDismissed(uid);
    let activeDocs = docs.filter(doc => !dismissed.includes(doc.id));

    if (activeDocs.length === 0) {
      const emptyEl = notifDropdown.querySelector(".notif-empty");
      if (emptyEl) emptyEl.style.display = "block";
    } else {
      const emptyEl = notifDropdown.querySelector(".notif-empty");
      if (emptyEl) emptyEl.style.display = "none";

      activeDocs.forEach(doc => {
        const data = doc.data();
        const li = document.createElement("li");
        const rawDate = data.createdAt?.toDate() || new Date();
        const dateStr = rawDate.toLocaleString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true
        });
        const titleSpan = document.createElement("span");
        titleSpan.classList.add("notif-text");
        titleSpan.textContent = isAdmin ? "New ticket issued" : (data.message || "Notification");

        if (isAdmin) {
          const descDiv = document.createElement("div");
          descDiv.classList.add("notif-desc");
          const userSpan = document.createElement("span");
          userSpan.style.fontWeight = "600";
          userSpan.style.color = "#000";
          userSpan.textContent = data.issuedByName || data.issuedBy || "Unknown user";
          const middleSpan = document.createElement("span");
          middleSpan.style.color = "#444";
          middleSpan.textContent = " issued a ticket regarding ";
          const itemSpan = document.createElement("span");
          itemSpan.style.fontWeight = "600";
          itemSpan.style.color = "#000";
          itemSpan.textContent = data.itemName || "an item";
          descDiv.appendChild(userSpan);
          descDiv.appendChild(middleSpan);
          descDiv.appendChild(itemSpan);
          li.appendChild(titleSpan);
          li.appendChild(descDiv);
        } else {
          li.appendChild(titleSpan);
          if (data.message && !isAdmin) {
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("notif-desc");
            msgDiv.textContent = data.message;
            li.appendChild(msgDiv);
          }
        }

        const timeSpan = document.createElement("span");
        timeSpan.classList.add("notif-time");
        timeSpan.textContent = dateStr;
        const dismissBtn = document.createElement("span");
        dismissBtn.textContent = "×";
        dismissBtn.classList.add("dismiss-btn");
        dismissBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          li.classList.add("fade-out");
          li.addEventListener("transitionend", async () => {
            li.remove();
            await addDismissed(uid, doc.id);
            activeDocs = activeDocs.filter(d => d.id !== doc.id);
            showNotification(activeDocs.length);
            if (activeDocs.length === 0) {
              const emptyEl = notifDropdown.querySelector(".notif-empty");
              if (emptyEl) emptyEl.style.display = "block";
            }
          }, { once: true });
        });

        li.addEventListener("click", () => {
          notifDropdown.classList.remove("visible");
          loadPage("mytickets");
          setActiveLink(document.getElementById("my-tickets-link-a"));
        });

        li.appendChild(timeSpan);
        li.appendChild(dismissBtn);
        notifList.appendChild(li);
      });
    }
    showNotification(activeDocs.length);
  }

  // ==================== LOGIN & REGISTER TRANSITION ====================
  function animateTransition(showRegister) {
    loginModal.classList.add('fade-transition');
    setTimeout(() => {
      if (showRegister) {
        modalTitle.textContent = 'Create Account';
        registerBtn.style.display = 'block';
        loginActionBtn.style.display = 'none';
        toggleRegister.style.display = 'none';
        toggleLogin.style.display = 'block';
        roleSelect.style.display = 'block';
        document.getElementById('first-name').style.display = 'block';
        document.getElementById('last-name').style.display = 'block';
      } else {
        modalTitle.textContent = 'Login';
        registerBtn.style.display = 'none';
        loginActionBtn.style.display = 'block';
        toggleRegister.style.display = 'block';
        toggleLogin.style.display = 'none';
        roleSelect.style.display = 'none';
        document.getElementById('first-name').style.display = 'none';
        document.getElementById('last-name').style.display = 'none';
      }
      loginModal.classList.remove('fade-transition');
    }, 200);
  }

  // ==================== LOGIN & REGISTER LOGIC ====================
  loginBtn.addEventListener('click', () => loginModal.style.display = 'block');
  closeLogin.addEventListener('click', () => loginModal.style.display = 'none');
  toggleRegister.addEventListener('click', () => animateTransition(true));
  toggleLogin.addEventListener('click', () => animateTransition(false));

  registerBtn.addEventListener('click', () => {
    const firstName = document.getElementById('first-name').value.trim();
    const lastName = document.getElementById('last-name').value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const role = roleSelect.value;
    if (!firstName || !lastName) {
      loginError.textContent = "Please enter your first and last name.";
      return;
    }
    auth.createUserWithEmailAndPassword(email, password)
      .then(userCredential => {
        const user = userCredential.user;
        return db.collection('users').doc(user.uid).set({
          firstName, lastName, email, role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          dismissedNotifs: []
        });
      })
      .then(() => {
        loginModal.style.display = 'none';
        loginError.textContent = '';
      })
      .catch(error => loginError.textContent = error.message);
  });

  loginActionBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    auth.signInWithEmailAndPassword(email, password)
      .then(() => loginModal.style.display = 'none')
      .catch(error => loginError.textContent = error.message);
  });

  // ==================== LOGOUT LOGIC ====================
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await auth.signOut();
      avatarDropdown.classList.remove('visible');
      avatar.style.display = 'none';
      loginBtn.style.display = 'flex';
      inventoryLink.style.display = 'none';
      myTicketsLink.style.display = 'none';
      document.getElementById('user-role').style.display = 'none';
      if (notifWrapper) notifWrapper.style.display = 'none';
      if (ticketUnsub) { ticketUnsub(); ticketUnsub = null; }
      if (notifUnsub) { notifUnsub(); notifUnsub = null; }
      notifList.innerHTML = "";
      showNotification(0);
      if (notifDropdown.querySelector(".notif-empty")) {
        notifDropdown.querySelector(".notif-empty").style.display = "block";
      }

      clearPageCSS(); // 🧼 remove previous page-specific CSS

      loadPage('home');
      setActiveLink(document.getElementById('home-link'));
      alert('You have been logged out.');
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Error logging out. Try again.');
    }
  });

  // ==================== PROFILE LINK HANDLER ====================
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loadPage('profile');
      setActiveLink(document.getElementById('home-link'));
      avatarDropdown.classList.remove('visible');
    });
  }
  
  // ==================== AVATAR DROPDOWN ====================
  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdown.classList.remove("visible");
    avatarDropdown.classList.toggle("visible");
  });
  avatarDropdown.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => avatarDropdown.classList.remove("visible"));

 // ==================== AUTH STATE CHANGE HANDLER ====================
auth.onAuthStateChanged(user => {
  if (ticketUnsub) { ticketUnsub(); ticketUnsub = null; }
  if (notifUnsub) { notifUnsub(); notifUnsub = null; }

  if (user) {
    avatar.style.display = 'block';
    sideNav.classList.add('active');
    loginBtn.style.display = 'none';
    // Change background to white when logged in
    document.body.style.background = '#ffffff';
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundPosition = '';


    // ✅ Fetch user document for role and avatar
    db.collection('users').doc(user.uid).get()
      .then(doc => {
        if (doc.exists) {
          const data = doc.data();
          const role = data.role || 'User';
          const userRoleDiv = document.getElementById('user-role');
          userRoleDiv.textContent = user.email;
          userRoleDiv.style.display = 'block';

          // ✅ Update avatar image from Firestore
          const avatarImgEl = document.querySelector('#user-avatar img');
          if (data.avatarURL && avatarImgEl) {
            avatarImgEl.src = data.avatarURL + '?t=' + Date.now();
          } else if (avatarImgEl) {
            avatarImgEl.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
          }

          // 👁️ Real-time listener for avatar changes
          db.collection('users').doc(user.uid).onSnapshot(docSnap => {
            if (docSnap.exists) {
              const newAvatarURL = docSnap.data().avatarURL;
              const avatarImgEl = document.querySelector('#user-avatar img');
              if (avatarImgEl) {
                if (newAvatarURL) {
                  avatarImgEl.src = newAvatarURL + '?t=' + Date.now();
                } else {
                  avatarImgEl.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                }
              }
            }
          });

          // ==================== ROLE HANDLING ====================
          inventoryLink.style.display = 'none';
          myTicketsLink.style.display = 'none';
          document.getElementById('rooms-link-a').style.display = 'none';
          document.getElementById('tasks-link').style.display = 'none';
          if (notifWrapper) notifWrapper.style.display = 'none';

          if (role === 'Admin' || role === 'Maintenance') {
            if (notifWrapper) notifWrapper.style.display = 'flex';

            const roomsLink = document.getElementById('rooms-link-a');
            const tasksLink = document.getElementById('tasks-link');

            if (role === 'Admin') {
              inventoryLink.style.display = 'block';
              myTicketsLink.style.display = 'block';
              roomsLink.style.display = 'block';
              tasksLink.style.display = 'none';
            }

            if (role === 'Maintenance') {
              roomsLink.style.display = 'none';
              inventoryLink.style.display = 'none';
              myTicketsLink.style.display = 'none';
              tasksLink.style.display = 'block';
            }

            ticketUnsub = db.collection('tickets')
              .orderBy('createdAt', 'desc')
              .limit(20)
              .onSnapshot(snapshot => renderNotifications(snapshot.docs, true));

          } else if (role === 'User') {
            inventoryLink.style.display = 'none';
            myTicketsLink.style.display = 'block';
            if (notifWrapper) notifWrapper.style.display = 'flex';
            document.getElementById('rooms-link-a').style.display = 'none';

            notifUnsub = db.collection('notifications')
              .where("createdByRole", "==", "Admin")
              .orderBy("createdAt", "desc")
              .limit(20)
              .onSnapshot(snapshot => {
                renderNotifications(snapshot.docs, false);
                if (snapshot.empty) {
                  const emptyEl = notifDropdown.querySelector(".notif-empty");
                  if (emptyEl) emptyEl.style.display = "block";
                  notifList.innerHTML = "";
                  showNotification(0);
                }
              });
          } else {
            inventoryLink.style.display = 'none';
            myTicketsLink.style.display = 'none';
            if (notifWrapper) notifWrapper.style.display = 'none';
            document.getElementById('rooms-link-a').style.display = 'none';
          }
        }
      })
      .catch(() => {
        inventoryLink.style.display = 'none';
        myTicketsLink.style.display = 'none';
        if (notifWrapper) notifWrapper.style.display = 'none';
        document.getElementById('rooms-link-a').style.display = 'none';
      });

  } else {
    // ==================== LOGGED OUT STATE ====================
    avatar.style.display = 'none';
    sideNav.classList.remove('active');
    loginBtn.style.display = 'inline-flex';
    inventoryLink.style.display = 'none';
    myTicketsLink.style.display = 'none';
    document.getElementById('user-role').style.display = 'none';
    document.getElementById('tasks-link').style.display = 'none';
    if (notifWrapper) notifWrapper.style.display = 'none';
    notifList.innerHTML = "";
    showNotification(0);
    const emptyEl = notifDropdown.querySelector(".notif-empty");
    if (emptyEl) emptyEl.style.display = "block";
    document.getElementById('rooms-link-a').style.display = 'none';
    const roomsLi = document.getElementById('rooms-link');
    if (roomsLi) roomsLi.style.display = 'none';

    // ✅ Restore original background when logged out
    document.body.style.background = "url('Assets/BG_Main.jpg') no-repeat center center fixed";
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundPosition = 'center';


    // ✅ Reset avatar image on logout
    const avatarImgEl = document.querySelector('#user-avatar img');
    if (avatarImgEl) {
      avatarImgEl.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    }
  }
});

  // ==================== NOTIFICATION DROPDOWN ====================
  if (notifBtn) {
    notifBtn.addEventListener('click', () => notifDropdown.classList.toggle('visible'));
    document.addEventListener('click', (event) => {
      if (notifWrapper && !notifWrapper.contains(event.target)) {
        notifDropdown.classList.remove('visible');
      }
    });
  }

  // ==================== NAVIGATION HANDLER ====================
  const navUl = document.querySelector('nav.side-nav ul');
  navUl.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      const id = e.target.id;
      const pageMap = {
        'home-link': 'home',
        'my-tickets-link-a': 'mytickets',
        'inventory-link-a': 'inventory',
        'profile-link': 'profile',
        'rooms-link-a': 'rooms',
        'tasks-link-a': 'tasks'
      };
      if (pageMap[id]) {
        e.preventDefault();
        loadPage(pageMap[id]);
        setActiveLink(e.target);
      }
    }
  });

  function setActiveLink(activeLink) {
    const allLinks = navUl.querySelectorAll('li a');
    allLinks.forEach(l => l.classList.remove('active'));
    activeLink.classList.add('active');
  }

  // ==================== 🧼 CSS CLEANUP HELPER ====================
  function clearPageCSS() {
    const pageCSS = document.querySelectorAll('link[id$="-css"]');
    pageCSS.forEach(link => link.remove());
  }

  // ==================== DYNAMIC PAGE LOADER ====================
  function loadPage(page) {
    clearPageCSS(); 
      if (page === 'home') {
        document.body.classList.add('no-scroll');
      } else {
        document.body.classList.remove('no-scroll');
      }

    let fileName = '';
    let bgImage = '';
    switch (page) {
      case 'home':
        fileName = 'home.html';
        bgImage = "url('Assets/BG_Main.jpg')";
        break;
      case 'mytickets':
        fileName = 'tickets-content.html';
        bgImage = "url('Assets/BG_Inventory.jpg')";
        break;
      case 'inventory':
        fileName = 'inventory.html';
        bgImage = "url('Assets/BG_Inventory.jpg')";
        break;
      case 'profile':
        fileName = 'profile.html';
        bgImage = "url('Assets/BG_Main.jpg')";
        break;
      case 'rooms':
        fileName = 'rooms.html';
        break;
      case 'tasks':
        fileName = 'tasks.html';
        bgImage = "url('Assets/BG_Inventory.jpg')";
        break;
      default:
        fileName = 'home.html';
        bgImage = "url('Assets/BG_Main.jpg')";
    }

    fetch(fileName)
      .then(response => {
        if (!response.ok) throw new Error('Page not found');
        return response.text();
      })
      .then(html => {
        document.getElementById('main-content').innerHTML = html;
        document.body.style.backgroundImage = bgImage;

        function loadCSS(id, href) {
          const pageCSS = document.querySelectorAll('link[id$="-css"]');
          pageCSS.forEach(link => link.remove());
          const cssLink = document.createElement('link');
          cssLink.id = id;
          cssLink.rel = 'stylesheet';
          cssLink.href = href;
          document.head.appendChild(cssLink);
        }

        function loadJS(id, src, isModule = true) {
          const oldScript = document.getElementById(id);
          if (oldScript) oldScript.remove();
          const script = document.createElement('script');
          script.id = id;
          script.src = `${src}?t=${Date.now()}`;
          script.type = isModule ? 'module' : 'text/javascript';
          script.defer = true;
          document.body.appendChild(script);
        }

        if (page === 'home') {
          loadCSS('home-css', 'home.css');
          loadJS('home-js', 'home.js');
        }
        if (page === 'inventory') {
          loadCSS('inventory-css', 'inventory.css');
          loadJS('chart-lib', 'chart.umd.js', false);
          loadJS('inventory-js', 'inventory.js', true);
        }
        if (page === 'mytickets') {
          loadCSS('tickets-css', 'tickets-content.css');
          loadJS('tickets-js', 'tickets-content.js');
        }
        if (page === 'profile') {
          loadCSS('profile-css', 'profile.css');
          loadJS('profile-js', 'profile.js');
        }
        if (page === 'rooms') {
          loadJS('chart-lib', 'chart.umd.js', false);
          loadCSS('rooms-css', 'rooms.css');
          loadJS('rooms-js', 'rooms.js');
        }
        if (page === 'tasks') {
          loadCSS('tasks-css', 'tasks.css');
          loadJS('tasks-js', 'tasks.js');
        }
      })
      .catch(err => {
        document.getElementById('main-content').innerHTML = '<p>Error loading page.</p>';
        console.error(err);
      });
  }
};
