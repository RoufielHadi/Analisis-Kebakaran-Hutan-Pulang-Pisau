"""
====================================================================================================
TUGAS BESAR PENGOLAHAN CITRA DIGITAL (PCD) - SEMESTER 5
PROGRAM STUDI D4 TEKNIK INFORMATIKA - POLITEKNIK NEGERI BANDUNG (POLBAN)
====================================================================================================
TOPIK      : Analisis Frekuensi Area Terbakar Berulang & Konsistensi Spasial (Landsat vs. MODIS)
LOKASI     : Kabupaten Pulang Pisau, Kalimantan Tengah (Periode 2001–2024)
MAHASISWA  : 1. Roufiel Hadi (241524028)
             2. Amalia Khoerina (241524003)
====================================================================================================
"""

import os
import sys

# Konfigurasi thread OpenBLAS untuk stabilitas lingkungan Windows/Linux
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import cv2
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import pandas as pd


def get_base_dir():
    # Mendeteksi lokasi direktori dataset
    current_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(current_dir, "Dataset"),
        os.path.join(current_dir, "..", "Dataset"),
        os.path.join(os.getcwd(), "Dataset"),
        os.path.join(os.getcwd(), "Analisis Kebakaran Hutan di Pulang Pisau", "Dataset"),
        "/content/Dataset",
        "/content/Analisis-Kebakaran-Hutan-Pulang-Pisau/Dataset",
    ]
    for c in candidates:
        if os.path.exists(c) and any(f.endswith(".tif") for f in os.listdir(c)):
            return os.path.abspath(c)
    return os.path.join(current_dir, "Dataset")


def load_dataset(dataset_dir):
    files = {
        "landsat": "Frekuensi_Terbakar_Landsat_2001_2024.tif",
        "modis": "Frekuensi_Terbakar_MODIS_2001_2024.tif",
        "agreement": "Spatial_Agreement_Landsat_MODIS_Pulang_Pisau.tif",
        "deforest": "Kronologi_Deforestasi_Hansen_Pulang_Pisau.tif",
    }
    rasters = {}
    print(f"[*] Membaca raster dari direktori: {dataset_dir}")
    for key, fname in files.items():
        path = os.path.join(dataset_dir, fname)
        if not os.path.exists(path):
            raise FileNotFoundError(f"[!] File GeoTIFF tidak ditemukan: {path}")
        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
        rasters[key] = img
        print(f"    -> {fname} [Shape: {img.shape}, Dtype: {img.dtype}]")
    return rasters


