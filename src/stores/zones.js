import { defineStore } from 'pinia';
import { ref } from 'vue';
import { GeoJSON } from 'ol/format';
import { GML } from 'ol/format';

export const useZoneStore = defineStore('zones', () => {
  const zones = ref([]);
  const geoJson = new GeoJSON();
  const gml = new GML({ srsName: 'urn:x-ogc:def:crs:EPSG:4326'});
  const drawEnabled = ref(false);
  const modifyEnabled = ref(false);
  const insertedZones = ref([]);
  const modifiedZones = ref([]);
  const deletedZones = ref([]);
  const saveError = ref(null);
//   const selectedZoneId = ref(null);
  const wfsUrl = import.meta.env.VITE_WFS_URL;
  const wfsFeatureType = import.meta.env.VITE_WFS_FEATURE_TYPE;

  const loadZones = async (url) => {
    try {
      const response = await fetch(url);
      const data = await response.json();
      const features = geoJson.readFeatures(data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326',
      });
      zones.value = features;
      // Reset operation lists on load
      insertedZones.value = [];
      modifiedZones.value = [];
      deletedZones.value = [];
      saveError.value = null;
    //   selectedZoneId.value = null;
    } catch (error) {
      console.error('Erreur lors du chargement des zones:', error);
      saveError.value = 'Failed to load zones';
    }
  };

  const addZone = (zone) => {
    zones.value.push(zone);
    insertedZones.value.push(zone);
  };

  const deleteZone = (id) => {
    zones.value = zones.value.filter((zone) => zone.getId() !== id);
    deletedZones.value.push(id);
    // Remove from inserted/modified if present
    insertedZones.value = insertedZones.value.filter((zone) => zone.getId() !== id);
    modifiedZones.value = modifiedZones.value.filter((zone) => zone.getId() !== id);
    // if (selectedZoneId.value === id) selectedZoneId.value = null;
  };

  const modifyZone = (zone) => {
    const index = zones.value.findIndex((z) => z.getId() === zone.getId());
    if (index !== -1) {
      zones.value[index] = zone;
      // Add to modifiedZones if not already inserted
      if (!insertedZones.value.some((z) => z.getId() === zone.getId())) {
        modifiedZones.value.push(zone);
      }
    }
  };

//   const selectZone = (id) => {
//     selectedZoneId.value = id;
//     console.log('Selected zone:', id);
//   };


  const getAllOperations = () => {
    return {
      inserted: insertedZones.value.map((zone) => zone.getId()),
      modified: modifiedZones.value.map((zone) => zone.getId()),
      deleted: deletedZones.value,
    };
  };

  const saveChanges = async () => {
    try {
        const serializer = new XMLSerializer();
      const wfsTransaction = `
        <wfs:Transaction
          service="WFS"
          version="1.1.0"
          xmlns:wfs="http://www.opengis.net/wfs"
          xmlns:ogc="http://www.opengis.net/ogc"
          xmlns:gml="http://www.opengis.net/gml"
          xmlns:geoimage="http://www.geoimagesolutions.com"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
          ${insertedZones.value
            .map(
              (zone) => `
            <wfs:Insert>
              <geoimage:zones>
               
                  ${serializer.serializeToString(gml.writeGeometryNode(zone.getGeometry(), {
                    srsName: 'urn:x-ogc:def:crs:EPSG:4326',
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:4326',
            }))}
                
                <geoimage:name>${zone.get('name') || 'Sans nom'}</geoimage:name>
                <geoimage:type>${
                  zone.get('type') || 'Aucun type'
                }</geoimage:type>
              </geoimage:zones>
            </wfs:Insert>`
            )
            .join('')}
          ${modifiedZones.value
            .map(
              (zone) => `
            <wfs:Update typeName="geoimage:zones">
              <wfs:Property>
                <wfs:Name>geom</wfs:Name>
                <wfs:Value>
                  ${serializer.serializeToString(gml.writeGeometryNode(zone.getGeometry(), {
                    srsName: 'urn:x-ogc:def:crs:EPSG:4326',
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:4326',
            }))}
                </wfs:Value>
              </wfs:Property>
              <wfs:Property>
                <wfs:Name>name</wfs:Name>
                <wfs:Value>${zone.get('name') || 'Sans nom'}</wfs:Value>
              </wfs:Property>
              <wfs:Property>
                <wfs:Name>type</wfs:Name>
                <wfs:Value>${
                  zone.get('type') || 'Aucun type'
                }</wfs:Value>
              </wfs:Property>
              <ogc:Filter>
                <ogc:FeatureId fid="${zone.getId()}"/>
              </ogc:Filter>
            </wfs:Update>`
            )
            .join('')}
          ${deletedZones.value
            .map(
              (id) => `
            <wfs:Delete typeName="geoimage:zones">
              <ogc:Filter>
                <ogc:FeatureId fid="${id}"/>
              </ogc:Filter>
            </wfs:Delete>`
            )
            .join('')}
        </wfs:Transaction>
      `;

      if (
        insertedZones.value.length === 0 &&
        modifiedZones.value.length === 0 &&
        deletedZones.value.length === 0
      ) {
        saveError.value = 'No changes to save';
        return;
      }

      const response = await fetch(wfsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: wfsTransaction,
      });

      if (!response.ok) {
        throw new Error(`WFS-T request failed: ${response.statusText}`);
      }

      // Clear operations after successful save
      insertedZones.value = [];
      modifiedZones.value = [];
      deletedZones.value = [];
      saveError.value = null;

      // Reload zones to sync with server
      await loadZones(
        wfsUrl + '?service=WFS&version=1.1.0&request=GetFeature&typeName='+wfsFeatureType+'&outputFormat=application/json&srsname=EPSG:4326'
      );
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des changements:', error);
      saveError.value = `Failed to save changes: ${error.message}`;
    }
  };

  const toggleDraw = () => {
    drawEnabled.value = !drawEnabled.value;
    if (drawEnabled.value) modifyEnabled.value = false;
  };

  const toggleModify = () => {
    modifyEnabled.value = !modifyEnabled.value;
    if (drawEnabled.value) drawEnabled.value = false;
  };

  return {
    zones,
    drawEnabled,
    modifyEnabled,
    insertedZones,
    modifiedZones,
    deletedZones,
    saveError,
    loadZones,
    addZone,
    deleteZone,
    modifyZone,
    // selectZone,
    getAllOperations,
    saveChanges,
    toggleDraw,
    toggleModify,
  };
});