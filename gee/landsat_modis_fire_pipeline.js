/**
 * Pipeline Google Earth Engine
 * Judul: Analisis Frekuensi Area Terbakar Berulang dan Konsistensi Spasial Multi-Sensor (Landsat vs MODIS)
 * Wilayah Studi: Kabupaten Pulang Pisau, Provinsi Kalimantan Tengah (Periode 2001-2024)
 * Peneliti: Roufiel Hadi (241524028) dan Amalia Khoerina (241524003)
 * Program Studi: D4 Teknik Informatika, Politeknik Negeri Bandung
 */

// 1. Batas Administrasi Wilayah Studi
var admin2 = ee.FeatureCollection("FAO/GAUL/2015/level2");
var pulangPisau = admin2.filter(ee.Filter.and(
  ee.Filter.eq('ADM1_NAME', 'Kalimantan Tengah'),
  ee.Filter.eq('ADM2_NAME', 'Pulang Pisau')
));

var fallbackCoords = ee.Geometry.Polygon([
  [[113.45, -1.70], [114.65, -1.70], [114.65, -3.65], [113.45, -3.65]]
]);
var aoi = ee.Algorithms.If(pulangPisau.geometry().coordinates().length(), pulangPisau.geometry(), fallbackCoords);
aoi = ee.Geometry(aoi);

Map.centerObject(aoi, 9);
Map.setOptions('HYBRID');

// Grid analisis terpadu 250 meter
var targetProjection = ee.Projection('EPSG:3857').atScale(250);

// 2. Masking Badan Air Permanen (JRC Global Surface Water)
// Mengeliminasi laut, teluk, dan sungai (Sungai Kahayan dan Sebangau)
var gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");
var permanentWater = gsw.select('max_extent').eq(1);
var landMask = permanentWater.not().clip(aoi);

// 3. Pemrosesan Data Area Terbakar MODIS (MCD64A1 500m)
var modisCol = ee.ImageCollection("MODIS/061/MCD64A1")
  .filterBounds(aoi)
  .filterDate('2001-01-01', '2024-12-31');

var years = ee.List.sequence(2001, 2024);

var modisAnnualList = years.map(function(yr) {
  var start = ee.Date.fromYMD(yr, 1, 1);
  var end = ee.Date.fromYMD(yr, 12, 31);
  var annual = modisCol.filterDate(start, end).select('BurnDate');
  var burned = annual.max().gt(0).and(landMask).rename('burned_modis').clip(aoi);
  return burned.set('year', yr);
});

var modisAnnualCol = ee.ImageCollection.fromImages(modisAnnualList);
var modisFrequency = modisAnnualCol.sum()
  .toByte()
  .reproject(targetProjection)
  .rename('modis_frequency')
  .clip(aoi);

// 4. Pemrosesan Data Area Terbakar Landsat (30m)
function maskLandsatSR(img) {
  var qa = img.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0).and(qa.bitwiseAnd(1 << 4).eq(0));
  return img.updateMask(mask);
}

var landsatAnnualList = years.map(function(yr) {
  var start = ee.Date.fromYMD(yr, 7, 1);
  var end = ee.Date.fromYMD(yr, 11, 30);
  
  var yrNum = ee.Number(yr);
  var l7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2").filterBounds(aoi).filterDate(start, end).map(maskLandsatSR);
  var l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").filterBounds(aoi).filterDate(start, end).map(maskLandsatSR);
  var l9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2").filterBounds(aoi).filterDate(start, end).map(maskLandsatSR);
  
  var comp = ee.Algorithms.If(
    yrNum.lt(2013),
    l7.median().select(['SR_B2', 'SR_B4', 'SR_B5', 'SR_B7'], ['green', 'nir', 'swir1', 'swir2']),
    l8.merge(l9).median().select(['SR_B3', 'SR_B5', 'SR_B6', 'SR_B7'], ['green', 'nir', 'swir1', 'swir2'])
  );
  comp = ee.Image(comp);
  
  // Transformasi spektral NBR dan MNDWI
  var nbr = comp.normalizedDifference(['nir', 'swir2']);
  var mndwi = comp.normalizedDifference(['green', 'swir1']);
  
  // Kriteria area terbakar:
  // 1. NBR rendah (< 0.12)
  // 2. Pantulan SWIR-2 cukup tinggi (> 0.08) untuk membedakan arang/tanah kering dari air
  // 3. MNDWI < 0 (bukan tubuh air)
  // 4. Terletak di daratan (berdasarkan masker JRC)
  var isBurned = nbr.lt(0.12)
    .and(comp.select('swir2').gt(0.08))
    .and(mndwi.lt(0.0))
    .and(landMask)
    .rename('burned_landsat')
    .clip(aoi);
    
  return isBurned.set('year', yr);
});

