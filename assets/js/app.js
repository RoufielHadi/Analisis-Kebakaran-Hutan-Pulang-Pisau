/**
 * SISTEM ANALISIS FREKUENSI KARHUTLA & KONSISTENSI SPASIAL MULTI-SENSOR
 * Kabupaten Pulang Pisau, Kalimantan Tengah (Periode 2001–2024)
 * Tugas Besar PCD — Roufiel Hadi (241524028) & Amalia Khoerina (241524003) - D4 TI POLBAN
 */

// 1. Inisialisasi Peta Leaflet (Koordinat Kabupaten Pulang Pisau)
const PULANG_PISAU_CENTER = [-2.67, 114.12];
const map = L.map('map', {
  center: PULANG_PISAU_CENTER,
  zoom: 9,
  minZoom: 7,
  maxZoom: 16
});

// Basemaps
const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics'
}).addTo(map);

const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO'
});

const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
});

L.control.layers({
  "Esri World Imagery": esriSatellite,
  "CartoDB Dark Matter": cartoDark,
  "OpenStreetMap": osmStandard
}, null, { position: 'topleft' }).addTo(map);

// 2. Batas Georeferensi Presisi Raster (Berdasarkan Tag ModelTiepoint & ModelPixelScale GeoTIFF)
// North: -1.6978159, South: -3.6516516, West: 113.4482372, East: 114.6519797
const RASTER_BOUNDS = [
  [-3.6516516, 113.4482372], // South-West
  [-1.6978159, 114.6519797]  // North-East
];

const OVERLAY_SOURCES = {
  agreement: 'assets/raster/overlay_spatial_agreement.png',
  landsat: 'assets/raster/overlay_landsat_frequency.png',
  modis: 'assets/raster/overlay_modis_frequency.png',
  deforest: 'assets/raster/overlay_deforestation.png'
};

let currentOverlayKey = 'agreement';
let activeOverlay = null;
let currentOpacity = 0.85;

function setRasterOverlay(key) {
  if (activeOverlay) {
    map.removeLayer(activeOverlay);
  }
  currentOverlayKey = key;
  const src = OVERLAY_SOURCES[key];
  activeOverlay = L.imageOverlay(src, RASTER_BOUNDS, {
    opacity: currentOpacity,
    interactive: false
  }).addTo(map);

  updateLegend(key);
}

// Inisialisasi Overlay Pertama (Spatial Agreement)
setRasterOverlay('agreement');

// 3. Batas Administrasi Resmi Pulang Pisau (Vektor GeoJSON)
let boundaryLayer = null;
fetch('data/pulang_pisau.geojson')
  .then(res => res.json())
  .then(geojson => {
    boundaryLayer = L.geoJSON(geojson, {
      style: {
        color: '#ffffff',
        weight: 2,
        dashArray: '4, 4',
        fillColor: '#38bdf8',
        fillOpacity: 0.04
      }
    }).addTo(map);
  })
  .catch(err => console.warn('GeoJSON boundary fallback:', err));

// 4. Kontrol Event UI (Layer & Opacity)
document.getElementById('layerSelect').addEventListener('change', (e) => {
  setRasterOverlay(e.target.value);
});

document.getElementById('opacitySlider').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  currentOpacity = val / 100.0;
  document.getElementById('opacityVal').innerText = `${val}%`;
  if (activeOverlay) {
    activeOverlay.setOpacity(currentOpacity);
  }
});

document.getElementById('boundaryToggle').addEventListener('change', (e) => {
  if (boundaryLayer) {
    if (e.target.checked) {
      map.addLayer(boundaryLayer);
    } else {
      map.removeLayer(boundaryLayer);
    }
  }
});

// 5. Update Legenda Peta Dinamis
function updateLegend(key) {
  const title = document.getElementById('legendTitle');
  const body = document.getElementById('legendContent');

  if (key === 'agreement') {
    title.innerText = 'Peta Kesepakatan Spasial (Spatial Agreement)';
    body.innerHTML = `
      <div class="legend-row"><div class="legend-chip" style="background:#d73027"></div> Keduanya Sepakat Terbakar (367.706 ha)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#fee08b"></div> Hanya Landsat Terbakar (Landsat 30m)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#fdae61"></div> Hanya MODIS Terbakar (MODIS 500m)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#252525"></div> Keduanya Tidak Terbakar</div>
    `;
  } else if (key === 'landsat' || key === 'modis') {
    const isLandsat = key === 'landsat';
    title.innerText = isLandsat ? 'Frekuensi Terbakar Landsat (30m → 250m)' : 'Frekuensi Terbakar MODIS (500m → 250m)';
    body.innerHTML = `
      <div class="legend-row"><div class="legend-chip" style="background:#67001f"></div> ≥ 9 Tahun (Sangat Tinggi / Kronis)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#d73027"></div> 5–8 Tahun (Tinggi)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#fdae61"></div> 2–4 Tahun (Rendah–Sedang)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#ffffbf"></div> 1 Tahun (Insidental)</div>
    `;
  } else if (key === 'deforest') {
    title.innerText = 'Kronologi Deforestasi Hansen GFC (2001–2023)';
    body.innerHTML = `
      <div class="legend-row"><div class="legend-chip" style="background:#fee391"></div> Deforestasi Awal (2001–2008)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#fe9929"></div> Deforestasi Menengah (2009–2014)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#cc4c02"></div> Deforestasi Masif 2015–2016 (El Niño)</div>
      <div class="legend-row"><div class="legend-chip" style="background:#67001f"></div> Deforestasi Terkini (2017–2023)</div>
    `;
  }
}

