// ====================================================================
// CONFIGURACIÓN CLAVE Y CONSTANTES DEL CSV
// ====================================================================

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1zJfexMve9Z_Pl7W-m6DOF6HtzmP6gHNuqBehS1KLWztKW3rPG16NVmO7vXUxNvYMZZrUHVqquO1Y/pub?gid=1532971115&single=true&output=csv"; 
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
const COLUMNA_IMAGENES = 'imagenes';
const COLUMNA_DESCRIPCION = 'descripcion_completa';

// Variables para paginación
let propiedadesFiltradas = [];
let propiedadesMostradas = 0;
const PROPIEDADES_POR_PAGINA = 12;

// Flag para evitar aplicar filtros durante la carga de más propiedades
let cargandoMasPropiedades = false;

// Variables para la galería de imágenes
let imagenesGaleria = [];
let imagenActualIndex = 0;

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
    
    const separadores = /[,|;]/;
    const urls = String(imagenesStr).split(separadores).map(url => url.trim()).filter(url => url);
    
    if (urls.length === 0) {
        return ['https://via.placeholder.com/400x300?text=Sin+Imagen'];
    }
    
    return urls.map(function(url) {
        return convertirURLGoogleDrive(url);
    });
}

function convertirURLGoogleDrive(url) {
    const regexDrive = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regexDrive);
    
    if (match && match[1]) {
        const fileId = match[1];
        return 'https://drive.google.com/uc?export=view&id=' + fileId;
    }
    
    const regexImgur = /imgur\.com\/([a-zA-Z0-9]+)$/;
    const matchImgur = url.match(regexImgur);
    
    if (matchImgur && matchImgur[1]) {
        const imgurId = matchImgur[1];
        return 'https://i.imgur.com/' + imgurId + '.jpg';
    }
    
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
            propiedadesFiltradas = PROPIEDADES;
            propiedadesMostradas = 0;
            configurarFiltros();
            renderizarListado(PROPIEDADES);
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
    if (cargandoMasPropiedades) {
        console.log('⏸️ Cargando más propiedades, filtros pausados');
        return;
    }
    
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

    propiedadesFiltradas = resultados;
    propiedadesMostradas = 0;
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
        let timeoutId;
        
        const aplicarFiltrosConRetraso = function() {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(aplicarFiltros, 300);
        };
        
        form.addEventListener('input', aplicarFiltrosConRetraso);
        form.addEventListener('change', aplicarFiltros);
        sincronizarSliders();
    }
}

// ====================================================================
// RENDERIZADO DEL LISTADO CON LAZY LOADING
// ====================================================================

function renderizarListado(listado) {
    const contenedor = document.getElementById('listado');
    if (!contenedor) return;
    
    console.log('renderizarListado llamado con', listado.length, 'propiedades');
    
    contenedor.innerHTML = ''; 

    if (listado.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron propiedades que coincidan con los filtros aplicados.</p>';
        return;
    }

    propiedadesFiltradas = listado;
    propiedadesMostradas = 0;
    
    console.log('Reseteado a 0. Llamando a cargarMasPropiedades');
    
    cargarMasPropiedades();
}

