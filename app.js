/*
    App logic / Programos logika
    LT: čia vykdomi navigacijos žemėlapio sluoksniai, GPS vietos nustatymas, maršrutų planavimas ir offline funkcijos.
    EN: map layers, location updates, route planning, and offline download simulation are handled here.
*/

const currentPosition = {
    marker: null,
    accuracyCircle: null,
    track: null,
    positions: []
};

const routeState = {
    markers: [],
    line: null
};

const boatSettings = {
    length: 12,
    speed: 18,
    consumption: 35,
    units: 'metric'
};

const map = L.map('map', {
    center: [55.7, 21.1],
    zoom: 7,
    zoomControl: false
});

const baseLayers = {
    'Default': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }),
    'Satelitas': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    }),
    'Terra': L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
        attribution: 'Map tiles by Stamen Design'
    })
};

const sonarLayer = L.layerGroup();
const depthLayer = L.layerGroup();
const trackLayer = L.layerGroup().addTo(map);

baseLayers.Default.addTo(map);

L.control.layers(baseLayers, {
    'Sonar dugno žemėlapis': sonarLayer,
    'Gyliai ir žemėlapis': depthLayer
}, { collapsed: false, position: 'topright' }).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

function createDepthMarkers() {
    const points = [
        { lat: 55.83, lng: 21.22, depth: 29 },
        { lat: 55.63, lng: 21.0, depth: 51 },
        { lat: 55.46, lng: 20.9, depth: 72 },
        { lat: 55.9, lng: 21.5, depth: 18 }
    ];

    points.forEach(point => {
        L.circleMarker([point.lat, point.lng], {
            radius: 10,
            fillColor: '#3dd4ff',
            color: '#0bc8ff',
            weight: 2,
            opacity: 0.85,
            fillOpacity: 0.55
        }).bindPopup(`Gylis: ${point.depth} m<br>Depth: ${point.depth} m`).addTo(depthLayer);
    });
}

function createSonarOverlay() {
    const zone = L.circle([55.75, 21.1], {
        radius: 24000,
        color: '#4fd1ff',
        fillColor: '#1a81a6',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6,10'
    }).bindPopup('Sonar dugno apylinkė<br>Sonar bathymetry zone');
    sonarLayer.addLayer(zone);
}

