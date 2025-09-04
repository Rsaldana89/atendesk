// src/public/js/solutions.js
// Edita libremente este archivo. No requiere base de datos.
// Las claves deben coincidir con el NOMBRE visible del departamento en el <select> (insensible a mayúsculas).

window.SOLUCIONES_FRECUENTES = {
    "Sistemas": [
      {
        titulo: "No imprime miniprinter",
        pasos: [
          "Verificar que la impresora esté encendida y con papel.",
          "Panel de Control → Dispositivos e impresoras → Establecer como predeterminada.",
          "Reiniciar el servicio de cola de impresión (spooler).",
          "Si persiste: desconectar/volver a conectar USB y probar impresión de prueba."
        ]
      },
      {
        titulo: "PC muy lenta",
        pasos: [
          "Desactivar apps no criticas como las camaras.",
          "Reiniciar el equipo completamente."
        ]
      }
    ],
  
    "CEDIS": [
      {
        titulo: "No puedo darle entrada a mi folio",
        pasos: [
          "Verifica con tus compañeros si no le dio entrada alguien más.",
          "Llama a CEDIS para confirmar el folio Ext.111.",
        ]
      }
    ],
  
    "Compras": [
      {
        titulo: "Proveedor no aparece al generar pedido",
        pasos: [
          "Validar que el proveedor esté activo.",
          "Comprobar categoría y listas asignadas.",
          "Actualizar catálogos (CTRL+R o botón 'Sincronizar')."
        ]
      }
    ],
  
    "Mantenimiento": [
      {
        titulo: "Refrigerador no enfría",
        pasos: [
          "Verificar conexión eléctrica y termostato.",
          "Revisar que no haya obstrucción en ventilaciones.",
          "Registrar temperaturas (ambiente y equipo).",
          "Si excede límites → programar visita técnica."
        ]
      }
    ]
  };
  