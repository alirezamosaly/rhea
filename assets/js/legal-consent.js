(() => {
  const CONSENT_KEY = "rhea-cookie-consent-v2";
  let consent;

  try {
    consent = localStorage.getItem(CONSENT_KEY);
  } catch (error) {
    consent = null;
  }

  if (consent) return;

  const banner = document.createElement("aside");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Hinweis zu Cookies und lokalen Daten");
  banner.innerHTML = `
    <strong>Cookies &amp; lokale Daten</strong>
    <p>Wir setzen keine Analyse- oder Werbecookies ein. App-Daten bleiben lokal in diesem Browser. Deine Auswahl speichert nur, ob du optionale Cookies erlaubst oder ablehnst; solche Cookies werden derzeit nicht verwendet.</p>
    <div class="cookie-banner-actions">
      <a href="legal.html">Mehr Informationen</a>
      <div>
        <button class="cookie-reject" type="button" data-consent="rejected">Ablehnen</button>
        <button class="button button-green" type="button" data-consent="accepted">Akzeptieren</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  banner.querySelectorAll("[data-consent]").forEach(button => button.addEventListener("click", () => {
    try {
      localStorage.setItem(CONSENT_KEY, button.dataset.consent);
    } catch (error) {
      // Die Seite bleibt auch dann nutzbar, wenn der Browser keinen Speicher erlaubt.
    }
    banner.remove();
  }));
})();
