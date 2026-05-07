let mapa = L.map('map').setView([36.7213, -4.4214], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);

let marcadores = [];
let controlRuta = null;

async function buscarCarreteraMasCercana(lat, lng, perfil) {

    let url =
        `https://router.project-osrm.org/nearest/v1/${perfil}/${lng},${lat}?number=1`;

    let respuesta = await fetch(url);
    let datos = await respuesta.json();

    if (datos.code === "Ok" && datos.waypoints.length > 0) {

        let coordenadas = datos.waypoints[0].location;

        return L.latLng(coordenadas[1], coordenadas[0]);
    }

    return null;
}

// marcador numerado
function crearIconoNumerado(numero) {

    return L.divIcon({
        className: '',
        html: `<div class="marcador-personalizado">${numero}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

async function generarRuta() {

    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];

    if (controlRuta) mapa.removeControl(controlRuta);

    document.getElementById('distanciaTotal').innerText = "📍 Distancia: 0 km";
    document.getElementById('tiempoTotal').innerText = "⏱️ Tiempo estimado: 0 min";

    let cantidadDePuntos = document.getElementById('cantidad').value;
    let perfil = document.getElementById('modoTransporte').value;

    let listaDePuntos = [];

    for (let i = 0; i < cantidadDePuntos; i++) {

        let lat, lng;

        // 🚶 PEATÓN MÁS URBANO (MEJORA IMPORTANTE)
        if (perfil === "foot") {

            // más cerca del centro → simula aceras reales
            lat = 36.7213 + (Math.random() - 0.5) * 0.015;
            lng = -4.4214 + (Math.random() - 0.5) * 0.015;

        } else {

            // coche → zona más amplia
            lat = 36.7213 + (Math.random() - 0.5) * 0.05;
            lng = -4.4214 + (Math.random() - 0.5) * 0.05;
        }

        let puntoBueno =
            await buscarCarreteraMasCercana(lat, lng, perfil);

        if (puntoBueno) {

            let marcador = L.marker(puntoBueno, {
                icon: crearIconoNumerado(i + 1)
            }).addTo(mapa);

            marcadores.push(marcador);
            listaDePuntos.push(puntoBueno);
        }
    }

    if (listaDePuntos.length > 1) {

        let colorRuta = perfil === "driving"
            ? "#0066ff"
            : "#00aa55";

        controlRuta = L.Routing.control({

            waypoints: listaDePuntos,

            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: perfil
            }),

            createControl: () => null,

            lineOptions: {
                styles: [
                    { color: 'white', opacity: 0.8, weight: 8 },

                    {
                        color: colorRuta,
                        opacity: 1,
                        weight: 5,
                        dashArray: perfil === "foot"
                            ? "3, 8"   // 🚶 más tipo "camino/acera"
                            : "10, 10"
                    }
                ]
            },

            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true

        }).addTo(mapa);

        controlRuta.on('routesfound', function (e) {

            let distanciaKm =
                (e.routes[0].summary.totalDistance / 1000).toFixed(2);

            let tiempoMin =
                Math.round(e.routes[0].summary.totalTime / 60);

            document.getElementById('distanciaTotal').innerText =
                `📍 Distancia: ${distanciaKm} km`;

            document.getElementById('tiempoTotal').innerText =
                `⏱️ Tiempo estimado: ${tiempoMin} min`;
        });
    }
}