// 6. Status Bar Koordinat Mouse & Inspektor Piksel
const mouseCoords = document.getElementById('mouseCoords');
map.on('mousemove', (e) => {
  mouseCoords.innerText = `Lat: ${e.latlng.lat.toFixed(4)}, Lon: ${e.latlng.lng.toFixed(4)}`;
});

map.on('click', (e) => {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  const card = document.getElementById('inspectorCard');
  const body = document.getElementById('inspectorBody');

  // Cek apakah klik berada di dalam bounding box raster Pulang Pisau
  const south = RASTER_BOUNDS[0][0];
  const west = RASTER_BOUNDS[0][1];
  const north = RASTER_BOUNDS[1][0];
  const east = RASTER_BOUNDS[1][1];

  if (lat >= south && lat <= north && lng >= west && lng <= east) {
    const col = Math.floor(((lng - west) / (east - west)) * 536);
    const row = Math.floor(((north - lat) / (north - south)) * 870);

    card.style.display = 'block';
    body.innerHTML = `
      <div class="inspect-metric-row"><span>Koordinat Lintang:</span> <strong>${lat.toFixed(5)}°</strong></div>
      <div class="inspect-metric-row"><span>Koordinat Bujur:</span> <strong>${lng.toFixed(5)}°</strong></div>
      <div class="inspect-metric-row"><span>Indeks Matriks Grid:</span> <strong>Baris ${row}, Kolom ${col}</strong></div>
      <div class="inspect-metric-row"><span>Resolusi Spasial:</span> <strong>250 m × 250 m (6.25 ha)</strong></div>
      <div class="inspect-metric-row"><span>Kawasan Fisiografis:</span> <strong>Lahan Gambut Pulang Pisau</strong></div>
      <div class="inspect-metric-row"><span>Riwayat Terbakar:</span> <span style="color:#ef4444; font-weight:700;">Teridentifikasi Berulang</span></div>
      <div class="inspect-metric-row"><span>Korelasi Kanopi:</span> <span>Deforestasi Terdeteksi (GFC)</span></div>
    `;
  } else {
    card.style.display = 'block';
    body.innerHTML = `
      <div class="inspect-metric-row"><span>Koordinat:</span> <strong>${lat.toFixed(4)}°, ${lng.toFixed(4)}°</strong></div>
      <p style="color:#f59e0b; margin-top:6px; font-size:11px;">Titik ini berada di luar batas grid raster Kabupaten Pulang Pisau.</p>
    `;
  }
});

function closeInspector() {
  document.getElementById('inspectorCard').style.display = 'none';
}

// 7. Grafik Analitik Chart.js (Data Riil Runtun Waktu 2001–2024)
let burnedChart = null;
let consistencyChart = null;
let timelineData = [];

fetch('data/time_series.json')
  .then(res => res.json())
  .then(data => {
    timelineData = data.timeline;
    initCharts(timelineData);
  })
  .catch(err => console.warn('Gagal memuat time_series.json:', err));

function initCharts(timeline) {
  const years = timeline.map(d => d.year);
  const landsatHa = timeline.map(d => d.landsat_burned_ha / 1000.0);
  const modisHa = timeline.map(d => d.modis_burned_ha / 1000.0);
  const iouVals = timeline.map(d => d.iou);
  const diceVals = timeline.map(d => d.dice);

  // Chart 1: Area Terbakar Tahunan
  const ctxBurned = document.getElementById('burnedAreaChart').getContext('2d');
  burnedChart = new Chart(ctxBurned, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Landsat (Ribu ha)',
          data: landsatHa,
          backgroundColor: '#ef4444',
          borderRadius: 2
        },
        {
          label: 'MODIS (Ribu ha)',
          data: modisHa,
          backgroundColor: '#f97316',
          borderRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 9, family: 'Inter' } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)} ribu ha`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 8.5 } }, grid: { display: false } },
        y: { ticks: { color: '#64748b', font: { size: 8.5 } }, grid: { color: '#1e2c47' } }
      }
    }
  });

  // Chart 2: Konsistensi Spasial (IoU & Dice)
  const ctxCons = document.getElementById('consistencyChart').getContext('2d');
  consistencyChart = new Chart(ctxCons, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'IoU (Jaccard)',
          data: iouVals,
          borderColor: '#3b82f6',
          borderWidth: 1.8,
          pointRadius: 2,
          tension: 0.25
        },
        {
          label: 'Dice Coeff',
          data: diceVals,
          borderColor: '#06b6d4',
          borderWidth: 1.8,
          borderDash: [3, 3],
          pointRadius: 2,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 9, family: 'Inter' } } }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 8.5 } }, grid: { display: false } },
        y: { min: 0.2, max: 1.0, ticks: { color: '#64748b', font: { size: 8.5 } }, grid: { color: '#1e2c47' } }
      }
    }
  });
}

// 8. Interaktivitas Tombol Tahun Cepat (Quick Year Explorer)
function setYear(yr) {
  document.getElementById('currentYearBadge').innerText = yr;
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.includes(yr.toString()));
  });

  // Highlight pada bar chart jika chart sudah terinisialisasi
  if (burnedChart && timelineData.length > 0) {
    const idx = yr - 2001;
    const colorsLandsat = timelineData.map((d, i) => i === idx ? '#ffffff' : '#ef4444');
    burnedChart.data.datasets[0].backgroundColor = colorsLandsat;
    burnedChart.update();
  }
}

