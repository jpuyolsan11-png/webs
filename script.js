let mapa = L.map('map').setView([36.7213, -4.4214], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);

let marcadores = [];
let controlRuta = null;
const CONSUMO_MEDIO = 7; // Litros/100km

// Obtener ubicación actual o centro de Málaga
async function obtenerPuntoDeInicio() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(L.latLng(pos.coords.latitude, pos.coords.longitude)),
            () => resolve(L.latLng(36.7213, -4.4214))
        );
    });
}

async function irADestino() {
    let direccion = document.getElementById('destinoInput').value;
    let perfil = document.getElementById('modoTransporte').value;

    if (!direccion) return alert("Escribe un destino");

    // Geocodificación
    let urlGeocoding = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`;

    try {
        let res = await fetch(urlGeocoding);
        let datos = await res.json();

        if (datos.length > 0) {
            let puntoDestino = L.latLng(parseFloat(datos[0].lat), parseFloat(datos[0].lon));
            let puntoOrigen = await obtenerPuntoDeInicio();
            dibujarRutaFinal([puntoOrigen, puntoDestino], perfil);
        } else {
            alert("No se encontró la ubicación");
        }
    } catch (e) {
        console.error(e);
    }
}

function dibujarRutaFinal(listaDePuntos, perfil) {
    // Limpiar previo
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    if (controlRuta) mapa.removeControl(controlRuta);

    // Perfil para el servidor OSRM (car o foot)
    let osrmProfile = (perfil === "driving") ? "car" : "foot";

    // Crear marcadores
    listaDePuntos.forEach((p, i) => {
        let texto = i === 0 ? "A" : "B";
        let m = L.marker(p, {
            icon: L.divIcon({ className: '', html: `<div class="marcador-personalizado">${texto}</div>`, iconSize: [30, 30] })
        }).addTo(mapa);
        marcadores.push(m);
    });

    // Control de ruta con perfil dinámico
    controlRuta = L.Routing.control({
        waypoints: listaDePuntos,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: osrmProfile // Esto corrige que use aceras o carreteras
        }),
        createControl: () => null,
        lineOptions: {
            styles: [
                { color: 'white', opacity: 0.8, weight: 8 },
                { color: perfil === "driving" ? "#0066ff" : "#00aa55", weight: 5 }
            ]
        },
        fitSelectedRoutes: true
    }).addTo(mapa);

    controlRuta.on('routesfound', function (e) {
        let ruta = e.routes[0];
        let dist = (ruta.summary.totalDistance / 1000).toFixed(2);
        let tiempo = Math.round(ruta.summary.totalTime / 60);

        document.getElementById('distanciaTotal').innerText = `📍 Distancia: ${dist} km`;
        document.getElementById('tiempoTotal').innerText = `⏱️ Tiempo: ${tiempo} min`;

        let cuadroGasto = document.getElementById('gastoGasolina');
        cuadroGasto.style.display = "block";

        if (perfil === "foot") {
            cuadroGasto.innerText = `👟 Calorías: ${(dist * 55).toFixed(0)} kcal`;
            cuadroGasto.style.background = "rgba(0, 170, 85, 0.4)";
        } else {
            let litros = ((dist * CONSUMO_MEDIO) / 100).toFixed(2);
            cuadroGasto.innerText = `⛽ Consumo: ${litros} L`;
            cuadroGasto.style.background = "rgba(255, 183, 3, 0.4)";
        }
    });
}
