(() => {
  const INTEREST_KEY = "rhea-product-interest-v1";
  const CART_KEY = "rhea-product-cart-v1";
  const PRICE_CENTS = 5000;
  const toast = document.querySelector("#product-toast");
  let toastTimer;

  function readStoredNumber(key, fallback = 0) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
    } catch (error) {
      console.error("Rhea-Daten konnten nicht geladen werden.", error);
      return fallback;
    }
  }

  function writeStoredNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      console.error("Rhea-Daten konnten nicht gespeichert werden.", error);
      showToast("Änderungen konnten nicht gespeichert werden. Bitte prüfe den Browserspeicher.");
      return false;
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function initHeroScene() {
    const scene = document.querySelector("#hero-scene");
    const bottle = scene?.querySelector("[data-hero-bottle]");
    const canvas = scene?.querySelector(".scene-particles");
    if (!scene || !bottle || !canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      scene.addEventListener("pointermove", event => {
        const bounds = scene.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        bottle.style.setProperty("--scene-ry", `${x * 14}deg`);
        bottle.style.setProperty("--scene-rx", `${y * -9}deg`);
      });
      scene.addEventListener("pointerleave", () => {
        bottle.style.setProperty("--scene-ry", "0deg");
        bottle.style.setProperty("--scene-rx", "0deg");
      });
    }

    const context = canvas.getContext("2d");
    if (!context || reduceMotion) return;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    const particles = [];

    const resize = () => {
      const bounds = scene.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      particles.length = 0;
      for (let index = 0; index < 28; index += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1 + Math.random() * 2,
          speed: 0.15 + Math.random() * 0.35,
          opacity: 0.2 + Math.random() * 0.35
        });
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      particles.forEach(particle => {
        particle.y -= particle.speed;
        if (particle.y < 0) particle.y = height;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(96, 134, 110, ${particle.opacity})`;
        context.fill();
      });
      window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.requestAnimationFrame(draw);
  }

  function renderInterest() {
    const count = readStoredNumber(INTEREST_KEY);
    document.querySelectorAll("[data-interest-count]").forEach(element => {
      element.textContent = new Intl.NumberFormat("de-DE").format(count);
    });
    document.querySelectorAll("[data-interest]").forEach(button => {
      const active = count > 0;
      button.setAttribute("aria-pressed", String(active));
      const label = button.querySelector(".interest-label");
      if (label) label.textContent = active ? "Interesse zurückziehen" : "Ich bin interessiert";
    });
  }

  function renderCart() {
    const quantity = readStoredNumber(CART_KEY);
    document.querySelectorAll("[data-cart-count]").forEach(element => {
      element.textContent = String(quantity);
    });
    document.querySelectorAll("[data-cart-quantity]").forEach(element => {
      element.textContent = String(quantity);
    });
    document.querySelectorAll("[data-cart-total]").forEach(element => {
      element.textContent = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(PRICE_CENTS * quantity / 100);
    });
  }

  document.querySelectorAll("[data-interest]").forEach(button => {
    button.addEventListener("click", () => {
      const current = readStoredNumber(INTEREST_KEY);
      const next = current > 0 ? 0 : 1;
      if (writeStoredNumber(INTEREST_KEY, next)) {
        renderInterest();
        showToast(next ? "Danke für dein Interesse an Rhea!" : "Dein Interesse wurde zurückgenommen.");
      }
    });
  });

  const quantityInput = document.querySelector("#quantity");
  function setQuantity(value) {
    if (!quantityInput) return 1;
    const quantity = Math.min(9, Math.max(1, Math.round(Number(value) || 1)));
    quantityInput.value = String(quantity);
    return quantity;
  }

  if (quantityInput) {
    quantityInput.addEventListener("change", () => setQuantity(quantityInput.value));
    document.querySelectorAll("[data-quantity-step]").forEach(button => {
      button.addEventListener("click", () => setQuantity(Number(quantityInput.value) + Number(button.dataset.quantityStep)));
    });
  }

  const cartDialog = document.querySelector("#cart-dialog");
  document.querySelectorAll("[data-add-cart]").forEach(button => {
    button.addEventListener("click", () => {
      const current = readStoredNumber(CART_KEY);
      const next = Math.min(99, current + setQuantity(quantityInput?.value));
      if (writeStoredNumber(CART_KEY, next)) {
        renderCart();
        if (cartDialog && !cartDialog.open) cartDialog.showModal();
      }
    });
  });

  document.querySelectorAll("[data-open-cart]").forEach(button => {
    button.addEventListener("click", () => {
      if (cartDialog && !cartDialog.open) cartDialog.showModal();
    });
  });
  document.querySelectorAll("[data-close-cart]").forEach(button => button.addEventListener("click", () => cartDialog?.close()));
  if (cartDialog) {
    cartDialog.addEventListener("click", event => {
      if (event.target === cartDialog) cartDialog.close();
    });
  }
  document.querySelectorAll("[data-demo-checkout]").forEach(button => {
    button.addEventListener("click", () => showToast("Demo-Kasse: Es wurde keine Bestellung ausgelöst und nichts berechnet."));
  });
  window.addEventListener("storage", event => {
    if (event.key === INTEREST_KEY) renderInterest();
    if (event.key === CART_KEY) renderCart();
  });

  initHeroScene();
  renderInterest();
  renderCart();
})();
