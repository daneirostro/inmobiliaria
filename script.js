// ====================================================================
// CONFIGURACIÓN CLAVE Y CONSTANTES DEL CSV
// ====================================================================

// ⚠️ IMPORTANTE: REEMPLAZA ESTE URL con el enlace CSV de tu Google Sheet.
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiTXv6ObJDm5Z07dXZM7THkrFe6JQW5GE8pr4Tr2clKEZYAnga_EHCCSqumim4iLTX-Ul5dpxqDQ2S/pub?gid=1388338922&single=true&output=csv"; 

let PROPIEDADES = []; // Almacenará todos los datos
const DELIMITADOR_CSV = ','; // ✅ CORREGIDO: Usamos la coma como delimitador

// NOTA: Los nombres de columna (keys) aquí deben coincidir exactamente con el CSV.
const COLUMNA_ID = 'id'; 
const COLUMNA_TIPO = 'tipo_propiedad';
const COLUMNA_UBICACION = 'distrito'; // Usamos 'distrito' como ubicación principal
const COLUMNA_PRECIO = 'presupuesto_dolares'; // Usamos el precio en USD
const COLUMNA_M2 = 'area_m2';
const COLUMNA_DORM = 'dormitorios';
const COLUMNA_BANIOS = 'baños';
const COLUMNA_CONTACTO = 'contacto';
const COLUMNA_PROPOSITO = 'proposito';


// ====================================================================
// FUNCIONES UTILITARIAS
// ====================================================================

/**
 * Convierte un número en formato de divisa (USD o PEN).
 * @param {string|number} valor - El valor numérico.
 */
function convertirADivisa(valor) {
    if (!valor || isNaN(parseFloat(valor))) return 'Precio no especificado';
    
    // Asumimos que los datos de 'presupuesto_dolares' son en USD
    const num = parseFloat(String(valor).replace(/,/g, '').trim()); // Limpia comas si las hubiera

    const opciones = {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    };
    return new Intl.NumberFormat('es-PE', opciones).format(num);
}

/**
 * Intenta establecer el textContent de un elemento, ignorando si el elemento no existe (null).
 * Esto evita que el script se caiga por un ID mal escrito.
 */
function setTextContent(id, content) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = content || 'N/D'; // Usa 'N/D' si el contenido está vacío
    } else {
        // Opcional: Esto ayuda a depurar en la consola si un ID está mal
        // console.warn(`Elemento HTML no encontrado: #${id}`);
    }
}

// ====================================================================
// 1. CARGA DE DATOS (PapaParse)
// ====================================================================

async function cargarPropiedades() {
    const contenedorListado = document.getElementById('listado') || document.getElementById('detalle-propiedad-contenedor');
    if (contenedorListado) {
        contenedorListado.innerHTML = '<p>Cargando datos. Por favor, espere...</p>';
    }
    
    try {
        const respuesta = await fetch(SHEET_URL);
        if (!respuesta.ok) throw new Error(`HTTP error! status: ${respuesta.status}`);
        
        const textoCsv = await respuesta.text();
        
        const resultadosParseados = Papa.parse(textoCsv, {
            header: true,
            skipEmptyLines: true,
            delimiter: DELIMITADOR_CSV, // ✅ Delimitador COMA
            dynamicTyping: true
        });

        // Filtrar filas sin ID o vacías y almacenar
        PROPIEDADES = resultadosParseados.data.filter(p => p[COLUMNA_ID]);
        
        if (PROPIEDADES.length === 0) {
            contenedorListado.innerHTML = '<p>❌ No se encontraron propiedades. Verifique el CSV y los nombres de las columnas.</p>';
            return;
        }

        console.log(`✅ ${PROPIEDADES.length} propiedades cargadas.`);

        // Iniciar la lógica de la página
        if (document.body.id === 'pagina-listado') {
            renderizarListado(PROPIEDADES);
            configurarFiltros();
        } else if (document.body.id === 'pagina-individual') {
            mostrarPropiedadIndividual();
        }

    } catch (error) {
        console.error("Error al cargar las propiedades:", error);
        if (contenedorListado) {
            contenedorListado.innerHTML = '<p>❌ Error de conexión. Verifique el SHEET_URL y la publicación de su Hoja de Google.</p>';
        }
    }
}

// ====================================================================
// 2. LÓGICA DE FILTROS (index.html)
// ====================================================================

function obtenerValoresFiltros() {
    const form = document.getElementById('form-filtros');
    return {
        tipo: form.tipo.value,
        ubicacion: form.ubicacion.value.trim().toLowerCase(),
        presupuesto_min: parseFloat(form.presupuesto_min.value) || 0,
        presupuesto_max: parseFloat(form.presupuesto_max.value) || Infinity,
    };
}