function cargarMasPropiedades() {
    const contenedor = document.getElementById('listado');
    if (!contenedor) return;
    
    cargandoMasPropiedades = true;
    
    console.log('🔄 cargarMasPropiedades - Mostradas:', propiedadesMostradas, 'Total:', propiedadesFiltradas.length);
    
    const btnCargarMasExistente = document.getElementById('btn-cargar-mas');
    if (btnCargarMasExistente) {
        btnCargarMasExistente.remove();
    }
    
    const mensajeFinExistente = contenedor.querySelector('.mensaje-fin');
    if (mensajeFinExistente) {
        mensajeFinExistente.remove();
    }
    
    const inicio = propiedadesMostradas;
    const fin = Math.min(inicio + PROPIEDADES_POR_PAGINA, propiedadesFiltradas.length);
    
    console.log('📦 Renderizando del', inicio, 'al', fin);
    
    const fragmento = document.createDocumentFragment();
    
    for (let i = inicio; i < fin; i++) {
        const propiedad = propiedadesFiltradas[i];
        const card = document.createElement('article');
        card.className = 'propiedad-card';
        
        const precioData = obtenerPrecioYMoneda(propiedad);
        const precioFormateado = convertirADivisa(precioData.valor, precioData.moneda);
        
        const nombrePropiedad = (propiedad[COLUMNA_TIPO] || 'Inmueble') + ' en ' + (propiedad[COLUMNA_UBICACION] || 'Lima');
        const enlaceWhatsApp = generarEnlaceWhatsApp(propiedad[COLUMNA_CONTACTO], nombrePropiedad);
        const imagenPrincipal = obtenerImagenPrincipal(propiedad);
        const urlDetalle = 'propiedad.html?id=' + propiedad[COLUMNA_ID];

        card.innerHTML = '<div class="propiedad-imagen">' +
            '<a href="' + urlDetalle + '">' +
            '<img src="' + imagenPrincipal + '" alt="' + nombrePropiedad + '" loading="lazy">' +
            '</a>' +
            '</div>' +
            '<div class="propiedad-info">' +
            '<h3>' + nombrePropiedad + '</h3>' +
            '<p class="precio">🏠 ' + (propiedad[COLUMNA_PROPOSITO] || 'Venta') + ': <strong>' + precioFormateado + '</strong></p>' +
            '<p>📐 ' + (propiedad[COLUMNA_M2] || 'N/D') + ' m² | 🛏️ ' + (propiedad[COLUMNA_DORM] || 'N/D') + ' | 🛁 ' + (propiedad[COLUMNA_BANIOS] || 'N/D') + '</p>' +
            '<p>📞 <a href="' + enlaceWhatsApp + '" target="_blank" rel="noopener noreferrer" class="whatsapp-link">Contactar por WhatsApp</a></p>' +
            '<a href="' + urlDetalle + '" class="boton-detalle">Ver Detalles</a>' +
            '</div>';
        
        fragmento.appendChild(card);
    }
    
    contenedor.appendChild(fragmento);
    
    propiedadesMostradas = fin;
    
    console.log('✅ Actualizado propiedadesMostradas a:', propiedadesMostradas);
    
    setTimeout(function() {
        cargandoMasPropiedades = false;
        console.log('✓ Flag desactivada, filtros habilitados nuevamente');
    }, 100);
    
    if (propiedadesMostradas < propiedadesFiltradas.length) {
        const btnCargarMas = document.createElement('div');
        btnCargarMas.id = 'btn-cargar-mas';
        btnCargarMas.className = 'btn-cargar-mas-container';
        
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn-cargar-mas';
        boton.textContent = 'Cargar más propiedades (' + (propiedadesFiltradas.length - propiedadesMostradas) + ' restantes)';
        
        boton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👆 Click detectado. propiedadesMostradas:', propiedadesMostradas);
            cargarMasPropiedades();
        });
        
        btnCargarMas.appendChild(boton);
        contenedor.appendChild(btnCargarMas);
    } else {
        const mensajeFin = document.createElement('div');
        mensajeFin.className = 'mensaje-fin';
        mensajeFin.innerHTML = '<p>✓ Se mostraron todas las propiedades (' + propiedadesFiltradas.length + ' en total)</p>';
        contenedor.appendChild(mensajeFin);
    }
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
    
    const galeriaContainer = document.getElementById('galeria-imagenes');
    if (galeriaContainer) {
        galeriaContainer.innerHTML = '';
        
        if (imagenes.length === 1) {
            galeriaContainer.innerHTML = '<img src="' + imagenes[0] + '" alt="' + nombrePropiedad + '" class="imagen-principal">';
        } else {
            imagenesGaleria = imagenes;
            imagenActualIndex = 0;
            
            let galeriaHTML = '<div class="galeria-principal">' +
                '<button class="galeria-nav galeria-nav-prev" id="btn-prev" aria-label="Imagen anterior">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
                '</button>' +
                '<div class="imagen-principal-container">' +
                '<img src="' + imagenes[0] + '" alt="' + nombrePropiedad + '" class="imagen-principal" id="imagen-activa">' +
                '<div class="contador-imagenes" id="contador-imagenes">1 / ' + imagenes.length + '</div>' +
                '</div>' +
                '<button class="galeria-nav galeria-nav-next" id="btn-next" aria-label="Imagen siguiente">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
                '</button>' +
                '</div>' +
                '<div class="miniaturas">';
            
            imagenes.forEach(function(img, index) {
                galeriaHTML += '<img src="' + img + '" alt="Imagen ' + (index + 1) + '" class="miniatura' + (index === 0 ? ' activa' : '') + '" data-index="' + index + '">';
            });
            
            galeriaHTML += '</div>';
            galeriaContainer.innerHTML = galeriaHTML;
            
            const btnPrev = document.getElementById('btn-prev');
            const btnNext = document.getElementById('btn-next');
            
            btnPrev.addEventListener('click', function() {
                cambiarImagen(-1);
            });
            
            btnNext.addEventListener('click', function() {
                cambiarImagen(1);
            });
            
            const miniaturas = galeriaContainer.querySelectorAll('.miniatura');
            miniaturas.forEach(function(miniatura) {
                miniatura.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    mostrarImagen(index);
                });
            });
            
            document.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowLeft') {
                    cambiarImagen(-1);
                } else if (e.key === 'ArrowRight') {
                    cambiarImagen(1);
                }
            });
        }
    }
    
    if (elementos.vendedor) elementos.vendedor.textContent = propiedad[COLUMNA_VENDEDOR] || 'No especificado';
    if (elementos.direccion) elementos.direccion.textContent = propiedad[COLUMNA_DIRECCION] || 'No especificado';
    if (elementos.distrito) elementos.distrito.textContent = propiedad[COLUMNA_UBICACION] || 'No especificado';
    if (elementos.referencias) elementos.referencias.textContent = propiedad[COLUMNA_REFERENCIAS] || 'No especificado';
    if (elementos.proposito) elementos.proposito.textContent = propiedad[COLUMNA_PROPOSITO] || 'No especificado';
    
    if (elementos.precio) elementos.precio.textContent = precio;
    if (elementos.mantenimiento) {
        const mant = propiedad[COLUMNA_MANTENIMIENTO] ? 'S/. ' + propiedad[COLUMNA_MANTENIMIENTO] : 'No aplica';
        elementos.mantenimiento.textContent = mant;
    }
    
    if (elementos.area) elementos.area.textContent = (propiedad[COLUMNA_M2] || 'N/D') + ' m²';
    if (elementos.dormitorios) elementos.dormitorios.textContent = propiedad[COLUMNA_DORM] || 'N/D';
    if (elementos.banios) elementos.banios.textContent = propiedad[COLUMNA_BANIOS] || 'N/D';
    if (elementos.pisoUbicacion) elementos.pisoUbicacion.textContent = propiedad[COLUMNA_PISO_UBICACION] || 'N/D';
    if (elementos.pisosEdificio) elementos.pisosEdificio.textContent = propiedad[COLUMNA_PISOS_EDIFICIO] || 'N/D';
    if (elementos.garaje) elementos.garaje.textContent = propiedad[COLUMNA_GARAJE] || '0';
    if (elementos.areasComunes) elementos.areasComunes.textContent = propiedad[COLUMNA_AREAS_COMUNES] || 'No especificado';
    if (elementos.antiguedad) elementos.antiguedad.textContent = propiedad[COLUMNA_ANTIGUEDAD] || 'No especificado';
    
    if (elementos.caracteristicas) elementos.caracteristicas.textContent = propiedad[COLUMNA_CARACTERISTICAS] || 'No especificado';

    // Mostrar descripción completa con HTML
    const descripcionCompleta = document.getElementById('detalles-descripcion-completa');
    if (descripcionCompleta) {
        descripcionCompleta.innerHTML = propiedad[COLUMNA_DESCRIPCION] || 'No especificado';
    }
    
    if (elementos.contacto) {
        if (propiedad[COLUMNA_CONTACTO]) {
            elementos.contacto.innerHTML = '<a href="' + enlaceWhatsApp + '" target="_blank" rel="noopener noreferrer" class="whatsapp-link">💬 ' + propiedad[COLUMNA_CONTACTO] + ' (WhatsApp)</a>';
        } else {
            elementos.contacto.textContent = 'No especificado';
        }
    }
    
    if (elementos.email) elementos.email.textContent = propiedad[COLUMNA_CORREO] || 'No especificado';

    const descripcionContainer = document.getElementById('detalles-descripcion-completa');
    if (descripcionContainer) {
        const descripcion = propiedad[COLUMNA_DESCRIPCION];
        if (descripcion && descripcion.trim()) {
            descripcionContainer.innerHTML = '<p>' + descripcion + '</p>';
        } else {
            descripcionContainer.innerHTML = '<p style="color: #999; font-style: italic;">No hay descripción disponible.</p>';
        }
    }
    
    configurarBotonesCompartir(nombrePropiedad, precio);
}

