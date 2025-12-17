// ====================================================================
// CONFIGURACIÓN CLAVE Y CONSTANTES DEL CSV
// ====================================================================

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiTXv6ObJDm5Z07dXZM7THkrFe6JQW5GE8pr4Tr2clKEZYAnga_EHCCSqumim4iLTX-Ul5dpxqDQ2S/pub?gid=1388338922&single=true&output=csv"; 

let PROPIEDADES = [];
const DELIMITADOR_CSV = ',';

const COLUMNA_ID = 'id'; 
const COLUMNA_VENDEDOR = 'vendedor';
const COLUMNA_TIPO = 'tipo_propiedad';
const COLUMNA_DIRECCION = 'direccion';
const COLUMNA_UBICACION = 'distrito';
const COLUMNA_REFERENCIAS = 'referencias';
const COLUMNA_PROPOSITO = 'proposito';
const COLUMNA_PRECIO_USD = 'presupuesto_dolares';
const COLUMNA_PRECIO_SOLES = 'presupuesto_soles';
const COLUMNA_MANTENIMIENTO = 'mantenimiento';
const COLUMNA_M2 = 'area_m2';
const COLUMNA_DORM = 'dormitorios';
const COLUMNA_BANIOS = 'baños';
const COLUMNA_PISO_UBICACION = 'piso_ubicacion';
const COLUMNA_PISOS_EDIFICIO = 'pisos_edificio';
const COLUMNA_GARAJE = 'garaje_cantidad';
const COLUMNA_AREAS_COMUNES = 'areas_comunes';
const COLUMNA_CARACTERISTICAS = 'caracteristicas';
const COLUMNA_ANTIGUEDAD = 'antiguedad';
const COLUMNA_DOCUMENTACION = 'documentacion';
const COLUMNA_CONTACTO = 'contacto';
const COLUMNA_CORREO = 'correo';
const COLUMNA_IMAGENES = 'imagenes'; // Cambiar temporalmente a 'correo' para probar

// ====================================================================
// FUNCIONES UTILITARIAS
// ====================================================================

function obtenerPrecioYMoneda(propiedad) {
    const precioUSD = parseFloat(propiedad[COLUMNA_PRECIO_USD]) || 0;
    const precioSoles = parseFloat(propiedad[COLUMNA_PRECIO_SOLES]) || 0;
    
    if (precioUSD > 0) {
        return { valor: precioUSD, moneda: 'USD', esUSD: true };
    } else if (precioSoles > 0) {
        return { valor: precioSoles, moneda: 'PEN', esUSD: false };
    }
    
    return { valor: 0, moneda: 'USD', esUSD: true };
}

function convertirADivisa(valor, moneda) {
    if (!valor || isNaN(parseFloat(valor))) return 'Precio no especificado';
    const num = parseFloat(String(valor).replace(/,/g, '').trim());
    
    const opciones = {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 0
    };
    return new Intl.NumberFormat('es-PE', opciones).format(num);
}

function generarEnlaceWhatsApp(telefono, nombrePropiedad) {
    if (!telefono) return '#';
    
    let numeroLimpio = String(telefono).replace(/[\s\-\(\)\+]/g, '');
    
    if (!numeroLimpio.startsWith('51') && numeroLimpio.length === 9) {
        numeroLimpio = '51' + numeroLimpio;
    }
    
    if (!/^\d+$/.test(numeroLimpio)) {
        return '#';
    }
    
    const mensaje = encodeURIComponent('Hola, estoy interesado en la propiedad: ' + nombrePropiedad);
    return 'https://wa.me/' + numeroLimpio + '?text=' + mensaje;
}

function obtenerImagenes(propiedad) {
    const imagenesStr = propiedad[COLUMNA_IMAGENES];
    
    if (!imagenesStr) {
        return ['https://via.placeholder.com/400x300?text=Sin+Imagen'];
    }
    
    // Si hay múltiples URLs separadas por coma, pipe o punto y coma
    const separadores = /[,|;]/;
    const urls = String(imagenesStr).split(separadores).map(url => url.trim()).filter(url => url);
    
    if (urls.length === 0) {
        return ['https://via.placeholder.com/400x300?text=Sin+Imagen'];
    }
    
    // Convertir URLs de Google Drive al formato correcto
    return urls.map(function(url) {
        return convertirURLGoogleDrive(url);
    });
}

