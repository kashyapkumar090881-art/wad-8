"use strict";

let toastTimeoutId = null;
let toastAnimationFrameId = null;

function showToast(message, type = "info", duration = 3000) {
  const toastTypes = ["info", "success", "warning", "error"];
  const toastType = toastTypes.includes(type) ? type : "info";
  const toastDuration = Number.isFinite(duration) ? Math.max(0, duration) : 3000;
  // Reuse one live region so repeated messages replace the old toast.
  let toast = document.getElementById("toast-container");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-container";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
    toast.setAttribute("aria-hidden", "true");
    document.body.append(toast);
  }

  toast.textContent = String(message);
  toast.className = `toast-container toast-${toastType}`;
  toast.setAttribute("aria-hidden", "false");

  if (toastTimeoutId !== null) {
    window.clearTimeout(toastTimeoutId);
  }
  if (toastAnimationFrameId !== null) {
    window.cancelAnimationFrame(toastAnimationFrameId);
  }

  toast.classList.remove("is-visible");
  toastAnimationFrameId = window.requestAnimationFrame(() => {
    toast.classList.add("is-visible");
    toastAnimationFrameId = null;
  });

  toastTimeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.setAttribute("aria-hidden", "true");
    toastTimeoutId = null;
  }, toastDuration);
}

window.showToast = showToast;

let summaryToastTimeoutId = null;

function setupBookingSummary(form) {
  const matchSelect = form.querySelector('select[name="match"]');
  const standSelect = form.querySelector('select[name="stand"]');
  const quantityInput = form.querySelector('input[name="quantity"]');
  const summary = form.closest("section")?.querySelector("[data-booking-summary]");

  if (
    !(matchSelect instanceof HTMLSelectElement)
    || !(standSelect instanceof HTMLSelectElement)
    || !(quantityInput instanceof HTMLInputElement)
    || !summary
  ) {
    return;
  }

  const matchDisplay = summary.querySelector("[data-summary-match]");
  const standDisplay = summary.querySelector("[data-summary-stand]");
  const priceDisplay = summary.querySelector("[data-summary-price]");
  const quantityDisplay = summary.querySelector("[data-summary-quantity]");
  const totalDisplay = summary.querySelector("[data-summary-total]");

  if (!matchDisplay || !standDisplay || !priceDisplay || !quantityDisplay || !totalDisplay) {
    return;
  }

  const formatCurrency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  function updateSummary(notify = false) {
    const matchOption = matchSelect.selectedOptions[0];
    const standOption = standSelect.selectedOptions[0];
    const hasMatch = Boolean(matchOption?.value);
    const hasStand = Boolean(standOption?.value);
    const unitPrice = Number(standOption?.dataset.price);
    const hasValidPrice = hasStand && Number.isFinite(unitPrice) && unitPrice >= 0;
    const enteredQuantity = Number(quantityInput.value);
    const quantity = Number.isInteger(enteredQuantity) && enteredQuantity >= 1
      ? enteredQuantity
      : 0;
    const standName = hasStand
      ? standOption.dataset.label || standOption.textContent.trim()
      : "Not selected";

    matchDisplay.textContent = hasMatch ? matchOption.textContent.trim() : "Choose a match";
    standDisplay.textContent = standName;
    priceDisplay.textContent = hasValidPrice ? formatCurrency.format(unitPrice) : "—";
    quantityDisplay.textContent = String(quantity);
    totalDisplay.textContent = hasValidPrice
      ? formatCurrency.format(unitPrice * quantity)
      : "—";

    if (!notify) {
      return;
    }

    let message = "Summary updated: choose a match and stand.";
    if (hasMatch && !hasStand) {
      message = `Summary updated: ${matchOption.textContent.trim()}. Select a stand to see your total.`;
    } else if (hasStand && !hasValidPrice) {
      message = "Summary could not update: the selected stand has no valid price.";
    } else if (hasValidPrice) {
      message = `Summary updated: ${quantity} × ${standName} (${formatCurrency.format(unitPrice * quantity)})`;
    }

    // Debounce input/change events so one edit produces one toast.
    if (summaryToastTimeoutId !== null) {
      window.clearTimeout(summaryToastTimeoutId);
    }
    summaryToastTimeoutId = window.setTimeout(() => {
      showToast(message, hasValidPrice ? "success" : "info");
      summaryToastTimeoutId = null;
    }, 180);
  }

  matchSelect.addEventListener("change", () => updateSummary(true));
  standSelect.addEventListener("change", () => updateSummary(true));
  quantityInput.addEventListener("input", () => updateSummary(true));
  quantityInput.addEventListener("change", () => updateSummary(true));
  form.addEventListener("reset", () => {
    if (summaryToastTimeoutId !== null) {
      window.clearTimeout(summaryToastTimeoutId);
      summaryToastTimeoutId = null;
    }
    window.setTimeout(() => {
      updateSummary();
      showToast("Booking summary reset.", "info");
    }, 0);
  });
  updateSummary();
}

