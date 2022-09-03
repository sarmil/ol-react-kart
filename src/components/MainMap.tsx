import React, { useEffect, useRef, useState } from 'react';

import axios from 'axios';
import queryString from 'query-string';

import OlMap from 'ol/Map';
import Overlay from 'ol/Overlay';
import View from 'ol/View';
import { ScaleLine, defaults } from 'ol/control';
import { getTopLeft, getWidth } from 'ol/extent';
import TileLayer from 'ol/layer/Tile';
import Projection from 'ol/proj/Projection';
import { WMTS } from 'ol/source';

import { GetClickCoordinates } from '../MapCore/Events/GetClickCoordinates';
import { MapMoveEnd } from '../MapCore/Events/MapMoveEnd';
import { Layers } from '../MapCore/Layers/Layers';
import {
  addGroups,
  addTileLayers,
  addVectorLayers,
  removeAll,
  selectBaseLayers,
  selectToggleTileLayer,
  selectToggleVectorLayer,
  selectVisibleBaseLayer,
  toggleTileLayer,
  toggleVectorLayer,
} from '../MapCore/Layers/layersSlice';
import { IProjectConfig } from '../MapCore/Models/config-model';
import { Project } from '../MapCore/Project/Project';
import { addProject, selectCenter, selectToken } from '../MapCore/Project/projectSlice';
import { wmtsTileGrid } from '../MapCore/TileGrid/wmts';
import { center, marker, selection, useGlobalStore, wms } from '../app/globalStore';
import MapContext from '../app/mapContext';
import pinOrange from '../assets/pin-md-orange.png';
import { selectActiveProject } from '../components/main-menu-panel/projects-list/projectsListSlice';
import baseconfig from '../config/baseconfig.json';
import { useAppSelector, useEventDispatch, useEventSelector } from '../index';
import { generateKoordTransUrl } from '../utils/n3api';
import Position from './Position';

declare global {
  interface Window {
    olMap: any;
  }
}
window.olMap = window.olMap || {};

let myMap: OlMap;
let activateMap = false;

type Props = {
  children?: React.ReactNode;
};