function convertirURLGoogleDrive(url) {
    // Si es una URL de Google Drive en formato /file/d/ID/view, convertirla
    const regexDrive = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regexDrive);
    
    if (match && match[1]) {
        const fileId = match[1];
        return 'https://drive.google.com/uc?export=view&id=' + fileId;
    }
    
    // Convertir URLs de Imgur al formato directo
    const regexImgur = /imgur\.com\/([a-zA-Z0-9]+)$/;
    const matchImgur = url.match(regexImgur);
    
    if (matchImgur && matchImgur[1]) {
        const imgurId = matchImgur[1];
        return 'https://i.imgur.com/' + imgurId + '.jpg';
    }
    
    // Si ya está en formato correcto o es otra URL, devolverla tal cual
    return url;
}

function obtenerImagenPrincipal(propiedad) {
    const imagenes = obtenerImagenes(propiedad);
    return imagenes[0];
}

// ====================================================================
// CARGA DE DATOS
// ====================================================================

async function cargarPropiedades() {
    const urlActual = window.location.pathname;
    const tieneParametroID = new URLSearchParams(window.location.search).has('id');
    
    const contenedorListado = document.getElementById('listado');
    const contenedorDetalle = document.getElementById('detalle-propiedad-contenedor');
    const formularioFiltros = document.getElementById('form-filtros');
    
    const esPaginaListado = (
        document.body.id === 'pagina-listado' || 
        (contenedorListado && formularioFiltros) ||
        urlActual.includes('index.html') ||
        urlActual.endsWith('/')
    ) && !tieneParametroID;
    
    const esPaginaIndividual = (
        document.body.id === 'pagina-individual' || 
        urlActual.includes('propiedad.html') ||
        tieneParametroID
    ) && !contenedorListado;
    
    console.log('Página detectada - Listado:', esPaginaListado, 'Individual:', esPaginaIndividual);
    
    if (esPaginaListado && contenedorListado) {
        contenedorListado.innerHTML = '<p>Cargando datos. Por favor, espere...</p>';
    }
    
    try {
        const respuesta = await fetch(SHEET_URL);
        if (!respuesta.ok) throw new Error('HTTP error! status: ' + respuesta.status);
        
        const textoCsv = await respuesta.text();
        
        const resultadosParseados = Papa.parse(textoCsv, {
            header: true,
            skipEmptyLines: true,
            delimiter: DELIMITADOR_CSV,
            dynamicTyping: true
        });

        PROPIEDADES = resultadosParseados.data.filter(p => p[COLUMNA_ID]);
        
        if (PROPIEDADES.length === 0) {
            const mensaje = '<p>❌ No se encontraron propiedades. Verifique el CSV y los nombres de las columnas.</p>';
            if (contenedorListado) contenedorListado.innerHTML = mensaje;
            if (contenedorDetalle && document.getElementById('titulo-propiedad')) {
                document.getElementById('titulo-propiedad').textContent = 'Error: No hay datos';
            }
            return;
        }

        console.log('✅ ' + PROPIEDADES.length + ' propiedades cargadas.');

        if (esPaginaListado && !esPaginaIndividual) {
            renderizarListado(PROPIEDADES);
            configurarFiltros();
        } else if (esPaginaIndividual && !esPaginaListado) {
            mostrarPropiedadIndividual();
        }

    } catch (error) {
        console.error("Error al cargar las propiedades:", error);
        const mensajeError = '<p>❌ Error de conexión. Verifique el SHEET_URL y la publicación de su Hoja de Google.</p>';
        if (contenedorListado) contenedorListado.innerHTML = mensajeError;
        if (contenedorDetalle && document.getElementById('titulo-propiedad')) {
            document.getElementById('titulo-propiedad').textContent = 'Error de conexión';
        }
    }
}