function setupMobileNavigation() {
  const navToggle = document.querySelector(".nav-toggle");
  const navPanel = document.querySelector(".nav-panel");
  const navLinks = document.getElementById("primary-navigation");

  if (
    !(navToggle instanceof HTMLButtonElement)
    || !navPanel
    || !navLinks
  ) {
    return;
  }

  function setMenuOpen(isOpen) {
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navPanel.classList.toggle("nav-open", isOpen);
    navLinks.classList.toggle("nav-open", isOpen);
  }

  navToggle.addEventListener("click", () => {
    setMenuOpen(navToggle.getAttribute("aria-expanded") !== "true");
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
      navToggle.focus();
    }
  });
}

function setupMatchCards() {
  const cardContainer = document.getElementById("match-cards-container");
  const teamFilter = document.getElementById("team-filter");

  if (!cardContainer || !(teamFilter instanceof HTMLSelectElement)) {
    return;
  }

  const cards = Array.from(cardContainer.querySelectorAll(".match-card"));
  const noMatchesMessage = document.getElementById("no-matches");
  const gridViewButton = document.getElementById("grid-view");
  const listViewButton = document.getElementById("list-view");

  function applyTeamFilter() {
    let visibleCount = 0;
    cards.forEach((card) => {
      const teams = (card.dataset.teams || "").split(/\s+/);
      const isVisible = teamFilter.value === "all" || teams.includes(teamFilter.value);
      card.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (noMatchesMessage) {
      noMatchesMessage.hidden = visibleCount > 0;
    }
  }

  function setMatchView(view) {
    const showList = view === "list";
    const wasList = cardContainer.classList.contains("list-view");
    cardContainer.classList.toggle("list-view", showList);

    if (gridViewButton instanceof HTMLButtonElement) {
      gridViewButton.classList.toggle("is-active", !showList);
      gridViewButton.setAttribute("aria-pressed", String(!showList));
    }
    if (listViewButton instanceof HTMLButtonElement) {
      listViewButton.classList.toggle("is-active", showList);
      listViewButton.setAttribute("aria-pressed", String(showList));
    }

    if (showList !== wasList) {
      showToast(`Showing ${showList ? "list" : "grid"} view.`, "info");
    }
  }

  teamFilter.addEventListener("change", applyTeamFilter);
  gridViewButton?.addEventListener("click", () => setMatchView("grid"));
  listViewButton?.addEventListener("click", () => setMatchView("list"));
  applyTeamFilter();
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const link = event.target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  const matchCard = link.closest("#match-cards-container .match-card");
  if (matchCard && link.matches('a[href*="booking.html"]')) {
    event.preventDefault();

    // Pass this card's match details to booking.html for preselection and feedback.
    const destination = new URL(link.href, window.location.href);
    const matchNumber = matchCard.dataset.matchNumber;

    if (link.dataset.matchId) {
      destination.searchParams.set("match", link.dataset.matchId);
    }
    if (matchNumber) {
      destination.searchParams.set("matchNumber", matchNumber);
    }
    destination.searchParams.set("source", "schedule");
    destination.hash = "booking-form";
    window.location.assign(destination.href);
    return;
  }

  const destination = new URL(link.href, window.location.href);
  const currentPage = new URL(window.location.href);
  if (
    destination.origin !== currentPage.origin
    || destination.pathname !== currentPage.pathname
    || !destination.hash
  ) {
    return;
  }

  const targetId = decodeURIComponent(destination.hash.slice(1));
  const scrollTarget = document.getElementById(targetId);
  if (!scrollTarget) {
    return;
  }

  event.preventDefault();
  scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });

  if (scrollTarget.id === "book-ticket" || scrollTarget.id === "booking-form") {
    if (scrollTarget instanceof HTMLFormElement) {
      scrollTarget.focus({ preventScroll: true });
    }
    showToast("Scrolling to the booking form...", "info");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  setupMobileNavigation();
  setupMatchCards();

  const bookingForm = document.getElementById("booking-form");
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get("match");
  const matchSelect = bookingForm?.querySelector('select[name="match"]');
  if (
    bookingForm instanceof HTMLFormElement
    && matchId
    && matchSelect instanceof HTMLSelectElement
    && Array.from(matchSelect.options).some((option) => option.value === matchId)
  ) {
    matchSelect.value = matchId;
  }

  document.querySelectorAll("form[data-booking-form]").forEach((form) => {
    if (form instanceof HTMLFormElement) {
      setupBookingSummary(form);
    }
  });

  if (!(bookingForm instanceof HTMLFormElement)) {
    return;
  }

  const isBookingLink = window.location.hash === "#booking-form";
  const cameFromSchedule = params.get("source") === "schedule";
  if (!isBookingLink && !cameFromSchedule) {
    return;
  }

  window.requestAnimationFrame(() => {
    bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
    bookingForm.focus({ preventScroll: true });
  });

  const matchNumber = params.get("matchNumber");
  const validMatchNumber = matchNumber && /^\d+$/.test(matchNumber);
  const message = validMatchNumber
    ? `Scrolling to booking form for Match #${matchNumber}...`
    : "Your booking form is ready.";
  showToast(message, "success");
});