function cambiarImagen(direccion) {
    imagenActualIndex += direccion;
    
    if (imagenActualIndex < 0) {
        imagenActualIndex = imagenesGaleria.length - 1;
    } else if (imagenActualIndex >= imagenesGaleria.length) {
        imagenActualIndex = 0;
    }
    
    mostrarImagen(imagenActualIndex);
}

function mostrarImagen(index) {
    imagenActualIndex = index;
    
    const imagenActiva = document.getElementById('imagen-activa');
    const contador = document.getElementById('contador-imagenes');
    const miniaturas = document.querySelectorAll('.miniatura');
    
    if (imagenActiva) {
        imagenActiva.src = imagenesGaleria[index];
    }
    
    if (contador) {
        contador.textContent = (index + 1) + ' / ' + imagenesGaleria.length;
    }
    
    miniaturas.forEach(function(miniatura, i) {
        if (i === index) {
            miniatura.classList.add('activa');
        } else {
            miniatura.classList.remove('activa');
        }
    });
}

function configurarBotonesCompartir(nombrePropiedad, precio) {
    const urlActual = window.location.href;
    const textoCompartir = 'Mira esta propiedad: ' + nombrePropiedad + ' - ' + precio;
    const textoEncoded = encodeURIComponent(textoCompartir);
    const urlEncoded = encodeURIComponent(urlActual);
    
    const btnWhatsApp = document.getElementById('btn-whatsapp');
    if (btnWhatsApp) {
        btnWhatsApp.href = 'https://wa.me/?text=' + textoEncoded + ' ' + urlEncoded;
    }
    
    const btnFacebook = document.getElementById('btn-facebook');
    if (btnFacebook) {
        btnFacebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + urlEncoded;
    }
    
    const btnTwitter = document.getElementById('btn-twitter');
    if (btnTwitter) {
        btnTwitter.href = 'https://twitter.com/intent/tweet?text=' + textoEncoded + '&url=' + urlEncoded;
    }
    
    const btnCopiar = document.getElementById('btn-copiar');
    if (btnCopiar) {
        btnCopiar.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(urlActual).then(function() {
                    const textoOriginal = btnCopiar.innerHTML;
                    btnCopiar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ¡Copiado!';
                    btnCopiar.style.background = '#28a745';
                    
                    setTimeout(function() {
                        btnCopiar.innerHTML = textoOriginal;
                        btnCopiar.style.background = '';
                    }, 2000);
                }).catch(function(err) {
                    console.error('Error al copiar:', err);
                    alert('No se pudo copiar el enlace');
                });
            } else {
                const inputTemp = document.createElement('input');
                inputTemp.value = urlActual;
                document.body.appendChild(inputTemp);
                inputTemp.select();
                document.execCommand('copy');
                document.body.removeChild(inputTemp);
                
                const textoOriginal = btnCopiar.innerHTML;
                btnCopiar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ¡Copiado!';
                btnCopiar.style.background = '#28a745';
                
                setTimeout(function() {
                    btnCopiar.innerHTML = textoOriginal;
                    btnCopiar.style.background = '';
                }, 2000);
            }
        });
    }
}

// ====================================================================
// INICIO DE EJECUCIÓN
// ====================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargarPropiedades);
} else {
    cargarPropiedades();
}
