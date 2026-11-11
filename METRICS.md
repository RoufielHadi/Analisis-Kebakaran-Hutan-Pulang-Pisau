# Mathematical Formulations & PCD Metrics

Dokumen ini memuat detail matematis, formulasi piksel, dan metrik evaluasi yang diterapkan pada Tugas Besar Pengolahan Citra Digital (PCD).

---

## 1. Indeks Spektral Citra

### A. Normalized Burn Ratio (NBR)
Digunakan pada citra Landsat untuk mendeteksi bekas area terbakar (*burn scars*):
$$\text{NBR} = \frac{\rho_{\text{NIR}} - \rho_{\text{SWIR2}}}{\rho_{\text{NIR}} + \rho_{\text{SWIR2}}}$$

* **Landsat 7 ETM+:** $\rho_{\text{NIR}} = \text{Band 4}$, $\rho_{\text{SWIR2}} = \text{Band 7}$
* **Landsat 8/9 OLI:** $\rho_{\text{NIR}} = \text{Band 5}$, $\rho_{\text{SWIR2}} = \text{Band 7}$

### B. Normalized Difference Vegetation Index (NDVI)
Digunakan untuk mengevaluasi kerapatan kanopi vegetasi:
$$\text{NDVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}}$$

---

## 2. Operasi Biner & Agregasi Temporal

### A. Mask Biner Tahunan
Untuk setiap tahun $t \in [2001, 2024]$ pada lokasi piksel $(x, y)$:
$$B_t(x, y) = \begin{cases} 
1, & \text{jika piksel terklasifikasi sebagai area terbakar} \\ 
0, & \text{jika piksel teramati valid dan tidak terbakar} \\ 
\text{NaN / NoData}, & \text{jika piksel tertutup awan atau di luar wilayah studi} 
\end{cases}$$

### B. Akumulasi Frekuensi Piksel Terbakar
$$F(x, y) = \sum_{t=2001}^{2024} I(B_t(x, y) = 1)$$
Di mana fungsi indikator $I = 1$ jika kondisi benar dan $0$ jika salah. Rentang nilai $F(x, y) \in [0, 24]$.

### C. Normalisasi Terhadap Tahun Valid
Untuk menghindari distorsi akibat piksel yang sering tertutup awan (*NoData*):
$$N_{\text{valid}}(x, y) = \sum_{t=2001}^{2024} I(B_t(x, y) \text{ valid})$$
$$F_{\text{norm}}(x, y) = \frac{F(x, y)}{N_{\text{valid}}(x, y)} \times 100\%$$

---

## 3. Metrik Evaluasi Konsistensi Spasial (Multi-Sensor)

Didefinisikan $A$ sebagai himpunan piksel terbakar Landsat dan $B$ sebagai himpunan piksel terbakar MODIS pada grid analisis terpadu 250m:

### A. Intersection over Union (IoU / Jaccard Index)
Mengukur irisan relatif antara dua mask biner:
$$\text{IoU}(A, B) = \frac{|A \cap B|}{|A \cup B|} = \frac{\text{TP}}{\text{TP} + \text{FP} + \text{FN}}$$

* $\text{IoU} = 1.0$: Kesesuaian spasial sempurna antara Landsat dan MODIS.
* $\text{IoU} = 0.0$: Tidak ada irisan spasial sama sekali.

### B. Dice Similarity Coefficient (F1-Score Spasial)
Mengukur tingkat overlap spasial dengan bobot ganda pada irisan:
$$\text{Dice}(A, B) = \frac{2 \times |A \cap B|}{|A| + |B|} = \frac{2 \times \text{TP}}{2 \times \text{TP} + \text{FP} + \text{FN}}$$

### C. Matriks Kesepakatan Spasial (Spatial Agreement Categories)
Setiap piksel pada grid terpadu dikelompokkan ke dalam salah satu dari 4 kategori:

| Kategori | Definisi PCD | Makna Penginderaan Jauh |
| :---: | :--- | :--- |
| **0** | $A = 0 \land B = 0$ | **Keduanya Tidak Terbakar** (*Mutual Absence*) |
| **1** | $A = 1 \land B = 0$ | **Hanya Landsat Terbakar** (*MODIS Omission* - Terdeteksi 30m tapi lolos di 500m) |
| **2** | $A = 0 \land B = 1$ | **Hanya MODIS Terbakar** (*Landsat Omission* - Terdeteksi 500m tapi tidak di 30m) |
| **3** | $A = 1 \land B = 1$ | **Keduanya Sepakat Terbakar** (*Mutual Agreement*) |

---

## 4. Evaluasi Luas Area (Hektar)
Untuk grid terpadu metrik dengan proyeksi konsisten (luas sel $A_{\text{cell}} = 250\text{ m} \times 250\text{ m} = 62.500\text{ m}^2$):
$$\text{Luas (Hektar)} = N_{\text{piksel}} \times \frac{A_{\text{cell}}}{10.000} = N_{\text{piksel}} \times 6.25\text{ ha}$$

