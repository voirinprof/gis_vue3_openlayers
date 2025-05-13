<template>
  <div class="h-full flex flex-col">
    <Toolbar />
    <Map ref="map" class="flex-grow" @select="handleSelect" />
    <DataTable :selectedZoneId="selectedZoneId" @selectrow="handleSelect" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Toolbar from '../components/Toolbar.vue';
import Map from '../components/Map.vue';
import DataTable from '../components/DataTable.vue';
import { useZoneStore } from '../stores/zones';

const zoneStore = useZoneStore();

const selectedZoneId = ref<string | null>(null);
const map = ref<InstanceType<typeof Map> | null>(null);

const wfsUrl = import.meta.env.VITE_WMS_URL;
const wfsFeatureType = import.meta.env.VITE_WFS_FEATURE_TYPE;


// Function to handle selection from the map
const handleSelect = (id: string | null) => {
  
  selectedZoneId.value = id;
  if (id && map.value) {
    
    map.value.zoomToFeature(id);
  }
};

// function to load zones
onMounted(() => {
  
  zoneStore.loadZones(
    wfsUrl + '?service=WFS&version=1.1.0&request=GetFeature&typeName=' + wfsFeatureType + '&outputFormat=application/json&srsname=EPSG:4326',
  );
});
</script>