def compute_metrics(rasters):
    f_landsat = rasters["landsat"]
    f_modis = rasters["modis"]
    agreement = rasters["agreement"]
    deforest = rasters["deforest"]

    PIXEL_HA = (250.0 * 250.0) / 10000.0  # 6.25 ha per piksel

    # Binarisasi Area Pernah Terbakar (F >= 1)
    l_burned = f_landsat >= 1
    m_burned = f_modis >= 1

    intersection = np.logical_and(l_burned, m_burned).sum()
    union = np.logical_or(l_burned, m_burned).sum()

    iou = intersection / union if union > 0 else 0.0
    dice = (2.0 * intersection) / (l_burned.sum() + m_burned.sum())

    # Klasifikasi Frekuensi Terbakar Berulang
    def classify_freq(arr):
        cls = np.zeros_like(arr, dtype=np.uint8)
        cls[arr == 1] = 1
        cls[(arr >= 2) & (arr <= 4)] = 2
        cls[(arr >= 5) & (arr <= 8)] = 3
        cls[arr >= 9] = 4
        return cls

    cls_l = classify_freq(f_landsat)
    cls_m = classify_freq(f_modis)

    class_names = ["0 Tahun (Tidak)", "1 Tahun (Insidental)", "2–4 Tahun (Rendah–Sedang)", "5–8 Tahun (Sedang–Tinggi)", "≥ 9 Tahun (Kronis)"]
    df_freq = pd.DataFrame({
        "Kelas Frekuensi": class_names,
        "Piksel Landsat": [np.sum(cls_l == i) for i in range(5)],
        "Luas Landsat (ha)": [np.sum(cls_l == i) * PIXEL_HA for i in range(5)],
        "Piksel MODIS": [np.sum(cls_m == i) for i in range(5)],
        "Luas MODIS (ha)": [np.sum(cls_m == i) * PIXEL_HA for i in range(5)],
    })

    # Matriks Kesepakatan Spasial (Spatial Agreement)
    agr_names = ["Keduanya Tidak Terbakar", "Hanya Landsat Terbakar", "Hanya MODIS Terbakar", "Keduanya Sepakat Terbakar"]
    df_agr = pd.DataFrame({
        "Kategori Kesepakatan": agr_names,
        "Piksel": [np.sum(agreement == i) for i in range(4)],
        "Luas (ha)": [np.sum(agreement == i) * PIXEL_HA for i in range(4)],
        "Persentase (%)": [(np.sum(agreement == i) / agreement.size) * 100 for i in range(4)],
    })

    # Korelasi dengan Deforestasi Hansen (lossyear >= 1)
    deforested = deforest >= 1
    recurrent_fire = np.logical_or(f_landsat >= 2, f_modis >= 2)
    defor_in_fire = np.logical_and(deforested, recurrent_fire).sum()
    pct_defor_fire = (defor_in_fire / deforested.sum()) * 100 if deforested.sum() > 0 else 0.0

    metrics_summary = {
        "l_burned_pixels": int(l_burned.sum()),
        "l_burned_ha": float(l_burned.sum() * PIXEL_HA),
        "m_burned_pixels": int(m_burned.sum()),
        "m_burned_ha": float(m_burned.sum() * PIXEL_HA),
        "intersection_pixels": int(intersection),
        "intersection_ha": float(intersection * PIXEL_HA),
        "union_pixels": int(union),
        "union_ha": float(union * PIXEL_HA),
        "iou": float(iou),
        "dice": float(dice),
        "total_defor_pixels": int(deforested.sum()),
        "total_defor_ha": float(deforested.sum() * PIXEL_HA),
        "defor_in_fire_pixels": int(defor_in_fire),
        "defor_in_fire_ha": float(defor_in_fire * PIXEL_HA),
        "pct_defor_in_fire": float(pct_defor_fire),
    }

    return metrics_summary, df_freq, df_agr, cls_l, cls_m


