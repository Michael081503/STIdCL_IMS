(function attachGetStartedHandler() {
  // Run this after a short delay to ensure the page is injected
  const checkInterval = setInterval(() => {
    const getStartedBtn = document.getElementById("get-started-btn");
    const loginModal = document.getElementById("login-modal");

    if (getStartedBtn && loginModal) {
      clearInterval(checkInterval);

      getStartedBtn.addEventListener("click", () => {
        console.log("🟦 Get Started button clicked");
        loginModal.style.display = "block";

        // reset to login mode (just like your main script logic)
        const modalTitle = loginModal.querySelector("h2");
        const registerBtn = document.getElementById("register-btn");
        const loginBtn = document.getElementById("login-btn");
        const toggleLogin = document.getElementById("toggle-login");
        const toggleRegister = document.getElementById("toggle-register");
        const firstName = document.getElementById("first-name");
        const lastName = document.getElementById("last-name");
        const loginOptions = document.getElementById("login-options");

        modalTitle.textContent = "Login";
        registerBtn.style.display = "none";
        loginBtn.style.display = "block";
        toggleLogin.style.display = "none";
        toggleRegister.style.display = "block";
        firstName.style.display = "none";
        lastName.style.display = "none";
        if (loginOptions) loginOptions.style.display = "flex";
      });

      console.log("✅ Get Started button handler attached");
    }
  }, 200);
})();
