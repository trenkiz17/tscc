// Coordenadas iniciais (fallback)
const coords = [-19.9208, -43.9378]; // Belo Horizonte, MG

// Inicializar mapa
const map = L.map('map').setView(coords, 13);

// Adicionar tile do OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Criar grupo de camadas desenhadas
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Adicionar controle de desenho
const drawControl = new L.Control.Draw({
    draw: {
        polygon: true,
        rectangle: true,
        circle: false,
        marker: false,
        polyline: false
    },
    edit: {
        featureGroup: drawnItems
    }
});
map.addControl(drawControl);

// Área em hectares
let areaTotal = 0;

// Evento ao criar desenho
map.on(L.Draw.Event.CREATED, function(event){
    const layer = event.layer;
    drawnItems.clearLayers(); // remove desenhos antigos
    drawnItems.addLayer(layer);

    // Calcular área em metros²
    const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);

    // Converter para hectares (1 ha = 10.000 m²)
    areaTotal = area / 10000;

    document.getElementById("area").innerText = areaTotal.toFixed(2);
});

function calcularDiasCrescimento(solo, fertilizante, chuva) {
    // Base dias por tipo de solo
    let diasBase = 120; // default
    switch(solo){
        case "argiloso": diasBase = 125; break;
        case "arenoso": diasBase = 110; break;
        case "misto": diasBase = 115; break;
        case "latossolo vermelho": diasBase = 120; break;
        case "latossolo vermelho-amarelo": diasBase = 118; break;
        case "latossolo amarelo": diasBase = 117; break;
        case "nitossolo": diasBase = 122; break;
        case "cambissolo": diasBase = 119; break;
        case "planossolo": diasBase = 121; break;
        case "gleissolo": diasBase = 124; break;
        case "andossolo": diasBase = 116; break;
        case "espodossolo": diasBase = 115; break;
        case "organossolo": diasBase = 130; break;
    }

    // Ajuste por fertilizante
    if(fertilizante === "sim"){
        diasBase *= 0.95; // reduz 5%
    }

    // Ajuste por chuva
    if(chuva < 50) diasBase += 10; // seca
    else if(chuva > 150) diasBase -= 5; // muita chuva

    return Math.round(diasBase);
}

window.location.href = "login.html"; // Redireciona para login

document.getElementById("btnVerClima").addEventListener("click", () => {
    // Salva os dados da fazenda se quiser manter
    const fazenda = document.getElementById("fazenda").value;
    const municipio = document.getElementById("municipio").value;
    const solo = document.getElementById("solo").value;

    if(!fazenda || !municipio){
        alert("Preencha todos os campos!");
        return;
    }

    localStorage.setItem("fazenda", fazenda);
    localStorage.setItem("municipio", municipio);
    localStorage.setItem("solo", solo);

    // Redireciona para a página de clima/solo
    window.location.href = "clima_solo.html";
});


// Função para retornar solo aproximado
async function buscarSolo(lat, lon){
    try{
        const res = await fetch(`https://rest.soilgrids.org/query?lon=${lon}&lat=${lat}`);
        const data = await res.json();
        if(data && data.properties && data.properties.taxnwrb && data.properties.taxnwrb.taxons.length>0){
            // Pega o primeiro solo disponível
            return data.properties.taxnwrb.taxons[0].name;
        } 
        // Se não tiver retorno, faz uma estimativa aleatória realista
        const solos = ["Argiloso","Arenoso","Misto","Latossolo vermelho","Latossolo vermelho-amarelo","Latossolo amarelo","Nitossolo","Cambissolo","Planossolo","Gleissolo","Andossolo","Espodossolo","Organossolo"];
        const index = Math.floor(Math.random()*solos.length);
        return solos[index];
    }catch(e){
        console.log("Erro ao buscar solo", e);
        const solos = ["Argiloso","Arenoso","Misto","Latossolo vermelho","Latossolo vermelho-amarelo","Latossolo amarelo","Nitossolo","Cambissolo","Planossolo","Gleissolo","Andossolo","Espodossolo","Organossolo"];
        const index = Math.floor(Math.random()*solos.length);
        return solos[index];
    }
}