function aplicarFiltros() {
    const filtros = obtenerValoresFiltros();
    
    const resultados = PROPIEDADES.filter(propiedad => {
        // Filtro por TIPO DE PROPIEDAD
        if (filtros.tipo && String(propiedad[COLUMNA_TIPO]).toLowerCase() !== filtros.tipo) {
            return false;
        }

        // Filtro por UBICACIÓN (Distrito)
        const ubicacionProp = String(propiedad[COLUMNA_UBICACION] || '').toLowerCase();
        if (filtros.ubicacion && !ubicacionProp.includes(filtros.ubicacion)) {
            return false;
        }
        
        // Filtro por PRESUPUESTO (Usamos la columna de dólares)
        let precioNum = parseFloat(propiedad[COLUMNA_PRECIO] || 0);
        
        if (precioNum < filtros.presupuesto_min || precioNum > filtros.presupuesto_max) {
            return false;
        }

        return true; 
    });

    renderizarListado(resultados);
}

function configurarFiltros() {
    const form = document.getElementById('form-filtros');
    if (form) {
        form.addEventListener('input', aplicarFiltros);
        form.addEventListener('change', aplicarFiltros);
    }
}


// ====================================================================
// 3. RENDERIZADO DEL LISTADO (index.html)
// ====================================================================

function renderizarListado(listado) {
    const contenedor = document.getElementById('listado');
    contenedor.innerHTML = ''; 

    if (listado.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron propiedades que coincidan con los filtros aplicados.</p>';
        return;
    }

    listado.forEach(propiedad => {
        const card = document.createElement('article');
        card.className = 'propiedad-card';
        
        const precioFormateado = convertirADivisa(propiedad[COLUMNA_PRECIO]);

        card.innerHTML = `
            <h3>${propiedad[COLUMNA_TIPO] || 'Inmueble'} en ${propiedad[COLUMNA_UBICACION] || 'Lima'}</h3>
            <p class="precio">🏠 ${propiedad[COLUMNA_PROPOSITO] || 'Venta'}: <strong>${precioFormateado}</strong></p>
            <p>📐 ${propiedad[COLUMNA_M2] || 'N/D'} m² | 🛏️ ${propiedad[COLUMNA_DORM] || 'N/D'} | 🛁 ${propiedad[COLUMNA_BANIOS] || 'N/D'}</p>
            
            <a href="propiedad.html?id=${propiedad[COLUMNA_ID]}" class="boton-detalle">Ver Detalles</a>
        `;
        contenedor.appendChild(card);
    });
}

// ====================================================================
// 4. VISTA INDIVIDUAL (propiedad.html)
// ====================================================================

function mostrarPropiedadIndividual() {
    // 1. Obtener el ID de la URL
    const params = new URLSearchParams(window.location.search);
    const idUnico = params.get('id');

    if (!idUnico) {
        document.getElementById('detalle-propiedad-contenedor').innerHTML = '<p>Error: No se ha especificado una propiedad (falta el parámetro ID).</p>';
        return;
    }

    // 2. Buscar la propiedad en el array global
    // Importante: El ID es leído como string, se compara con el valor de la columna ID.
    const propiedad = PROPIEDADES.find(p => String(p[COLUMNA_ID]) === idUnico);

    if (!propiedad) {
        document.getElementById('detalle-propiedad-contenedor').innerHTML = `<p>Error: No se encontró la propiedad con el ID: ${idUnico}</p>`;
        return;
    }
    
    // 3. Renderizar los detalles
    const precio = convertirADivisa(propiedad[COLUMNA_PRECIO]);
    const mant = propiedad.mantenimiento ? `S/. ${propiedad.mantenimiento}` : 'No aplica';

    document.getElementById('titulo-propiedad').textContent = `${propiedad[COLUMNA_PROPOSITO] || 'Propiedad'} - ${propiedad[COLUMNA_TIPO] || 'Inmueble'} en ${propiedad[COLUMNA_UBICACION] || 'Ubicación Desconocida'}`;
    
    document.getElementById('detalles-ubicacion').textContent = `${propiedad.direccion || 'N/D'}, ${propiedad[COLUMNA_UBICACION] || 'N/D'}`;
    document.getElementById('detalles-presupuesto').textContent = precio;
    document.getElementById('detalles-dimensiones').textContent = `${propiedad[COLUMNA_M2] || 'N/D'} m²`;
    document.getElementById('detalles-dormitorios').textContent = propiedad[COLUMNA_DORM] || 'N/D';
    document.getElementById('detalles-baños').textContent = propiedad[COLUMNA_BANIOS] || 'N/D';
    
    document.getElementById('detalles-mantenimiento').textContent = `Costo de Mantenimiento: ${mant}`;
    document.getElementById('detalles-estado').textContent = `Estado/Propósito: ${propiedad[COLUMNA_PROPOSITO] || 'N/D'}`;
    document.getElementById('detalles-garaje').textContent = `Estacionamiento: ${propiedad.garaje_cantidad || '0'}`;
    document.getElementById('detalles-contacto').textContent = propiedad[COLUMNA_CONTACTO] || 'Consultar con la inmobiliaria';
}

// ====================================================================
// INICIO DE EJECUCIÓN
// ====================================================================

window.onload = cargarPropiedades;