const MainMap = ({ children }: Props) => {
  const setSok = useGlobalStore(state => state.setSok);
  const setGlobalCenter = useGlobalStore(state => state.setCenter);
  const setGlobalMarker = useGlobalStore(state => state.setMarkerCenter);
  const setGlobalLayers = useGlobalStore(state => state.setLayers);
  const setGlobalZoom = useGlobalStore(state => state.setZoom);
  const setGlobalSelection = useGlobalStore(state => state.setSelection);
  const setGlobalWms = useGlobalStore(state => state.setWms);
  const search = useGlobalStore(state => state.sok);

  const eventDispatch = useEventDispatch();
  const mapMoveEnd = MapMoveEnd(eventDispatch);
  const getClickCoordinates = GetClickCoordinates();
  const visibleBaseLayer = useEventSelector(selectVisibleBaseLayer);
  const baseLayers = useEventSelector(selectBaseLayers);
  const appProject = Project(eventDispatch);
  const toggleVector = useEventSelector(selectToggleVectorLayer);
  const toggleTile = useEventSelector(selectToggleTileLayer);
  const token = useEventSelector(selectToken);
  const center = useEventSelector(selectCenter);

  //const unsub1 = useGlobalStore.subscribe(console.log)

  const [mapInit, setMapInit] = useState(false);
  const activeProject = useAppSelector(selectActiveProject);
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<OlMap | null>(null);

  const queryValues = queryString.parse(window.location.search);
  const hashValues = queryString.parse(window.location.hash);
  Object.assign(queryValues, hashValues);
  // http://localhost:3000/?project=norgeskart&layers=1002&zoom=16&lat=6635873.73&lon=213092.49&markerLat=6635921.241120491&markerLon=212992.02435685016&p=Seeiendom&sok=Semsveien&showSelection=true
  // http://localhost:3000/?project=norgeskart&layers=landkart&zoom=3&lat=7197864.00&lon=396722.00

  const lat = Number(queryValues['lat']) || undefined;
  const lon = Number(queryValues['lon']) || undefined;
  const zoom = Number(queryValues['zoom']) || undefined;
  const project = (queryValues['project'] as string) || activeProject;
  const layers = queryValues['layers'] as string;
  const markerLat = Number(queryValues['markerLat']) || undefined;
  const markerLon = Number(queryValues['markerLon']) || undefined;
  const p = (queryValues['p'] as string) || undefined;
  const showSelection = Boolean(queryValues['showSelection'] || false);
  const sok = queryValues['sok'] as string;
  const wms = (queryValues['wms'] as string) || undefined;
  const epsg = (queryValues['epsg'] as string) || undefined;
  const drawing = (queryValues['drawing'] as string) || undefined;
  const addLayer = (queryValues['addLayer'] as string) || undefined;

  const init = (projectConfig: IProjectConfig) => {
    if (!activateMap) {
      if (projectConfig.config.project) {
        eventDispatch(addProject(projectConfig.config.project));
      } else {
        eventDispatch(addProject(baseconfig.project));
      }
      eventDispatch(addGroups(projectConfig.config.maplayer));
      eventDispatch(addTileLayers(projectConfig.config.layer));
      if (projectConfig.config.vector) {
        eventDispatch(addVectorLayers(projectConfig.config.vector));
      }

      if (!myMap) {
        const mapepsg = projectConfig.config.project ? projectConfig.config.mapepsg : baseconfig.project.mapepsg;

        const sm = new Projection({
          code: mapepsg,
        });
        const projectExtent = projectConfig.config.mapbounds.mapbound.find(m => m.epsg === mapepsg)?.extent;
        const newExtent = [0, 0, 0, 0] as [number, number, number, number];
        if (projectExtent) {
          projectExtent
            .split(',')
            .map(e => Number(e))
            .forEach((v, index) => (newExtent[index] = v));
        }
        sm.setExtent(newExtent);

        const size = getWidth(newExtent) / 256;
        const resolutions = [];
        const matrixIds = [];
        for (let z = 0; z < 21; ++z) {
          resolutions[z] = size / Math.pow(2, z);
          matrixIds[z] = String(z);
        }
        const center =
          projectConfig.config && !isNaN(projectConfig.config.center[0])
            ? projectConfig.config.center
            : baseconfig.project.center;
        const zoom =
          projectConfig.config && !isNaN(projectConfig.config.zoom)
            ? projectConfig.config.zoom
            : baseconfig.project.zoom;

        const overlay = new Overlay({
          id: 'marker',
          position: center,
          positioning: 'bottom-center',
          element: document.getElementById('marker') || document.createElement('marker'),
        });
        const markerElement = overlay.getElement();
        if (markerElement) {
          markerElement.style.visibility = 'hidden';
        }

        myMap = new OlMap({
          layers: [
            new TileLayer({
              source: new WMTS({
                url: baseconfig.basemap.url,
                layer: baseconfig.basemap.layers,
                matrixSet: baseconfig.basemap.matrixSet,
                projection: sm,
                tileGrid: wmtsTileGrid({
                  extent: newExtent,
                  origin: getTopLeft(newExtent),
                  resolutions: resolutions,
                  matrixIds: matrixIds,
                }),
                style: 'default',
                format: baseconfig.basemap.format,
              }),
              zIndex: -1,
            }),
          ],
          overlays: [overlay],
          target: 'map',
          view: new View({
            center: center,
            projection: sm,
            zoom: zoom,
            minZoom: 3,
            maxZoom: 18,
            constrainResolution: true,
          }),
          controls: defaults({ zoom: true, attribution: false, rotate: false }).extend([new ScaleLine()]),
        });
        if (!mapRef.current) return;
        myMap.setTarget(mapRef.current);
        setMap(myMap);
        window.olMap = myMap;
        return () => myMap.setTarget(undefined);
      }
      activateMap = true;
    } else {
      appProject.generateToken();
      getClickCoordinates.activate(myMap);
      mapMoveEnd.activate(myMap);
    }
  };
  const destroyProject = () => {
    // myMap.dispose();
    const layers = Layers(myMap);
    layers.removeAllLayers();
    eventDispatch(removeAll());
    activateMap = false;
  };

  useEffect(() => {
    const addWms: wms = {
      showWms: true,
      wms: wms,
      addLayer: addLayer,
    };
    const selection: selection = {
      showSelection: showSelection,
      p: p,
    };
    const center: center = [lat, lon, zoom];
    const markerCenter: marker = [markerLat, markerLon];

    setGlobalCenter([lon, lat]);
    setGlobalLayers(layers);
    setGlobalMarker(markerCenter);
    setGlobalSelection(p);
    setSok(sok);
    //setGlobalWms(addWms);
  }, [layers, sok, project, drawing, wms, addLayer, showSelection, p, lat, lon, zoom, markerLat, markerLon]);

  const mapConfig = {
    center: [Number(lon), Number(lat)],
    zoom: Number(zoom),
  };

  useEffect(() => {
    if (center) {
      const projectProjection = myMap.getView().getProjection().getCode().replace(/.*:/, '');
      const transUrl = generateKoordTransUrl(center.lon, center.lat, projectProjection, center.epsg);
      axios.get(transUrl).then(function (response) {
        const transformedCoordinate = response.data;
        myMap.getView().setCenter([transformedCoordinate.x, transformedCoordinate.y]);
        if (Number(myMap.getView().getZoom()) < 10) {
          myMap.getView().setZoom(12);
        }
      });
    }
  }, [center]);

  useEffect(() => {
    if (token && visibleBaseLayer && baseLayers) {
      const layers = Layers(myMap);
      baseLayers.forEach(b => {
        layers.hideLayer(b.guid);
      });
      layers.createTileLayer(visibleBaseLayer, token);

      // TODO: temporary commented
      // if (newBaseLayer) {
      //     myMap.addLayer(newBaseLayer);
      //     if (newBaseLayer.get('wmtsextent')) {
      //       const wmtsExtent:Extent = newBaseLayer.get('wmtsextent');
      //       const projection = new Projection({
      //         code: 'EPSG:25832',
      //         extent: wmtsExtent,
      //       });
      //       const newCenter = getCenter(projection.getExtent());
      //       myMap.getView().setCenter(newCenter);
      //     }
      //   }
    }
  }, [token, visibleBaseLayer, baseLayers]);

  useEffect(() => {
    if (toggleVector) {
      const layers = Layers(myMap);
      if (toggleVector.options.visibility === 'false') {
        layers.createVectorLayer(toggleVector);
        eventDispatch(toggleVectorLayer());
      } else {
        layers.hideLayer(toggleVector.guid);
        eventDispatch(toggleVectorLayer());
      }
    }
  }, [toggleVector, eventDispatch]);

  useEffect(() => {
    if (toggleTile && token) {
      const layers = Layers(myMap);
      if (toggleTile.options.visibility === 'false') {
        layers.createTileLayer(toggleTile, token);
        eventDispatch(toggleTileLayer());
      } else {
        layers.hideLayer(toggleTile.guid);
        eventDispatch(toggleTileLayer());
      }
    }
  }, [toggleTile, token, eventDispatch]);
  useEffect(() => {
    if (!mapInit) {
      const projectUrl =
        document.location.origin + document.location.pathname + 'projects/' + activeProject.SiteTitle + '.json';
      axios.get(`${projectUrl}`).then(function (response) {
        response.data.config.center = mapConfig.center;
        response.data.config.zoom = mapConfig.zoom;
        if (layers) {
          response.data.config.layer.forEach((l: any) => {
            if (l.distributionProtocol === 'WMTS') {
              l.options.visibility = 'false';
            }
            if (l.name === layers) {
              l.options.visibility = 'true';
            }
            return l;
          });
        }
        init(response.data);
        setMapInit(true);
        window.olMap.on('moveend', updateMapInfoState);
      });
    }
  }, [mapInit, activeProject.SiteTitle, mapConfig.center, mapConfig.zoom]);

  useEffect(() => {
    if (activeProject.SiteTitle) {
      if (mapInit) {
        destroyProject();
        setMapInit(false);
      }
    }
  }, [activeProject]);

  const setCenterToGeolocation = () => {
    const successGetGeolocation = (position: any) => {
      const coordinates = [position.coords.longitude, position.coords.latitude];
      setGlobalCenter(coordinates as any);
      /*
      appDispatch(
        setCenter({
          lon: coordinates[0],
          lat: coordinates[1],
          epsg: 'EPSG:4258',
        }),
      );
      */
    };
    const errorGetGeolcation = () => console.log('Unable to retrieve your location');

    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by your browser');
    } else {
      navigator.geolocation.getCurrentPosition(successGetGeolocation, errorGetGeolcation);
    }
  };

  const updateMapInfoState = () => {
    const center = window.olMap.getView().getCenter();
    setGlobalCenter([center[0], center[1]]);
    setGlobalZoom(window.olMap.getView().getZoom());
  };

  return (
    <>
      <MapContext.Provider value={map}>
        <div id="map" ref={mapRef} className="ol-map">
          {children}
        </div>
        <div className="ol-geolocation ol-unselectable ol-control">
          <button onClick={() => setCenterToGeolocation()} type="button">
            <span className="material-icons-outlined">location_searching</span>
          </button>
        </div>
        <div className="display: none;">
          <div id="marker" className="marker">
            <img className="markerImg" src={pinOrange}></img>
          </div>
        </div>
        <Position />
      </MapContext.Provider>
    </>
  );
};

export default MainMap;
