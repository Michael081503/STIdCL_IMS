window.addEventListener("load", () => {
  document.querySelectorAll(".landing-box").forEach((box, i) => {
    box.style.animationDelay = `${i * 0.3}s`;
  });
});
