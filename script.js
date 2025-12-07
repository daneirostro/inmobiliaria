// ====================================================================
// CONFIGURACIÓN CLAVE
// ====================================================================

// ⚠️ IMPORTANTE: REEMPLAZA ESTE URL con el enlace CSV que obtuviste al 
// publicar tu Google Sheet (Archivo > Compartir > Publicar en la web).
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRvsVH4vPOaGi-27Oof4k0OrhgXwYNB8KqduzGgIhwjoaIcT88rbDczgcFV0H7Xa67AQrwt-ZaWz99M/pub?gid=1251243348&single=true&output=csv"; 

let PROPIEDADES = []; // Almacenará todos los datos de las propiedades
const DELIMITADOR_CSV = ';'; // Debe coincidir con el delimitador usado en tu script de Python

// ====================================================================
// FUNCIONES UTILITARIAS
// ====================================================================

/**
 * Convierte un número en formato de divisa (USD o PEN).
 * @param {number} valor - El valor numérico.
 * @param {string} moneda - 'USD' o 'PEN'.
 */
function convertirADivisa(valor, moneda = 'USD') {
    if (isNaN(valor) || !valor) return 'Precio no especificado';
    
    // Convertir la coma decimal a punto antes de parsear si es necesario
    const num = parseFloat(String(valor).replace(',', '.'));

    const opciones = {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 0 // No muestra decimales si son 0
    };
    return new Intl.NumberFormat('es-PE', opciones).format(num);
}

// ====================================================================
// 1. CARGA DE DATOS (PapaParse)
// ====================================================================

/**
 * Obtiene el CSV de Google Sheets, lo parsea y carga los datos.
 * @returns {Promise<void>} - Resuelve al terminar la carga.
 */
async function cargarPropiedades() {
    const contenedorListado = document.getElementById('listado') || document.getElementById('detalle-propiedad-contenedor');
    if (contenedorListado) {
        contenedorListado.innerHTML = '<p>Cargando datos. Por favor, espere...</p>';
    }
    
    try {
        const respuesta = await fetch(SHEET_URL);
        if (!respuesta.ok) throw new Error(`HTTP error! status: ${respuesta.status}`);
        
        const textoCsv = await respuesta.text();
        
        // USO DE PAPAPARSE
        const resultadosParseados = Papa.parse(textoCsv, {
            header: true,
            skipEmptyLines: true,
            delimiter: DELIMITADOR_CSV, // Usamos el punto y coma
            dynamicTyping: true
        });

        // Limpiar y formatear los datos (eliminar filas sin datos cruciales)
        PROPIEDADES = resultadosParseados.data.filter(p => p.archivo_origen);
        
        // Mostrar error si la hoja está vacía
        if (PROPIEDADES.length === 0) {
            contenedorListado.innerHTML = '<p>❌ No se encontraron propiedades o el formato del CSV es incorrecto.</p>';
            return;
        }

        console.log(`✅ ${PROPIEDADES.length} propiedades cargadas.`);

        // Solo ejecutar las funciones de visualización si no estamos en un error
        if (document.body.id === 'pagina-listado') {
            renderizarListado(PROPIEDADES);
            configurarFiltros();
        } else if (document.body.id === 'pagina-individual') {
            mostrarPropiedadIndividual();
        }

    } catch (error) {
        console.error("Error al cargar las propiedades:", error);
        if (contenedorListado) {
            contenedorListado.innerHTML = '<p>❌ Error de conexión. Verifique el SHEET_URL y que la Hoja de Google esté publicada correctamente.</p>';
        }
    }
}

// ====================================================================
// 2. LÓGICA DE FILTROS (index.html)
// ====================================================================

/**
 * Captura los valores de los inputs de filtro.
 */
function obtenerValoresFiltros() {
    const form = document.getElementById('form-filtros');
    return {
        tipo: form.tipo.value,
        ubicacion: form.ubicacion.value.trim().toLowerCase(),
        presupuesto_min: parseFloat(form.presupuesto_min.value) || 0,
        presupuesto_max: parseFloat(form.presupuesto_max.value) || Infinity,
    };
}

/**
 * Aplica los filtros al listado de propiedades.
 */
function aplicarFiltros() {
    const filtros = obtenerValoresFiltros();
    
    const resultados = PROPIEDADES.filter(propiedad => {
        // Filtro por TIPO DE PROPIEDAD
        if (filtros.tipo && propiedad.tipo_propiedad !== filtros.tipo) {
            return false;
        }

        // Filtro por UBICACIÓN (Búsqueda parcial en minúsculas)
        const ubicacionProp = String(propiedad.ubicacion || '').toLowerCase();
        if (filtros.ubicacion && !ubicacionProp.includes(filtros.ubicacion)) {
            return false;
        }
        
        // Filtro por PRESUPUESTO
        // El precio en la hoja puede venir como '120,000' (string) o como number
        let precioNum = parseFloat(String(propiedad.presupuesto || '').replace('$', '').replace('S/', '').replace(/,/g, '').trim());
        if (isNaN(precioNum)) {
            // Intenta extraer el número del string si no pudo ser parseado directamente
            const match = String(propiedad.presupuesto || '').match(/(\d+)/);
            precioNum = match ? parseFloat(match[1]) : 0;
        }
        
        if (precioNum < filtros.presupuesto_min || precioNum > filtros.presupuesto_max) {
            return false;
        }

        return true; // Pasa todos los filtros
    });

    renderizarListado(resultados);
}