// ====================================================================
// LÓGICA DE FILTROS
// ====================================================================

function obtenerValoresFiltros() {
    const form = document.getElementById('form-filtros');
    const monedaSeleccionada = form.moneda.value;
    
    return {
        accion: form.accion.value.trim().toLowerCase(),
        tipo: form.tipo.value,
        ubicacion: form.ubicacion.value.trim().toLowerCase(),
        presupuesto_min: parseFloat(form.presupuesto_min.value) || 0,
        presupuesto_max: parseFloat(form.presupuesto_max.value) || Infinity,
        moneda: monedaSeleccionada
    };
}

function aplicarFiltros() {
    const filtros = obtenerValoresFiltros();
    
    const resultados = PROPIEDADES.filter(propiedad => {
        if (filtros.accion) {
            const propositoProp = String(propiedad[COLUMNA_PROPOSITO] || '').toLowerCase();
            if (!propositoProp.includes(filtros.accion)) {
                return false;
            }
        }
        
        if (filtros.tipo && String(propiedad[COLUMNA_TIPO]).toLowerCase() !== filtros.tipo) {
            return false;
        }

        const ubicacionProp = String(propiedad[COLUMNA_UBICACION] || '').toLowerCase();
        if (filtros.ubicacion && !ubicacionProp.includes(filtros.ubicacion)) {
            return false;
        }
        
        const precioData = obtenerPrecioYMoneda(propiedad);
        const monedaPropiedad = precioData.esUSD ? 'USD' : 'PEN';
        
        if (monedaPropiedad !== filtros.moneda) {
            return false;
        }
        
        const precio = precioData.valor;
        if (precio < filtros.presupuesto_min || precio > filtros.presupuesto_max) {
            return false;
        }

        return true; 
    });

    renderizarListado(resultados);
}

