// City landing pages for local SEO.
// Expects <body data-city="Brooklyn" data-city-slug="brooklyn-barbers">
(function () {
  window.__currentNavPage = 'barbers';
  renderNav('barbers');
  renderFooter();
  applyI18n();

  const city = document.body.dataset.city || 'New York';
  const citySlug = document.body.dataset.citySlug || 'new-york-barbers';
  const esc = (v) => (typeof escapeHTML === 'function' ? escapeHTML(v) : String(v || ''));

  const allBarbers = getAllBarbers();
  const results = allBarbers
    .filter(b => (b.city || '').toLowerCase() === city.toLowerCase())
    .sort((a, b) => b.rating - a.rating);

  const grid = document.getElementById('cityBarbersGrid');
  const empty = document.getElementById('cityEmpty');
  const count = document.getElementById('cityCount');
  if (count) count.textContent = `${results.length} barber${results.length === 1 ? '' : 's'} in ${city}`;

  if (!results.length) {
    if (grid) grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
  } else if (grid) {
    grid.innerHTML = results.map(b => barberCardHTML(b)).join('');
    if (empty) empty.style.display = 'none';
  }

  const list = results.slice(0, 25).map((b, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    item: {
      '@type': 'BarberShop',
      name: b.shop_name || `${b.first_name} ${b.last_name}`,
      address: b.location || b.city,
      areaServed: city,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: b.rating,
        reviewCount: b.total_reviews
      },
      url: `profile.html?id=${b.id}`
    }
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${city} Barbers | BarberHub`,
    url: `/${citySlug}.html`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: list
    }
  };
  const schemaEl = document.getElementById('citySchema');
  if (schemaEl) schemaEl.textContent = JSON.stringify(schema);

  if (typeof Analytics !== 'undefined') {
    Analytics.track('barber_search', { source: 'city_page', city });
  }

  const titleEl = document.getElementById('cityTitle');
  const introEl = document.getElementById('cityIntro');
  if (titleEl) titleEl.textContent = `Best Barbers in ${city}`;
  if (introEl) {
    introEl.innerHTML = `Compare ratings, next open slots, and prices for trusted barbers in <strong>${esc(city)}</strong>.`;
  }
})();