/**
 * Asocia la función de filtrado al formulario.
 */
function configurarFiltros() {
    const form = document.getElementById('form-filtros');
    if (form) {
        // Aplicar filtros cada vez que un campo cambia
        form.addEventListener('input', aplicarFiltros);
        form.addEventListener('change', aplicarFiltros);
    }
}


// ====================================================================
// 3. RENDERIZADO DEL LISTADO (index.html)
// ====================================================================

/**
 * Dibuja las tarjetas de propiedades en el contenedor #listado.
 * @param {Array<Object>} listado - Array de propiedades a mostrar.
 */
function renderizarListado(listado) {
    const contenedor = document.getElementById('listado');
    contenedor.innerHTML = ''; // Limpia el contenido anterior

    if (listado.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron propiedades que coincidan con los filtros aplicados.</p>';
        return;
    }

    listado.forEach(propiedad => {
        const card = document.createElement('article');
        card.className = 'propiedad-card';
        
        // Uso de los datos estructurados
        const precioFormateado = convertirADivisa(propiedad.presupuesto);

        card.innerHTML = `
            <h3>${propiedad.tipo_propiedad || 'Inmueble'} en ${propiedad.ubicacion || 'Lima'}</h3>
            <p class="precio">💰 ${propiedad.proposito_estado || 'Venta'}: <strong>${precioFormateado}</strong></p>
            <p>📐 ${propiedad.dimensiones || 'N/D'} m² | 🛏️ ${propiedad.dormitorios || 'N/D'} | 🛁 ${propiedad.baños || 'N/D'}</p>
            
            <a href="propiedad.html?id=${propiedad.archivo_origen}" class="boton-detalle">Ver Detalles</a>
        `;
        contenedor.appendChild(card);
    });
}

// ====================================================================
// 4. VISTA INDIVIDUAL (propiedad.html)
// ====================================================================

/**
 * Muestra los detalles de una sola propiedad basados en el parámetro 'id' de la URL.
 */
function mostrarPropiedadIndividual() {
    // 1. Obtener el ID de la URL
    const params = new URLSearchParams(window.location.search);
    const idUnico = params.get('id');

    if (!idUnico) {
        document.getElementById('detalle-propiedad-contenedor').innerHTML = '<p>Error: No se ha especificado una propiedad (falta el parámetro ID).</p>';
        return;
    }

    // 2. Buscar la propiedad en el array global
    const propiedad = PROPIEDADES.find(p => p.archivo_origen === idUnico);

    if (!propiedad) {
        document.getElementById('detalle-propiedad-contenedor').innerHTML = `<p>Error: No se encontró la propiedad con el ID: ${idUnico}</p>`;
        return;
    }
    
    // 3. Renderizar los detalles
    const precio = convertirADivisa(propiedad.presupuesto);
    const mant = propiedad.mantenimiento ? convertirADivisa(propiedad.mantenimiento, 'PEN') : 'No aplica';

    document.getElementById('titulo-propiedad').textContent = `${propiedad.proposito_estado || 'Propiedad'} - ${propiedad.tipo_propiedad || 'Inmueble'} en ${propiedad.ubicacion || 'Ubicación Desconocida'}`;
    
    document.getElementById('detalles-ubicacion').textContent = propiedad.ubicacion || 'No disponible';
    document.getElementById('detalles-presupuesto').textContent = precio;
    document.getElementById('detalles-dimensiones').textContent = `${propiedad.dimensiones || 'N/D'} m²`;
    document.getElementById('detalles-dormitorios').textContent = propiedad.dormitorios || 'N/D';
    document.getElementById('detalles-baños').textContent = propiedad.baños || 'N/D';
    
    document.getElementById('detalles-mantenimiento').textContent = `Costo de Mantenimiento: ${mant}`;
    document.getElementById('detalles-estado').textContent = `Estado: ${propiedad.proposito_estado || 'N/D'}`;
    document.getElementById('detalles-garaje').textContent = `Estacionamiento: ${propiedad.estacionamiento || 'No especificado'}`;
    document.getElementById('detalles-contacto').textContent = propiedad.contacto || 'Consultar con la inmobiliaria';
    
    // Opcional: Mostrar el texto crudo para validación
    // console.log("Texto OCR crudo para esta propiedad:", propiedad.texto_raw);
}

// ====================================================================
// INICIO DE EJECUCIÓN
// ====================================================================

// Llamar a la función principal al cargar la página
window.onload = cargarPropiedades;
