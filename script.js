let mapa = L.map('map').setView([36.7213, -4.4214], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);

let marcadores = [];
let controlRuta = null;
const CONSUMO_MEDIO = 7; // Litros/100km

// Valida si un punto es tierra firme (distancia a carretera < 500m)
async function buscarCarreteraMasCercana(lat, lng, perfil) {
    let url = `https://router.project-osrm.org/nearest/v1/${perfil}/${lng},${lat}?number=1`;
    try {
        let respuesta = await fetch(url);
        let datos = await respuesta.json();
        if (datos.code === "Ok" && datos.waypoints.length > 0) {
            if (datos.waypoints[0].distance > 500) return null; // Es mar o zona sin acceso
            let coordenadas = datos.waypoints[0].location;
            return L.latLng(coordenadas[1], coordenadas[0]);
        }
    } catch (e) { console.error(e); }
    return null;
}

// Punto inicial dinámico (GPS o azar total)
async function obtenerPuntoDeInicio(perfil) {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                let punto = await buscarCarreteraMasCercana(pos.coords.latitude, pos.coords.longitude, perfil);
                resolve(punto || L.latLng(36.7213, -4.4214));
            },
            async () => {
                let puntoValido = null;
                while (!puntoValido) {
                    let lat = 36.7213 + (Math.random() - 0.5) * 0.05;
                    let lng = -4.4214 + (Math.random() - 0.5) * 0.05;
                    puntoValido = await buscarCarreteraMasCercana(lat, lng, perfil);
                }
                resolve(puntoValido);
            }
        );
    });
}

function ordenarPuntosProximidad(puntos) {
    if (puntos.length <= 1) return puntos;
    let ordenados = [puntos.shift()];
    while (puntos.length > 0) {
        let ultimo = ordenados[ordenados.length - 1];
        puntos.sort((a, b) => ultimo.distanceTo(a) - ultimo.distanceTo(b));
        ordenados.push(puntos.shift());
    }
    return ordenados;
}

async function irADestino() {
    let direccion = document.getElementById('destinoInput').value;
    let perfil = document.getElementById('modoTransporte').value;
    if (!direccion) return alert("Escribe un destino");

    document.getElementById('gastoGasolina').style.display = "none";

    let urlGeocoding = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`;
    try {
        let res = await fetch(urlGeocoding);
        let datos = await res.json();
        if (datos.length > 0) {
            let puntoDestino = L.latLng(parseFloat(datos[0].lat), parseFloat(datos[0].lon));
            let puntoOrigen = await obtenerPuntoDeInicio(perfil);
            dibujarRutaFinal([puntoOrigen, puntoDestino]);
        } else { alert("No encontrado"); }
    } catch (e) { console.error(e); }
}

async function generarRuta() {
    let cantidad = document.getElementById('cantidad').value;
    let perfil = document.getElementById('modoTransporte').value;
    document.getElementById('gastoGasolina').style.display = "none";

    let puntoInicial = await obtenerPuntoDeInicio(perfil);
    let puntosTemporales = [puntoInicial];

    for (let i = 1; i < cantidad; i++) {
        let puntoValido = null;
        while (!puntoValido) {
            let lat = puntoInicial.lat + (Math.random() - 0.5) * 0.07;
            let lng = puntoInicial.lng + (Math.random() - 0.5) * 0.07;
            puntoValido = await buscarCarreteraMasCercana(lat, lng, perfil);
        }
        puntosTemporales.push(puntoValido);
    }

    dibujarRutaFinal(ordenarPuntosProximidad(puntosTemporales));
}

function dibujarRutaFinal(listaDePuntos) {
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    if (controlRuta) mapa.removeControl(controlRuta);

    let perfil = document.getElementById('modoTransporte').value;

    listaDePuntos.forEach((p, i) => {
        let m = L.marker(p, {
            icon: L.divIcon({ className: '', html: `<div class="marcador-personalizado">${i + 1}</div>`, iconSize: [30, 30] })
        }).addTo(mapa);
        marcadores.push(m);
    });

    controlRuta = L.Routing.control({
        waypoints: listaDePuntos,
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: perfil }),
        createControl: () => null,
        lineOptions: { styles: [{ color: 'white', opacity: 0.8, weight: 8 }, { color: perfil === "driving" ? "#0066ff" : "#00aa55", weight: 5 }] },
        fitSelectedRoutes: true
    }).addTo(mapa);

    controlRuta.on('routesfound', function (e) {
        let dist = (e.routes[0].summary.totalDistance / 1000).toFixed(2);
        let tiempo = Math.round(e.routes[0].summary.totalTime / 60);
        let litros = ((dist * CONSUMO_MEDIO) / 100).toFixed(2);

        document.getElementById('distanciaTotal').innerText = `📍 Distancia: ${dist} km`;
        document.getElementById('tiempoTotal').innerText = `⏱️ Tiempo: ${tiempo} min`;

        let cuadroGasto = document.getElementById('gastoGasolina');
        cuadroGasto.style.display = "block";
        cuadroGasto.innerText = perfil === "foot" ? `👟 Calorías: ${(dist * 50).toFixed(0)} kcal` : `⛽ Consumo: ${litros} L`;
    });
}