function sincronizarSliders() {
    const sliderMin = document.getElementById('slider_min');
    const sliderMax = document.getElementById('slider_max');
    const inputMin = document.getElementById('presupuesto_min');
    const inputMax = document.getElementById('presupuesto_max');
    const valorMinSpan = document.getElementById('valor-min');
    const valorMaxSpan = document.getElementById('valor-max');
    const radiosMoneda = document.getElementsByName('moneda');
    
    if (!sliderMin || !sliderMax) return;
    
    function actualizarSimboloMoneda() {
        const monedaSeleccionada = document.querySelector('input[name="moneda"]:checked').value;
        const simbolo = monedaSeleccionada === 'USD' ? '$' : 'S/.';
        const maxValor = monedaSeleccionada === 'USD' ? 500000 : 1875000;
        
        sliderMin.max = maxValor;
        sliderMax.max = maxValor;
        
        const paso = monedaSeleccionada === 'USD' ? 10000 : 37500;
        sliderMin.step = paso;
        sliderMax.step = paso;
        
        sliderMin.value = 0;
        sliderMax.value = maxValor;
        inputMin.value = 0;
        inputMax.value = '';
        
        valorMinSpan.textContent = simbolo + '0';
        valorMaxSpan.textContent = simbolo + maxValor.toLocaleString('en-US') + '+';
        
        aplicarFiltros();
    }
    
    radiosMoneda.forEach(radio => {
        radio.addEventListener('change', actualizarSimboloMoneda);
    });
    
    sliderMin.addEventListener('input', function() {
        const monedaSeleccionada = document.querySelector('input[name="moneda"]:checked').value;
        const simbolo = monedaSeleccionada === 'USD' ? '$' : 'S/.';
        
        let minVal = parseInt(this.value);
        let maxVal = parseInt(sliderMax.value);
        const paso = monedaSeleccionada === 'USD' ? 10000 : 37500;
        
        if (minVal > maxVal - paso) {
            minVal = maxVal - paso;
            this.value = minVal;
        }
        
        inputMin.value = minVal;
        valorMinSpan.textContent = simbolo + minVal.toLocaleString('en-US');
        aplicarFiltros();
    });
    
    sliderMax.addEventListener('input', function() {
        const monedaSeleccionada = document.querySelector('input[name="moneda"]:checked').value;
        const simbolo = monedaSeleccionada === 'USD' ? '$' : 'S/.';
        const maxValor = monedaSeleccionada === 'USD' ? 500000 : 1875000;
        
        let maxVal = parseInt(this.value);
        let minVal = parseInt(sliderMin.value);
        const paso = monedaSeleccionada === 'USD' ? 10000 : 37500;
        
        if (maxVal < minVal + paso) {
            maxVal = minVal + paso;
            this.value = maxVal;
        }
        
        inputMax.value = maxVal >= maxValor ? '' : maxVal;
        valorMaxSpan.textContent = maxVal >= maxValor ? simbolo + maxValor.toLocaleString('en-US') + '+' : simbolo + maxVal.toLocaleString('en-US');
        aplicarFiltros();
    });
    
    inputMin.addEventListener('input', function() {
        const monedaSeleccionada = document.querySelector('input[name="moneda"]:checked').value;
        const simbolo = monedaSeleccionada === 'USD' ? '$' : 'S/.';
        const maxValor = monedaSeleccionada === 'USD' ? 500000 : 1875000;
        
        const val = parseInt(this.value) || 0;
        sliderMin.value = Math.min(val, maxValor);
        valorMinSpan.textContent = simbolo + val.toLocaleString('en-US');
        aplicarFiltros();
    });
    
    inputMax.addEventListener('input', function() {
        const monedaSeleccionada = document.querySelector('input[name="moneda"]:checked').value;
        const simbolo = monedaSeleccionada === 'USD' ? '$' : 'S/.';
        const maxValor = monedaSeleccionada === 'USD' ? 500000 : 1875000;
        
        const val = parseInt(this.value) || maxValor;
        sliderMax.value = Math.min(val, maxValor);
        valorMaxSpan.textContent = val ? simbolo + val.toLocaleString('en-US') : simbolo + maxValor.toLocaleString('en-US') + '+';
        aplicarFiltros();
    });
}

function configurarFiltros() {
    const form = document.getElementById('form-filtros');
    if (form) {
        form.addEventListener('input', aplicarFiltros);
        form.addEventListener('change', aplicarFiltros);
        sincronizarSliders();
    }
}

// ====================================================================
// RENDERIZADO DEL LISTADO
// ====================================================================

function renderizarListado(listado) {
    const contenedor = document.getElementById('listado');
    if (!contenedor) return;
    
    contenedor.innerHTML = ''; 

    if (listado.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron propiedades que coincidan con los filtros aplicados.</p>';
        return;
    }

    listado.forEach(propiedad => {
        const card = document.createElement('article');
        card.className = 'propiedad-card';
        
        const precioData = obtenerPrecioYMoneda(propiedad);
        const precioFormateado = convertirADivisa(precioData.valor, precioData.moneda);
        
        const nombrePropiedad = (propiedad[COLUMNA_TIPO] || 'Inmueble') + ' en ' + (propiedad[COLUMNA_UBICACION] || 'Lima');
        const enlaceWhatsApp = generarEnlaceWhatsApp(propiedad[COLUMNA_CONTACTO], nombrePropiedad);
        const imagenPrincipal = obtenerImagenPrincipal(propiedad);

        card.innerHTML = '<div class="propiedad-imagen">' +
            '<img src="' + imagenPrincipal + '" alt="' + nombrePropiedad + '" loading="lazy">' +
            '</div>' +
            '<div class="propiedad-info">' +
            '<h3>' + nombrePropiedad + '</h3>' +
            '<p class="precio">🏠 ' + (propiedad[COLUMNA_PROPOSITO] || 'Venta') + ': <strong>' + precioFormateado + '</strong></p>' +
            '<p>📐 ' + (propiedad[COLUMNA_M2] || 'N/D') + ' m² | 🛏️ ' + (propiedad[COLUMNA_DORM] || 'N/D') + ' | 🛁 ' + (propiedad[COLUMNA_BANIOS] || 'N/D') + '</p>' +
            '<p>📞 <a href="' + enlaceWhatsApp + '" target="_blank" rel="noopener noreferrer" class="whatsapp-link">Contactar por WhatsApp</a></p>' +
            '<a href="propiedad.html?id=' + propiedad[COLUMNA_ID] + '" class="boton-detalle">Ver Detalles</a>' +
            '</div>';
        
        contenedor.appendChild(card);
    });
}

