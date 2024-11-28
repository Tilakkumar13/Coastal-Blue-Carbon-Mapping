// Define a rectangle around the Sundarbans
var roi = ee.Geometry.Rectangle([88.0, 21.5, 89.0, 22.5]);


// Load Sentinel-2 image collection and filter by ROI and date
var sentinel = ee.ImageCollection('COPERNICUS/S2')
                .filterDate('2023-01-01', '2023-12-31')
                .filterBounds(roi)
                .select(['B4', 'B8']); // Select the Red (B4) and Near-Infrared (B8) bands

// Function to calculate NDVI
var calculateNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
};

// Apply NDVI calculation
var ndviCollection = sentinel.map(calculateNDVI);

// Display NDVI
var ndviVis = {min: 0, max: 1, palette: ['blue', 'white', 'green']};
var ndviImage = ndviCollection.median().select('NDVI');
Map.centerObject(roi, 10);
Map.addLayer(roi, {color: 'red'}, 'Region of Interest');
Map.addLayer(ndviImage, ndviVis, 'NDVI');


// Threshold NDVI to classify vegetation
var vegetation = ndviImage.gt(0.3);  // Adjust threshold as needed
Map.addLayer(vegetation.updateMask(vegetation), {palette: 'green'}, 'Vegetation');


// Assume a carbon density value (e.g., mangroves: 200 tC/ha)
var pixelArea = ee.Image.pixelArea();
var vegetationArea = pixelArea.updateMask(vegetation);
var totalCarbon = vegetationArea.multiply(200).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi,
  scale: 10,
  maxPixels: 1e9
});

// Print total carbon stock
print('Total Carbon Stock (tC):', totalCarbon);


// Load MODIS (Vegetation Index) data for historical comparison
var modis = ee.ImageCollection('MODIS/006/MOD13Q1')
                .filterDate('2000-01-01', '2000-12-31')
                .filterBounds(roi);

// Calculate NDVI from MODIS
var modisNDVI = modis.select('NDVI').median();

// Display MODIS NDVI
Map.addLayer(modisNDVI, {min: 0, max: 9000, palette: ['blue', 'white', 'green']}, 'MODIS NDVI');



var historicalNDVI = landsat.map(calculateNDVI).median().select('NDVI');
var historicalVegetation = historicalNDVI.gt(0.3);

// Compare current and historical vegetation using MODIS
var vegetationLoss = modisNDVI.gt(0.3).and(vegetation.not());
var vegetationGain = vegetation.and(modisNDVI.gt(0.3).not());

Map.addLayer(vegetationLoss, {palette: 'red'}, 'Vegetation Loss');
Map.addLayer(vegetationGain, {palette: 'blue'}, 'Vegetation Gain');

// Export NDVI image to Google Drive
Export.image.toDrive({
  image: ndviImage, // The image to export
  description: 'NDVI_Sundarbans_2023', // Name of the export task
  scale: 10, // Pixel resolution in meters
  region: roi, // The area of interest
  fileFormat: 'GeoTIFF', // Export format
  maxPixels: 1e9 // Maximum number of pixels
});