// Função para buscar tipo de solo (SoilGrids) com fallback
async function buscarSolo(lat, lon){
    const solosFallback = ["Argiloso","Arenoso","Misto","Latossolo vermelho","Latossolo vermelho-amarelo","Latossolo amarelo","Nitossolo","Cambissolo","Planossolo","Gleissolo","Andossolo","Espodossolo","Organossolo"];
    try{
        const res = await fetch(`https://rest.soilgrids.org/query?lon=${lon}&lat=${lat}`);
        const data = await res.json();
        const soloApi = data?.properties?.taxnwrb?.taxons?.[0]?.name;
        if(soloApi && soloApi !== "") return soloApi;
        // Se não tiver, pega aleatório da lista
        const index = Math.floor(Math.random()*solosFallback.length);
        return solosFallback[index];
    }catch(e){
        // Em caso de erro, pega aleatório
        const index = Math.floor(Math.random()*solosFallback.length);
        return solosFallback[index];
    }
}


async function atualizarClimaReal(center){
    try{
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${center.lat}&longitude=${center.lng}&current_weather=true&daily=precipitation_sum&timezone=America/Sao_Paulo`);
        const data = await res.json();

        // Valores reais
        const temp = data.current_weather?.temperature || layerAtual.temp;
        const vento = data.current_weather?.windspeed || layerAtual.vento;
        const chuva = data.daily?.precipitation_sum?.[0] || layerAtual.chuva;

        // Atualiza layerAtual
        layerAtual.temp = temp;
        layerAtual.vento = vento;
        layerAtual.chuva = chuva;
        chuvaAtual = parseFloat(chuva);

        // Atualiza painel da safra
        atualizarSafra();

    } catch(e){
        console.log("Erro ao buscar clima real", e);
    }
}

map.on(L.Draw.Event.CREATED, async function(e){
    const layer = e.layer;
    drawnItems.clearLayers();
    drawnItems.addLayer(layer);
    layerAtual = layer;

    // Área
    let coordsLayer = layer.getLatLngs()[0];
    if(layer instanceof L.Rectangle) coordsLayer = layer.getLatLngs()[0];
    areaTotal = L.GeometryUtil.geodesicArea(coordsLayer)/10000;
    document.getElementById("area").innerText = areaTotal.toFixed(2);

    const center = getCenterLatLng(layer);

    // Solo automático
    layerAtual.solo = soloAutomatico();
    document.getElementById("tipoSolo").innerText = layerAtual.solo;

    // --- Aqui adiciona o clima real ---
    await atualizarClimaReal(center);

    // --- Fica seu cálculo da safra original ---
    atualizarSafra();
});


// Ajuste pelo cultivo
switch(cultivo.toLowerCase()){
    case "soja": diasBase *= 1; break;
    case "milho": diasBase *= 0.9; break;
    case "feijão": diasBase *= 0.85; break;
    case "trigo": diasBase *= 1.1; break;
    default: diasBase *= 1; break;
}

if(fertilizante === "sim") {
    // Ajuste proporcional à quantidade de fertilizante
    // Exemplo: 50 kg/ha => 1% de redução
    const reducPercent = Math.min(quantFert / 50, 20); // Limite máximo de 20% de redução
    diasBase *= (1 - reducPercent/100);
}


// Função de cálculo de dias baseado no solo, fertilizante e chuva
function calcularDiasCrescimento(solo, fertilizante, quantFert, chuva){
    let diasBase = 120;

    // Ajuste base pelo tipo de solo
    switch(solo.toLowerCase()){
        case "argiloso": diasBase = 125; break;
        case "arenoso": diasBase = 110; break;
        case "misto": diasBase = 115; break;
        case "latossolo vermelho": diasBase = 120; break;
        case "latossolo vermelho-amarelo": diasBase = 118; break;
        case "latossolo amarelo": diasBase = 117; break;
        case "nitossolo": diasBase = 122; break;
        case "cambissolo": diasBase = 119; break;
        case "planossolo": diasBase = 121; break;
        case "gleissolo": diasBase = 124; break;
        case "andossolo": diasBase = 116; break;
        case "espodossolo": diasBase = 115; break;
        case "organossolo": diasBase = 130; break;
    }

    // Ajuste proporcional pelo fertilizante
    if(fertilizante === "sim") {
        // Cada 50 kg/ha reduz 1% do tempo
        const reducPercent = Math.min(quantFert / 50, 20); // máximo 20% de redução
        diasBase *= (1 - reducPercent/100);
    }

    // Ajuste pelo clima (chuva)
    if(chuva < 50) diasBase += 10;
    else if(chuva > 150) diasBase -= 5;

    return Math.round(diasBase);
}

const diasCrescimento = calcularDiasCrescimento(solo, fertilizante, quantFert, chuvaAtual);