var landsatAnnualCol = ee.ImageCollection.fromImages(landsatAnnualList);
var landsatFrequency = landsatAnnualCol.sum()
  .toByte()
  .reproject(targetProjection)
  .rename('landsat_frequency')
  .clip(aoi);

// 5. Evaluasi Konsistensi Spasial (Spatial Agreement)
var landsatEverBurned = landsatFrequency.gte(1);
var modisEverBurned = modisFrequency.gte(1);

// Kategori kesepakatan spasial:
// 0: Keduanya tidak terbakar
// 1: Hanya Landsat terdeteksi
// 2: Hanya MODIS terdeteksi
// 3: Keduanya sepakat terdeteksi
var agreementMap = ee.Image(0)
  .where(landsatEverBurned.eq(1).and(modisEverBurned.eq(0)), 1)
  .where(landsatEverBurned.eq(0).and(modisEverBurned.eq(1)), 2)
  .where(landsatEverBurned.eq(1).and(modisEverBurned.eq(1)), 3)
  .clip(aoi)
  .rename('spatial_agreement');

var intersection = landsatEverBurned.and(modisEverBurned).rename('intersection');
var union = landsatEverBurned.or(modisEverBurned).rename('union');

var statsIntersection = intersection.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: aoi, scale: 250, maxPixels: 1e10
}).get('intersection');

var statsUnion = union.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: aoi, scale: 250, maxPixels: 1e10
}).get('union');

print('Luas Kesepakatan (m2):', statsIntersection);
print('Luas Gabungan (m2):', statsUnion);

// 6. Analisis Deforestasi Hansen GFC
var gfc = ee.Image("UMD/hansen/global_forest_change_2023_v1_11").clip(aoi);
var lossYear = gfc.select('lossyear').clip(aoi);

// 7. Visualisasi Peta
var freqVis = {
  min: 0,
  max: 10,
  palette: ['#2b83ba', '#ffffbf', '#fdae61', '#f46d43', '#d73027', '#67001f']
};

var agreementVis = {
  min: 0,
  max: 3,
  palette: ['#252525', '#fee08b', '#fdae61', '#d73027']
};

Map.addLayer(landsatFrequency, freqVis, 'Frekuensi Terbakar Landsat (250m)', true);
Map.addLayer(modisFrequency, freqVis, 'Frekuensi Terbakar MODIS (250m)', false);
Map.addLayer(agreementMap, agreementVis, 'Peta Kesepakatan Spasial', false);
Map.addLayer(lossYear.selfMask(), {min: 1, max: 23, palette: ['yellow', 'orange', 'red']}, 'Kronologi Deforestasi Hansen', false);

var outline = ee.Image().byte().paint({featureCollection: pulangPisau, color: 1, width: 2});
Map.addLayer(outline, {palette: ['#ffffff']}, 'Batas Administrasi');

// 8. Ekspor Raster ke Google Drive
Export.image.toDrive({
  image: agreementMap,
  description: 'Spatial_Agreement_Landsat_MODIS_Pulang_Pisau',
  folder: 'Tubes_PCD_Pulang_Pisau',
  scale: 250,
  region: aoi,
  maxPixels: 1e9,
  crs: 'EPSG:4326'
});

Export.image.toDrive({
  image: landsatFrequency.toByte(),
  description: 'Frekuensi_Terbakar_Landsat_2001_2024',
  folder: 'Tubes_PCD_Pulang_Pisau',
  scale: 250,
  region: aoi,
  maxPixels: 1e9,
  crs: 'EPSG:4326'
});

Export.image.toDrive({
  image: modisFrequency.toByte(),
  description: 'Frekuensi_Terbakar_MODIS_2001_2024',
  folder: 'Tubes_PCD_Pulang_Pisau',
  scale: 250,
  region: aoi,
  maxPixels: 1e9,
  crs: 'EPSG:4326'
});

Export.image.toDrive({
  image: lossYear,
  description: 'Kronologi_Deforestasi_Hansen_Pulang_Pisau',
  folder: 'Tubes_PCD_Pulang_Pisau',
  scale: 250,
  region: aoi,
  maxPixels: 1e9,
  crs: 'EPSG:4326'
});