function updatePositionMarker(lat, lng, accuracy) {
    if (!currentPosition.marker) {
        currentPosition.marker = L.circleMarker([lat, lng], {
            radius: 12,
            fillColor: '#2dd4a5',
            color: '#d9f99d',
            weight: 2,
            fillOpacity: 0.9
        }).addTo(map).bindPopup('Jūsų vieta / Your location');
        currentPosition.accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#35b3ff',
            fillColor: '#35b3ff',
            fillOpacity: 0.08
        }).addTo(map);
    } else {
        currentPosition.marker.setLatLng([lat, lng]);
        currentPosition.accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
    }

    currentPosition.positions.push([lat, lng]);
    if (currentPosition.positions.length > 1) {
        if (currentPosition.track) {
            trackLayer.removeLayer(currentPosition.track);
        }
        currentPosition.track = L.polyline(currentPosition.positions, {
            color: '#35b3ff',
            weight: 4,
            dashArray: '12,8'
        }).addTo(trackLayer);
    }

    map.panTo([lat, lng], { animate: true, duration: 1.1 });
    document.getElementById('gps-status').textContent = `GPS status: veikia / active — ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function geolocate() {
    if (!navigator.geolocation) {
        document.getElementById('gps-status').textContent = 'GPS nepasiekiamas / GPS unavailable';
        return;
    }
    navigator.geolocation.watchPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        updatePositionMarker(lat, lng, accuracy);
    }, error => {
        document.getElementById('gps-status').textContent = `GPS klaida / GPS error: ${error.message}`;
    }, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
    });
}

function setBoatSettingsFromUI() {
    boatSettings.length = Number(document.getElementById('boat-length').value);
    boatSettings.speed = Number(document.getElementById('boat-speed').value);
    boatSettings.consumption = Number(document.getElementById('boat-consumption').value);
    boatSettings.units = document.getElementById('distance-unit').value;
    renderBoatPreview();
}

function renderBoatPreview() {
    const speed = boatSettings.speed;
    const consumption = boatSettings.consumption;
    const range = (1000 / consumption * speed).toFixed(1);
    const labelUnit = boatSettings.units === 'metric' ? 'km' : 'mi';
    document.getElementById('boat-summary').textContent =
        `Laivo ilgis: ${boatSettings.length} m, greitis: ${speed} kn, paklaidos: ${consumption} l/val.`;
    document.getElementById('boat-range').textContent =
        `Numatoma rida: ${range} ${labelUnit} su 1000 l kuro. Estimated range: ${range} ${labelUnit}.`;
}

function distanceBetweenCoords(lat1, lng1, lat2, lng2) {
    const toRad = angle => angle * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function addRoutePoint(event) {
    const position = event.latlng;
    const marker = L.marker(position, {
        draggable: true
    }).addTo(map);

    marker.bindPopup('Maršruto taškas / Route waypoint').openPopup();
    routeState.markers.push(marker);
    marker.on('dragend', refreshRoute);
    refreshRoute();
}

function refreshRoute() {
    const positions = routeState.markers.map(marker => marker.getLatLng());
    if (routeState.line) {
        map.removeLayer(routeState.line);
    }
    routeState.line = L.polyline(positions, {
        color: '#ffab00',
        weight: 5,
        opacity: 0.8
    }).addTo(map);

    if (positions.length >= 2) {
        let total = 0;
        for (let i = 0; i < positions.length - 1; i++) {
            total += distanceBetweenCoords(positions[i].lat, positions[i].lng, positions[i + 1].lat, positions[i + 1].lng);
        }
        document.getElementById('route-distance').textContent = `Maršrutas: ${total.toFixed(2)} km / Route distance`;    }
}

function clearRoute() {
    routeState.markers.forEach(marker => map.removeLayer(marker));
    routeState.markers = [];
    if (routeState.line) {
        map.removeLayer(routeState.line);
        routeState.line = null;
    }
    document.getElementById('route-distance').textContent = 'Maršrutas tuščias / Route empty';
}

function downloadOfflineArea() {
    const bounds = map.getBounds();
    const offlineData = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        timestamp: Date.now(),
        bounds: bounds.toBBoxString(),
        notes: 'Offline area saved for navigation / Išsaugota offline zona navigacijai'
    };
    localStorage.setItem('marine-navigator-offline', JSON.stringify(offlineData));
    document.getElementById('offline-status').textContent = 'Offline zona išsaugota / Offline area saved.';
}

function loadOfflineArea() {
    const offlineData = localStorage.getItem('marine-navigator-offline');
    if (!offlineData) {
        document.getElementById('offline-status').textContent = 'Nėra išsaugotų offline duomenų / No offline data found.';
        return;
    }
    const data = JSON.parse(offlineData);
    map.setView([data.center.lat, data.center.lng], data.zoom);
    document.getElementById('offline-status').textContent = 'Offline zona įkelta / Offline area loaded.';
}

function activateTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== tabName);
    });
    document.querySelectorAll('.nav-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
}

function setupUI() {
    document.getElementById('boat-length').addEventListener('input', setBoatSettingsFromUI);
    document.getElementById('boat-speed').addEventListener('input', setBoatSettingsFromUI);
    document.getElementById('boat-consumption').addEventListener('input', setBoatSettingsFromUI);
    document.getElementById('distance-unit').addEventListener('change', setBoatSettingsFromUI);
    document.getElementById('clear-route').addEventListener('click', clearRoute);
    document.getElementById('download-offline').addEventListener('click', downloadOfflineArea);
    document.getElementById('load-offline').addEventListener('click', loadOfflineArea);
    document.querySelectorAll('.nav-tabs button').forEach(button => {
        button.addEventListener('click', () => activateTab(button.dataset.tab));
    });
    document.querySelector('.btn-strong').addEventListener('click', geolocate);
    document.querySelector('.btn-light').addEventListener('click', () => {
        document.getElementById('gps-status').textContent = 'Spustelėkite žemėlapį, kad pridėtumėte tašką / Click map to add waypoint.';
    });
    document.getElementById('map').addEventListener('click', addRoutePoint);
    activateTab('tab-navigation');
    setBoatSettingsFromUI();
}

function init() {
    createDepthMarkers();
    createSonarOverlay();
    setupUI();
    geolocate();
    document.getElementById('gps-status').textContent = 'Laukiama GPS duomenų / Waiting for GPS...';
}

window.addEventListener('load', init);