// ====================================================================
// VISTA INDIVIDUAL
// ====================================================================

function mostrarPropiedadIndividual() {
    const elementos = {
        contenedor: document.getElementById('detalle-propiedad-contenedor'),
        titulo: document.getElementById('titulo-propiedad'),
        vendedor: document.getElementById('detalles-vendedor'),
        direccion: document.getElementById('detalles-direccion'),
        distrito: document.getElementById('detalles-distrito'),
        referencias: document.getElementById('detalles-referencias'),
        proposito: document.getElementById('detalles-proposito'),
        precio: document.getElementById('detalles-precio'),
        mantenimiento: document.getElementById('detalles-mantenimiento'),
        area: document.getElementById('detalles-area'),
        dormitorios: document.getElementById('detalles-dormitorios'),
        banios: document.getElementById('detalles-banios'),
        pisoUbicacion: document.getElementById('detalles-piso-ubicacion'),
        pisosEdificio: document.getElementById('detalles-pisos-edificio'),
        garaje: document.getElementById('detalles-garaje'),
        areasComunes: document.getElementById('detalles-areas-comunes'),
        antiguedad: document.getElementById('detalles-antiguedad'),
        caracteristicas: document.getElementById('detalles-caracteristicas'),
        documentacion: document.getElementById('detalles-documentacion'),
        contacto: document.getElementById('detalles-contacto'),
        email: document.getElementById('detalles-email')
    };
    
    if (!elementos.contenedor || !elementos.titulo) {
        return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const idUnico = params.get('id');

    if (!idUnico) {
        elementos.contenedor.innerHTML = '<p>Error: No se ha especificado una propiedad (falta el parámetro ID).</p>';
        return;
    }

    const propiedad = PROPIEDADES.find(p => String(p[COLUMNA_ID]) === idUnico);

    if (!propiedad) {
        elementos.contenedor.innerHTML = '<p>Error: No se encontró la propiedad con el ID: ' + idUnico + '</p>';
        return;
    }
    
    const precioData = obtenerPrecioYMoneda(propiedad);
    const precio = convertirADivisa(precioData.valor, precioData.moneda);
    const nombrePropiedad = (propiedad[COLUMNA_TIPO] || 'Inmueble') + ' en ' + (propiedad[COLUMNA_UBICACION] || 'Lima');
    const enlaceWhatsApp = generarEnlaceWhatsApp(propiedad[COLUMNA_CONTACTO], nombrePropiedad);
    const imagenes = obtenerImagenes(propiedad);

    elementos.titulo.textContent = (propiedad[COLUMNA_PROPOSITO] || 'Propiedad') + ' - ' + nombrePropiedad;
    
    // Renderizar galería de imágenes
    const galeriaContainer = document.getElementById('galeria-imagenes');
    if (galeriaContainer) {
        galeriaContainer.innerHTML = '';
        
        if (imagenes.length === 1) {
            galeriaContainer.innerHTML = '<img src="' + imagenes[0] + '" alt="' + nombrePropiedad + '" class="imagen-principal">';
        } else {
            let galeriaHTML = '<div class="imagen-principal-container">' +
                '<img src="' + imagenes[0] + '" alt="' + nombrePropiedad + '" class="imagen-principal" id="imagen-activa">' +
                '</div>' +
                '<div class="miniaturas">';
            
            imagenes.forEach(function(img, index) {
                galeriaHTML += '<img src="' + img + '" alt="Imagen ' + (index + 1) + '" class="miniatura" data-index="' + index + '">';
            });
            
            galeriaHTML += '</div>';
            galeriaContainer.innerHTML = galeriaHTML;
            
            const miniaturas = galeriaContainer.querySelectorAll('.miniatura');
            const imagenActiva = document.getElementById('imagen-activa');
            
            miniaturas.forEach(function(miniatura) {
                miniatura.addEventListener('click', function() {
                    const index = this.getAttribute('data-index');
                    imagenActiva.src = imagenes[index];
                    
                    miniaturas.forEach(m => m.classList.remove('activa'));
                    this.classList.add('activa');
                });
            });
            
            if (miniaturas.length > 0) {
                miniaturas[0].classList.add('activa');
            }
        }
    }
    
    // Llenar información general
    if (elementos.vendedor) elementos.vendedor.textContent = propiedad[COLUMNA_VENDEDOR] || 'No especificado';
    if (elementos.direccion) elementos.direccion.textContent = propiedad[COLUMNA_DIRECCION] || 'No especificado';
    if (elementos.distrito) elementos.distrito.textContent = propiedad[COLUMNA_UBICACION] || 'No especificado';
    if (elementos.referencias) elementos.referencias.textContent = propiedad[COLUMNA_REFERENCIAS] || 'No especificado';
    if (elementos.proposito) elementos.proposito.textContent = propiedad[COLUMNA_PROPOSITO] || 'No especificado';
    
    // Llenar información económica
    if (elementos.precio) elementos.precio.textContent = precio;
    if (elementos.mantenimiento) {
        const mant = propiedad[COLUMNA_MANTENIMIENTO] ? 'S/. ' + propiedad[COLUMNA_MANTENIMIENTO] : 'No aplica';
        elementos.mantenimiento.textContent = mant;
    }
    
    // Llenar características de la propiedad
    if (elementos.area) elementos.area.textContent = (propiedad[COLUMNA_M2] || 'N/D') + ' m²';
    if (elementos.dormitorios) elementos.dormitorios.textContent = propiedad[COLUMNA_DORM] || 'N/D';
    if (elementos.banios) elementos.banios.textContent = propiedad[COLUMNA_BANIOS] || 'N/D';
    if (elementos.pisoUbicacion) elementos.pisoUbicacion.textContent = propiedad[COLUMNA_PISO_UBICACION] || 'N/D';
    if (elementos.pisosEdificio) elementos.pisosEdificio.textContent = propiedad[COLUMNA_PISOS_EDIFICIO] || 'N/D';
    if (elementos.garaje) elementos.garaje.textContent = propiedad[COLUMNA_GARAJE] || '0';
    if (elementos.areasComunes) elementos.areasComunes.textContent = propiedad[COLUMNA_AREAS_COMUNES] || 'No especificado';
    if (elementos.antiguedad) elementos.antiguedad.textContent = propiedad[COLUMNA_ANTIGUEDAD] || 'No especificado';
    
    // Llenar características adicionales y documentación
    if (elementos.caracteristicas) elementos.caracteristicas.textContent = propiedad[COLUMNA_CARACTERISTICAS] || 'No especificado';
    if (elementos.documentacion) elementos.documentacion.textContent = propiedad[COLUMNA_DOCUMENTACION] || 'No especificado';
    
    // Llenar contacto
    if (elementos.contacto) {
        if (propiedad[COLUMNA_CONTACTO]) {
            elementos.contacto.innerHTML = '<a href="' + enlaceWhatsApp + '" target="_blank" rel="noopener noreferrer" class="whatsapp-link">💬 ' + propiedad[COLUMNA_CONTACTO] + ' (WhatsApp)</a>';
        } else {
            elementos.contacto.textContent = 'No especificado';
        }
    }
    
    if (elementos.email) elementos.email.textContent = propiedad[COLUMNA_CORREO] || 'No especificado';
}

// ====================================================================
// INICIO DE EJECUCIÓN
// ====================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargarPropiedades);
} else {
    cargarPropiedades();
}
