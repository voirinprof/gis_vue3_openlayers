<template>
  <Map.OlMap
    :loadTilesWhileAnimating="true"
    :loadTilesWhileInteracting="true"
    ref="map"
    @click="onMapClick"
  >
    <Map.OlView :center="center" :zoom="zoom" projection="EPSG:4326" />
    <!-- Couche OpenStreetMap -->
    <Layers.OlTileLayer :zIndex="1000">
      <Sources.OlSourceOsm />
    </Layers.OlTileLayer>
    <!-- Couche WMS -->
    <Layers.OlTileLayer :zIndex="1001" :opacity="layerOpacity" :visible="layerVisible">
      <Sources.OlSourceTileWms
        :url="wmsurl"
        projection="EPSG:3857"
        :layers="wmslayers"
        serverType="geoserver"
        :params="{ TILED: true }"
      />
    </Layers.OlTileLayer>
    <!-- Couche des zones -->
    <Layers.OlVectorLayer :zIndex="1002">
      <Sources.OlSourceVector :features="zoneStore.zones">
        <Interactions.OlInteractionDraw
          v-if="zoneStore.drawEnabled"
          :stopClick="true"
          type="Polygon"
          @drawend="drawend"
        />
        <Interactions.OlInteractionSnap v-if="zoneStore.modifyEnabled || zoneStore.drawEnabled" />
        <Styles.OlStyle>
          <Styles.OlStyleStroke color="blue" :width="3" />
          <Styles.OlStyleFill color="rgba(0, 0, 255, 0.4)" />
        </Styles.OlStyle>
      </Sources.OlSourceVector>
      <Interactions.OlInteractionModify
        v-if="zoneStore.modifyEnabled"
        :features="selectedFeatures"
        @modifyend="featureModified"
      >
        <Styles.OlStyle>
          <Styles.OlStyleCircle :radius="5">
            <Styles.OlStyleFill color="#00dd11" />
            <Styles.OlStyleStroke color="blue" :width="2" />
          </Styles.OlStyleCircle>
        </Styles.OlStyle>
      </Interactions.OlInteractionModify>
    </Layers.OlVectorLayer>
    <Interactions.OlInteractionSelect
      @select="featureSelected"
      :condition="click"
      :features="selectedFeatures"
    >
      <Styles.OlStyle>
        <Styles.OlStyleStroke color="red" :width="2" />
        <Styles.OlStyleFill color="rgba(255, 0, 0, 0.4)" />
      </Styles.OlStyle>
    </Interactions.OlInteractionSelect>
  </Map.OlMap>
</template>

<script setup lang="ts">
import { Map, Layers, Sources, Interactions, Styles } from 'vue3-openlayers';
import { ref, defineEmits } from 'vue';
import { Collection } from 'ol';
import { click } from 'ol/events/condition';
import { useZoneStore } from '../stores/zones';

const zoneStore = useZoneStore();
const center = ref([
  Number(import.meta.env.VITE_MAP_CENTER_LNG), Number(import.meta.env.VITE_MAP_CENTER_LAT)
]);
const zoom = ref(Number(import.meta.env.VITE_DEFAULT_ZOOM));
const layerOpacity = ref(1.0);
const layerVisible = ref(true);
const selectedFeatures = ref(new Collection());
const map = ref<InstanceType<typeof Map> | null>(null);

const wmsurl = import.meta.env.VITE_WMS_URL;
const wmslayers = import.meta.env.VITE_WMS_LAYERS;

const emit = defineEmits(['select']);


// function to zoom to a feature
const zoomToFeature = (id: string) => {
  if (!map.value) return;
  const feature = zoneStore.zones.find((z) => z.getId()?.toString() === id);
  if (feature) {
    const extent = feature.getGeometry().getExtent();
    map.value.map.getView().fit(extent, { duration: 500, padding: [100, 100, 100, 100] });
    selectedFeatures.value.clear();
    selectedFeatures.value.push(feature);
    
  } else {
    console.log('Feature not found for ID:', id);
  }
};

// function to handle map click event
const onMapClick = (event) => {
  
  if (!map.value) return;
  
  const pixel = map.value.map.getEventPixel(event.originalEvent);
  const features = map.value.map.getFeaturesAtPixel(pixel);
  
  if (!features || features.length === 0) {
    emit('select', null);
    selectedFeatures.value.clear();
  }
};

// function to handle draw end event
const drawend = (event) => {
  const feature = event.feature;
  feature.setId(`zone-${Date.now()}`); // Assign unique ID
  zoneStore.addZone(feature);
  selectedFeatures.value.push(feature);
  zoneStore.toggleModify(); // Switch to modify mode
  
  emit('select', feature.getId());
  
};

// function to handle feature modification
const featureModified = (event) => {
  const modifiedFeatures = event.features.getArray();
  modifiedFeatures.forEach((feature) => {
    zoneStore.modifyZone(feature); // Track modified zones
  });
  
};

// function to handle feature selection
const featureSelected = (event) => {
  selectedFeatures.value.clear();
  event.selected.forEach((feature) => {
    selectedFeatures.value.push(feature);
  });
  
  emit('select', event.selected[0].getId());
};

// expose the zoomToFeature function to be used in the parent component
defineExpose({
  zoomToFeature,
});
</script>

<style scoped>
:deep(.ol-map) {
  width: 100%;
  height: 100%;
}
</style>