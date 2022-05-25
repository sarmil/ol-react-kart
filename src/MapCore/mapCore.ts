import 'ol/ol.css';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import { WMTS } from 'ol/source';
import Projection from 'ol/proj/Projection';
import wmtsTileGrid from '../MapLib/TileGrid/wmts';
import { getTopLeft, getWidth } from 'ol/extent';
import OLVectorLayer from 'ol/layer/Vector';
import FeatureStyles from '../MapLib/Features/Styles';
import mapConfig from '../config.json';
import { fromLonLat, get } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { osm, vector } from '../MapLib/Source';
import { useState } from 'react';

// const map = new Map({
//   layers: [
//     new TileLayer({
//       source: new OSM(),
//     }),
//   ],
//   target: 'map',
//   view: new View({
//     center: [0, 0],
//     zoom: 2,
//   }),
// });

// function Init(){
//   const map = new Map({
//     layers: [
//       new TileLayer({
//         source: new OSM(),
//       }),
//     ],
//     target: 'map',
//     view: new View({
//       center: [0, 0],
//       zoom: 2,
//     }),
//   });
//   return map;
// }
let myMap: Map;
const geojsonObject2 = mapConfig.geojsonObject2;
const sProjection = 'EPSG:3857';
const extent = {
  'EPSG:3857': [-20037508.34, -20037508.34, 20037508.34, 20037508.34] as [number, number, number, number],
  'EPSG:32633': [-2500000, 3500000, 3045984, 9045984] as [number, number, number, number],
};
const projection = new Projection({
  code: sProjection,
  extent: extent[sProjection],
});

const projectionExtent = projection.getExtent();
const size = getWidth(projectionExtent) / 256;

const resolutions = [];
const matrixIds = [];

for (let z = 0; z < 21; ++z) {
  //Max 18?
  resolutions[z] = size / Math.pow(2, z);
  matrixIds[z] = sProjection + ':' + z;
}




const tileGrid = wmtsTileGrid({
  origin: getTopLeft(projection.getExtent()),
  resolutions: resolutions,
  matrixIds: matrixIds,
});

// const layerMap = function() {
//   return new Map({
//     layers: [
//       new TileLayer({
//         source: new WMTS({
//           url: 'http://opencache.statkart.no/gatekeeper/gk/gk.open_wmts?',
//           layer: 'norges_grunnkart_graatone',
//           matrixSet: sProjection,
//           projection: projection,
//           tileGrid: tileGrid,
//           style: 'default',
//           format: 'image/png',
//         }),
//       }),
//     ],
//     target: 'map',
//     view: new View({
//       center: [571732.30, 7032994.21],
//       zoom: 6,
//     }),
//   });
// } 

const MapApi = function() {
  // constructor(){}
  // const [myMap, setMap] = useState(map());
  return {
    init: function() {
      if (!myMap) {
        myMap = new Map({
          layers: [
            new TileLayer({
              source: new WMTS({
                url: 'http://opencache.statkart.no/gatekeeper/gk/gk.open_wmts?',
                layer: 'norges_grunnkart_graatone',
                matrixSet: sProjection,
                projection: projection,
                tileGrid: tileGrid,
                style: 'default',
                format: 'image/png',
              }),
            }),
          ],
          target: 'map',
          view: new View({
            center: [571732.30, 7032994.21],
            zoom: 6,
          }),
        });
      }
      
      console.log('INIT');
      return myMap;
    },

    setCenter: function() {
      myMap.getView().setCenter([571732.30, 7032994.21]);
      myMap.getView().setZoom(6);
    },
    showLayer: function() {
      const source = vector({
        features: new GeoJSON().readFeatures(geojsonObject2, {
          featureProjection: get('EPSG:3857') || undefined,        
        })
      });
      const style = FeatureStyles.MultiPolygon;
      // source.set('id', 'juraj');
      const vectorLayer = new OLVectorLayer({
        source,
        style,
      });
      vectorLayer.set('id', 'juraj');
      myMap.addLayer(vectorLayer);
      console.log('ADDED layer: ', myMap.getAllLayers());
    },
    // getAllBaseLayers: function() {
    //   return myMap.getAllLayers().filter(l => l.isBaseLayer = true);
    // }
    // hideLayer: function() {

    // }
  }
}

export default MapApi;