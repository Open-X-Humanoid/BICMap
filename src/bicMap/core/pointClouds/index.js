/**
 * @description: Point cloud rendering module
 * @author: houser.hao@humanoid.com
 */

import { LAYER_IDS, addLayerWithOrder } from '../layers/layerConfig.js';
import { createPointCloud3D } from './pointCloud3D.js';

/**
 * Creates a point cloud layer on the map
 * @param {Object} map - Mapbox map instance
 * @param {Array} points - Array of point coordinates [[x,y,z], [x,y,z], ...] or [[x,y], [x,y], ...] for 2D
 * @param {Object} options - Configuration options for the point cloud
 * @returns {Object} PointCloud controller with methods to update, show, hide and remove the point cloud
 */
const createPointCloud = (map, points = [], options = {}) => {
  if (!map) {
    console.error('Map instance is required for point cloud rendering');
    return null;
  }

  // Default options
  const defaultOptions = {
    pointSize: 5,
    pointColor: '#ff0000',
    pointOpacity: 0.8,
    minPointSize: 1,
    maxPointSize: 10,
    is3D: true, // Determines if we're dealing with 3D or 2D points
    useColorMap: false, // Whether to use a color map based on z values
    colorMap: [
      [0, '#0000ff'],   // Lower values -> blue
      [0.5, '#00ff00'], // Middle values -> green
      [1, '#ff0000']    // Higher values -> red
    ],
    zRange: [0, 100], // Min/max z values for color mapping
    visible: true,
    heightScale: 100,  // Scale factor for height in 3D visualization
    heightOffset: 0    // Base offset for height
  };

  // Merge default options with user options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Store points in a format that can be used by WebGL
  let pointsData = points;
  
  // Source ID for the GeoJSON source
  const sourceId = `point-cloud-source`;
  
  // Layer ID for the circle layer
  const layerId = `point-cloud-layer`;
  
  // Helper function to get a color from z value using a color map
  const getColorFromZ = (z, range, colorMap) => {
    // Normalize z value to be between 0 and 1
    const normalized = Math.max(0, Math.min(1, (z - range[0]) / (range[1] - range[0])));
    
    // Find the appropriate color
    for (let i = 0; i < colorMap.length - 1; i++) {
      const [position1, color1] = colorMap[i];
      const [position2, color2] = colorMap[i + 1];
      
      if (normalized >= position1 && normalized <= position2) {
        // Linear interpolation between colors
        const ratio = (normalized - position1) / (position2 - position1);
        
        // Parse colors
        const r1 = parseInt(color1.slice(1, 3), 16);
        const g1 = parseInt(color1.slice(3, 5), 16);
        const b1 = parseInt(color1.slice(5, 7), 16);
        
        const r2 = parseInt(color2.slice(1, 3), 16);
        const g2 = parseInt(color2.slice(3, 5), 16);
        const b2 = parseInt(color2.slice(5, 7), 16);
        
        // Interpolate
        const r = Math.floor(r1 + (r2 - r1) * ratio);
        const g = Math.floor(g1 + (g2 - g1) * ratio);
        const b = Math.floor(b1 + (b2 - b1) * ratio);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    
    // Fallback to last color
    return colorMap[colorMap.length - 1][1];
  };

  // Convert hex color to rgba array
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [1, 0, 0]; // Default to red if invalid
  };

  // Convert points array to GeoJSON for WebGL rendering
  const pointsToGeoJSON = (points) => {
    const features = points.map((point, index) => {
      const hasZ = point.length > 2 && point[2] !== undefined;
      const z = hasZ ? point[2] : 0;
      
      // Calculate height for 3D effect
      const height = mergedOptions.is3D && hasZ 
        ? z * mergedOptions.heightScale + mergedOptions.heightOffset 
        : 0;
      
      // Determine color
      let color = mergedOptions.pointColor;
      if (mergedOptions.useColorMap && hasZ) {
        color = getColorFromZ(z, mergedOptions.zRange, mergedOptions.colorMap);
      }
      
      // Convert hex color to rgb components
      const rgbColor = hexToRgb(color);
      
      return {
        type: 'Feature',
        properties: {
          height: height,
          color: rgbColor,
          pointSize: mergedOptions.pointSize,
          opacity: mergedOptions.pointOpacity,
          id: index
        },
        geometry: {
          type: 'Point',
          coordinates: [point[0], point[1], height]
        }
      };
    });
    
    return {
      type: 'FeatureCollection',
      features: features
    };
  };

  // Add points to map using WebGL rendering
  const renderPoints = () => {
    // Only proceed if visible
    if (!mergedOptions.visible) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
      }
      return;
    }
    
    // Convert points to GeoJSON
    const geojson = pointsToGeoJSON(pointsData);
    
    // Add or update the source
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geojson);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        buffer: 0, // No buffer needed for point data
        tolerance: 0, // No simplification for points
        cluster: false,
        maxzoom: 24
      });
    }
    
    // Add or update the layer
    if (!map.getLayer(layerId)) {
      const layerConfig = {
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          // Use data-driven styling for all properties
          'circle-radius': ['get', 'pointSize'],
          'circle-color': [
            'rgb',
            ['*', ['at', 0, ['get', 'color']], 255],
            ['*', ['at', 1, ['get', 'color']], 255],
            ['*', ['at', 2, ['get', 'color']], 255]
          ],
          'circle-opacity': ['get', 'opacity'],
          'circle-translate': [0, 0],
          'circle-translate-anchor': 'map',
          'circle-pitch-alignment': mergedOptions.is3D ? 'map' : 'viewport',
          'circle-pitch-scale': mergedOptions.is3D ? 'map' : 'viewport',
        },
        layout: {
          visibility: 'visible'
        }
      };
      
      // Add the layer with proper ordering
      addLayerWithOrder(map, layerConfig);
    } else {
      // Update layer visibility
      map.setLayoutProperty(layerId, 'visibility', 'visible');
      
      // Update paint properties if needed
      map.setPaintProperty(layerId, 'circle-radius', ['get', 'pointSize']);
      map.setPaintProperty(layerId, 'circle-opacity', ['get', 'opacity']);
      map.setPaintProperty(layerId, 'circle-pitch-alignment', mergedOptions.is3D ? 'map' : 'viewport');
      map.setPaintProperty(layerId, 'circle-pitch-scale', mergedOptions.is3D ? 'map' : 'viewport');
    }
    
    // Add proper camera angle if needed
    if (mergedOptions.is3D && map.getPitch() < 30) {
      map.easeTo({
        pitch: 60,
        duration: 1000
      });
    }
  };

  // Initialize point cloud
  if (map.loaded()) {
    renderPoints();
  } else {
    map.on('load', renderPoints);
  }

  // Return an object with methods to manipulate the point cloud
  return {
    /**
     * Update the point cloud with new points
     * @param {Array} newPoints - New array of point coordinates
     * @param {Object} updateOptions - New options to apply (optional)
     */
    update: (newPoints, updateOptions = {}) => {
      // Update points data
      pointsData = newPoints || pointsData;
      
      // Update options if provided
      if (Object.keys(updateOptions).length > 0) {
        Object.assign(mergedOptions, updateOptions);
      }
      
      // Re-render the points
      renderPoints();
    },
    
    /**
     * Show the point cloud
     */
    show: () => {
      mergedOptions.visible = true;
      
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
      } else {
        renderPoints();
      }
    },
    
    /**
     * Hide the point cloud
     */
    hide: () => {
      mergedOptions.visible = false;
      
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
      }
    },
    
    /**
     * Remove the point cloud from the map
     */
    remove: () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    },
    
    /**
     * Get the current configuration options
     * @returns {Object} The current options
     */
    getOptions: () => {
      return { ...mergedOptions };
    },
    
    /**
     * Get the current points data
     * @returns {Array} Array of points
     */
    getPoints: () => {
      return [...pointsData];
    },
    
    /**
     * Update a specific point's appearance
     * @param {Number} index - Index of the point to update
     * @param {Object} properties - Properties to update
     */
    updatePoint: (index, properties) => {
      if (index < 0 || index >= pointsData.length || !map.getSource(sourceId)) {
        return;
      }
      
      // Get current GeoJSON data
      const geojson = map.getSource(sourceId)._data;
      
      if (!geojson || !geojson.features || index >= geojson.features.length) {
        return;
      }
      
      // Update feature properties
      const feature = geojson.features[index];
      
      if (properties.color) {
        feature.properties.color = hexToRgb(properties.color);
      }
      
      if ('visible' in properties) {
        feature.properties.opacity = properties.visible ? mergedOptions.pointOpacity : 0;
      }
      
      if (properties.size) {
        feature.properties.pointSize = properties.size;
      }
      
      if ('height' in properties && mergedOptions.is3D) {
        feature.properties.height = properties.height;
        feature.geometry.coordinates[2] = properties.height;
      }
      
      // Update the source
      map.getSource(sourceId).setData(geojson);
    },
    
    /**
     * Enable 3D rendering with height for the point cloud
     * @param {Boolean} enable - Whether to enable 3D rendering
     */
    set3D: (enable) => {
      mergedOptions.is3D = enable;
      
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'circle-pitch-alignment', enable ? 'map' : 'viewport');
        map.setPaintProperty(layerId, 'circle-pitch-scale', enable ? 'map' : 'viewport');
        
        // Re-render to update heights
        renderPoints();
      }
    }
  };
};

export default {
  createPointCloud,
  createPointCloud3D
};