def generate_plots(rasters, metrics, df_freq, df_agr, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    f_landsat = rasters["landsat"]
    f_modis = rasters["modis"]
    agreement = rasters["agreement"]
    deforest = rasters["deforest"]

    print("[*] Membuat visualisasi grafik publikasi...")

    # 1. Peta Komparasi 4-Panel
    fig, axes = plt.subplots(2, 2, figsize=(16, 18), dpi=150)
    plt.subplots_adjust(wspace=0.15, hspace=0.15)

    # Panel A: Frekuensi Landsat
    cmap_freq = mcolors.ListedColormap(["#2b83ba", "#ffffbf", "#fdae61", "#f46d43", "#d73027", "#67001f"])
    bounds_freq = [0, 1, 2, 5, 9, 15, 25]
    norm_freq = mcolors.BoundaryNorm(bounds_freq, cmap_freq.N)

    im0 = axes[0, 0].imshow(f_landsat, cmap=cmap_freq, norm=norm_freq)
    axes[0, 0].set_title("(A) Frekuensi Terbakar Berulang Landsat (30m / 250m)", fontsize=12, fontweight="bold")
    axes[0, 0].axis("off")
    cbar0 = plt.colorbar(im0, ax=axes[0, 0], orientation="horizontal", pad=0.04, fraction=0.046)
    cbar0.set_label("Jumlah Tahun Terbakar (2001–2024)", fontsize=10)

    # Panel B: Frekuensi MODIS
    im1 = axes[0, 1].imshow(f_modis, cmap=cmap_freq, norm=norm_freq)
    axes[0, 1].set_title("(B) Frekuensi Terbakar Berulang MODIS (500m / 250m)", fontsize=12, fontweight="bold")
    axes[0, 1].axis("off")
    cbar1 = plt.colorbar(im1, ax=axes[0, 1], orientation="horizontal", pad=0.04, fraction=0.046)
    cbar1.set_label("Jumlah Tahun Terbakar (2001–2024)", fontsize=10)

    # Panel C: Spatial Agreement
    cmap_agr = mcolors.ListedColormap(["#252525", "#fee08b", "#fdae61", "#d73027"])
    bounds_agr = [-0.5, 0.5, 1.5, 2.5, 3.5]
    norm_agr = mcolors.BoundaryNorm(bounds_agr, cmap_agr.N)

    im2 = axes[1, 0].imshow(agreement, cmap=cmap_agr, norm=norm_agr)
    axes[1, 0].set_title(f"(C) Peta Kesepakatan Spasial (IoU: {metrics['iou']:.2%}, Dice: {metrics['dice']:.2%})", fontsize=12, fontweight="bold")
    axes[1, 0].axis("off")
    cbar2 = plt.colorbar(im2, ax=axes[1, 0], orientation="horizontal", pad=0.04, fraction=0.046, ticks=[0, 1, 2, 3])
    cbar2.ax.set_xticklabels(["Tidak", "Landsat Saja", "MODIS Saja", "Sepakat"], fontsize=9)

    # Panel D: Kronologi Deforestasi Hansen
    cmap_def = plt.colormaps["YlOrRd"].resampled(23)
    cmap_def.set_under("#252525")
    im3 = axes[1, 1].imshow(deforest, cmap=cmap_def, vmin=1, vmax=23)
    axes[1, 1].set_title("(D) Kronologi Deforestasi Kanopi Pohon (Hansen GFC 2001–2023)", fontsize=12, fontweight="bold")
    axes[1, 1].axis("off")
    cbar3 = plt.colorbar(im3, ax=axes[1, 1], orientation="horizontal", pad=0.04, fraction=0.046)
    cbar3.set_label("Tahun Kehilangan Kanopi (1=2001, 15=2015, 23=2023)", fontsize=10)

    peta_path = os.path.join(output_dir, "peta_komparasi_4panel.png")
    fig.savefig(peta_path, bbox_inches="tight")
    plt.close(fig)
    print(f"    [+] Peta 4-panel tersimpan: {peta_path}")

    # 2. Grafik Batang Distribusi Frekuensi
    fig, ax = plt.subplots(figsize=(10, 5), dpi=150)
    x = np.arange(len(df_freq["Kelas Frekuensi"]))
    w = 0.35
    ax.bar(x - w / 2, df_freq["Luas Landsat (ha)"] / 1000.0, width=w, label="Landsat (30m)", color="#d73027", alpha=0.9)
    ax.bar(x + w / 2, df_freq["Luas MODIS (ha)"] / 1000.0, width=w, label="MODIS (500m)", color="#fdae61", alpha=0.9)

    ax.set_xticks(x)
    ax.set_xticklabels(df_freq["Kelas Frekuensi"], fontsize=10)
    ax.set_ylabel("Luas Area (Ribu Hektar)", fontsize=11, fontweight="bold")
    ax.set_title("Distribusi Luas Wilayah Berdasarkan Kelas Frekuensi Terbakar (2001–2024)", fontsize=12, fontweight="bold")
    ax.legend(frameon=True)
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    bar_path = os.path.join(output_dir, "distribusi_frekuensi_terbakar.png")
    fig.savefig(bar_path, bbox_inches="tight")
    plt.close(fig)
    print(f"    [+] Grafik distribusi tersimpan: {bar_path}")

    # 3. Grafik Deforestasi Tahunan
    years = np.arange(2001, 2024)
    loss_ha = [np.sum(deforest == (y - 2000)) * (250.0 * 250.0 / 10000.0) for y in years]

    fig, ax = plt.subplots(figsize=(12, 5), dpi=150)
    bars = ax.bar(years, np.array(loss_ha) / 1000.0, color="#b2182b", alpha=0.85, edgecolor="#67001f")

    # Sorot tahun El Niño besar
    for y in [2002, 2006, 2009, 2014, 2015, 2019, 2023]:
        idx = y - 2001
        ax.annotate("El Niño", (y, loss_ha[idx] / 1000.0 + 3), ha="center", fontsize=8, fontweight="bold", color="#67001f", rotation=45)

    ax.set_xticks(years)
    ax.set_xticklabels(years, rotation=45, fontsize=9)
    ax.set_ylabel("Luas Deforestasi (Ribu Hektar)", fontsize=11, fontweight="bold")
    ax.set_title("Tren Kehilangan Tutupan Hutan Tahunan di Kabupaten Pulang Pisau (Hansen GFC 2001–2023)", fontsize=12, fontweight="bold")
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    defor_path = os.path.join(output_dir, "tren_deforestasi_tahunan.png")
    fig.savefig(defor_path, bbox_inches="tight")
    plt.close(fig)
    print(f"    [+] Grafik deforestasi tersimpan: {defor_path}")


def main():
    print("=" * 80)
    print("ANALISIS PENGOLAHAN CITRA DIGITAL (PCD) - KABUPATEN PULANG PISAU")
    print("Kelompok: Roufiel Hadi (241524028) & Amalia Khoerina (241524003) - D4 TI POLBAN")
    print("=" * 80)

    dataset_dir = get_base_dir()
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(current_dir, "output")

    rasters = load_dataset(dataset_dir)
    metrics, df_freq, df_agr, cls_l, cls_m = compute_metrics(rasters)

    print("\n" + "=" * 40 + " RINGKASAN METRIK KONSISTENSI SPASIAL " + "=" * 40)
    print(f"Total Piksel Landsat Terbakar (F >= 1): {metrics['l_burned_pixels']:,} ({metrics['l_burned_ha']:,.1f} ha)")
    print(f"Total Piksel MODIS Terbakar (F >= 1)  : {metrics['m_burned_pixels']:,} ({metrics['m_burned_ha']:,.1f} ha)")
    print(f"Irisan (Keduanya Sepakat Terbakar)    : {metrics['intersection_pixels']:,} ({metrics['intersection_ha']:,.1f} ha)")
    print(f"Gabungan (Union)                      : {metrics['union_pixels']:,} ({metrics['union_ha']:,.1f} ha)")
    print(f"-> IoU (Jaccard Index)               : {metrics['iou']:.4f} ({metrics['iou'] * 100:.2f}%)")
    print(f"-> Dice Similarity Coefficient       : {metrics['dice']:.4f} ({metrics['dice'] * 100:.2f}%)")

    print("\n" + "=" * 40 + " KORELASI DENGAN DEFORESTASI HANSEN GFC " + "=" * 40)
    print(f"Total Luas Deforestasi (2001–2023)    : {metrics['total_defor_pixels']:,} piksel ({metrics['total_defor_ha']:,.1f} ha)")
    print(f"Deforestasi di Area Kebakaran Berulang: {metrics['defor_in_fire_pixels']:,} piksel ({metrics['defor_in_fire_ha']:,.1f} ha)")
    print(f"-> Persentase Deforestasi Akibat Karhutla Berulang: {metrics['pct_defor_in_fire']:.2f}%")

    print("\n" + "=" * 40 + " DISTRIBUSI KELAS FREKUENSI TERBAKAR " + "=" * 40)
    print(df_freq.to_string(index=False))

    print("\n" + "=" * 40 + " MATRIKS KESEPAKATAN SPASIAL (AGREEMENT) " + "=" * 40)
    print(df_agr.to_string(index=False))

    # Simpan hasil CSV
    csv_path = os.path.join(output_dir, "ringkasan_metrik_pcd.csv")
    df_freq.to_csv(csv_path, index=False)
    print(f"\n[*] Ringkasan metrik disimpan ke: {csv_path}")

    # Generate Figures
    generate_plots(rasters, metrics, df_freq, df_agr, output_dir)
    print("\n[✔] Eksekusi pipeline PCD selesai dengan sukses!")


if __name__ == "__main__":
    main()
