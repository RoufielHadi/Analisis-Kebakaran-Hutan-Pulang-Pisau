# System Architecture & Technical Specifications

**Tugas Besar Pengolahan Citra Digital (PCD) — Politeknik Negeri Bandung**  
**Tim:** Roufiel Hadi (241524028) & Amalia Khoerina (241524003)  
**Wilayah Analisis:** Kabupaten Pulang Pisau, Kalimantan Tengah  

---

## 1. Arsitektur Komputasi Geospasial & PCD

Sistem dirancang dengan pendekatan modular yang memisahkan tahap pemrosesan citra skala besar (*cloud processing*), komputasi analitik (*notebook/local*), serta penyajian hasil (*interactive GIS web frontend*).

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   TAHAP 1: AKUISISI CITRA MULTISENSOR                  │
│  - Landsat 7/8/9 Surface Reflectance (30m)                             │
│  - NASA MODIS Burned Area MCD64A1 (500m)                               │
│  - Batas Vektor Kabupaten Pulang Pisau (FAO GAUL / BIG)                │
│  - Hansen Global Forest Change v1.11 (30m)                             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│             TAHAP 2: CLOUD MASKING & PRE-PROCESSING (GEE)              │
│  - Masking Bitwise QA_PIXEL (Landsat): Cloud & Cloud Shadow Bit 3/4    │
│  - Filtering Valid BurnDate (MODIS): DOY 1-366                         │
│  - Spatial Clipping ke Batas Kabupaten Pulang Pisau                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│           TAHAP 3: BINARISASI & AGREGASI FREKUENSI TEMPORAL            │
│  - Binarisasi Tahunan: Bt(x, y) ∈ {0, 1, NoData}                      │
│  - Akumulasi Temporal 24 Tahun: F(x, y) = Σ Bt                        │
│  - Harmonisasi Grid Terpadu 250m (Opsi B)                              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
           ┌───────────────────────┴───────────────────────┐
           ▼                                               ▼
┌─────────────────────────────────────┐ ┌────────────────────────────────┐
│   TAHAP 4A: EVALUASI KONSISTENSI    │ │    TAHAP 4B: KORELASI DAMPAK   │
│  - Metrik IoU (Jaccard Index)       │ │  - Overlay Frekuensi ≥ 2       │
│  - Dice Similarity Coefficient      │ │    dengan Hansen Loss Year     │
│  - Peta Kesepakatan Spasial (4 Cat) │ │  - Estimasi Luas Deforestasi   │
└──────────────────┬──────────────────┘ └────────────────┬───────────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│            TAHAP 5: PENYAJIAN HASIL (DASHBOARD & LAPORAN)              │
│  - Visualisasi Web GIS Interaktif (Leaflet.js + Chart.js)              │
│  - Analisis Komparasi Split-Map & Time-Series Curves                   │
│  - Ekspor GeoTIFF & Agregasi JSON untuk Reproduksibilitas Riset        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Alur Harmonisasi Grid (Opsi B: 250 Meter)

Perbedaan resolusi antara Landsat (30 m) dan MODIS (500 m) menuntut metode harmonisasi yang adil tanpa memanipulasi informasi spasial asli:
* **Grid Referensi:** Ditentukan grid raster seragam dengan ukuran piksel $250 \times 250\text{ m}$ berproyeksi Web Mercator (`EPSG:3857`) atau UTM Zona 49S (`EPSG:32749`).
* **Downscaling / Agregasi Landsat (30m $\rightarrow$ 250m):**
  Dihitung rasio piksel terbakar dalam setiap sel 250m:
  $$\text{Fractional Burned Area} = \frac{\sum \text{Piksel Landsat Terbakar (30m)}}{\text{Total Piksel Landsat per Sel 250m}}$$
  Jika $\text{Fraction} \ge 0.5$, sel $250\text{m}$ diklasifikasikan sebagai terbakar ($1$).
* **Resampling MODIS (500m $\rightarrow$ 250m):**
  Menggunakan interpolasi *Nearest Neighbor* atau reduksi mayoritas agar nilai biner asli tidak terdistorsi.

---

## 3. Komponen Perangkat Lunak & Pustaka

| Lingkungan | Komponen / Pustaka | Fungsi Utama |
| :--- | :--- | :--- |
| **Cloud GIS** | Google Earth Engine (GEE API) | Filter koleksi citra satelit, cloud masking, komposit NBR, binarisasi biner massal, dan ekspor GeoTIFF. |
| **Komputasi Lokal / Colab** | Python 3.10+, Rasterio, Geopandas, NumPy, Pandas | Pembacaan raster GeoTIFF, kalkulasi matriks konfusi, perhitungan IoU/Dice, regresi linier. |
| **Visualisasi Data** | Matplotlib, Seaborn | Pembuatan grafik publikasi (histogram, boxplot, regresi korelasi). |
| **Web Frontend** | Leaflet.js v1.9.4, Chart.js v4.4.0, Vanilla CSS Modern | Dashboard web interaktif, peta multi-layer, kurva temporal, pixel inspector. |

