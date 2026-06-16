const grid = document.getElementById("productGrid");
const filtersEl = document.getElementById("filters");
const searchBox = document.getElementById("searchBox");
const noResults = document.getElementById("noResults");

let allProducts = [];
let categories = [];
let activeCategory = "All";

async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const data = await res.json();
    allProducts = data.products || [];
    categories = ["All", ...(data.categories || [])];
    renderFilters();
    render();
  } catch (err) {
    grid.innerHTML = `<p class="no-results">Couldn't load products. Please refresh.</p>`;
  }
}

function renderFilters() {
  filtersEl.innerHTML = categories
    .map(
      (c) =>
        `<button class="filter-chip${c === activeCategory ? " is-active" : ""}" data-cat="${c}">${c}</button>`
    )
    .join("");
  filtersEl.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.getAttribute("data-cat");
      filtersEl.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      render();
    });
  });
}

function priceTag(p) {
  return `$${p.price.toFixed(2)}`;
}

function cardHTML(p) {
  const tags = p.treats.slice(0, 4).map((t) => `<span class="tag">${t}</span>`).join("");
  return `
    <article class="product-card" data-id="${p.id}">
      <div class="product-card__top">
        <span class="product-card__icon">${p.icon}</span>
        <span class="product-card__cat">${p.category}</span>
      </div>
      <h3 class="product-card__name">${p.name}</h3>
      <p class="product-card__generic">${p.generic}</p>
      <p class="product-card__blurb">${p.blurb}</p>
      <div class="product-card__meta">
        <p><strong>Dose:</strong> ${p.dosage}</p>
        <p class="product-card__warn"><strong>⚠</strong> ${p.warnings}</p>
      </div>
      <div class="product-card__tags">${tags}</div>
      <div class="product-card__foot">
        <span class="product-card__price">${priceTag(p)}</span>
        <button class="btn btn--soft product-card__ask" data-ask="${escapeAttr(p.name)}">Ask Remy</button>
      </div>
    </article>`;
}

function escapeAttr(s) {
  return s.replace(/"/g, "&quot;");
}

function render() {
  const q = (searchBox.value || "").trim().toLowerCase();
  const filtered = allProducts.filter((p) => {
    const inCat = activeCategory === "All" || p.category === activeCategory;
    if (!inCat) return false;
    if (!q) return true;
    const haystack = [p.name, p.generic, p.category, p.blurb, ...p.treats].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  grid.innerHTML = filtered.map(cardHTML).join("");
  noResults.hidden = filtered.length !== 0;

  grid.querySelectorAll(".product-card__ask").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-ask");
      askRemyAbout(name);
    });
  });
}

// Opens the chat and pre-fills a question about a specific product.
function askRemyAbout(productName) {
  const input = document.getElementById("chatInput");
  document.querySelector("[data-open-chat]")?.click();
  if (input) {
    input.value = `Tell me about ${productName} — is it right for me and how do I take it?`;
    input.focus();
  }
}

searchBox.addEventListener("input", render);
loadProducts();
