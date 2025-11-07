// src/public/js/solutions.js
// Edita libremente este archivo. No requiere base de datos.
// Las claves deben coincidir con el NOMBRE visible del departamento en el <select> (insensible a mayúsculas).

window.SOLUCIONES_FRECUENTES = {
  "Capital Humano": [
    {
      titulo: "No me llega mi correo de nóminas",
      pasos: [
        "Revisa tus bandejas de Spam o Correo no deseado.",
        "Márcalo como 'No spam' para recibirlo correctamente.",
        "Si ya revisaste y sigue sin llegar, levanta el ticket."
      ]
    },
    {
      titulo: "Reposición tarjeta de Vales",
      pasos: [
        "Llama a Sí Vale al 55 58 14 93 93 para reportar tu tarjeta.",
        "Anota el número de folio y agrégalo al reporte.",
        "Capital Humano te entregará la nueva tarjeta a través de tu jefe directo."
      ]
    }
  ],

  "Sistemas": [
    {
      titulo: "Pinpad no manda la señal de cobro",
      pasos: [
        "Reinicia la computadora y vuelve a probar.",
        "Si continúa sin funcionar, desconecta y conecta el cable USB en la parte trasera del CPU."
      ]
    },
    {
      titulo: "No pasan los tickets de báscula",
      pasos: [
        "Reinicia la báscula desconectándola de la corriente eléctrica.",
        "Si persiste, verifica conexión del cable de datos."
      ]
    },
    {
      titulo: "La báscula me marca precio manual",
      pasos: [
        "Presiona la penúltima tecla de la primera fila.",
        "Alterna entre modo 'Precio manual' e 'Ingresar PLU'."
      ]
    },
    {
      titulo: "El ticket de báscula no sale",
      pasos: [
        "Verifica que el papel esté colocado correctamente.",
        "Asegúrate de que el riel de salida no esté obstruido."
      ]
    },
    {
      titulo: "Me da error al facturar",
      pasos: [
        "Revisa el mensaje de error y compáralo con la constancia de situación fiscal del cliente.",
        "Si el error es el uso del CFDI, confirma con el cliente cuál necesita."
      ]
    }
  ],

  "CEDIS": [
    {
      titulo: "Faltante de mercancía al recibir",
      pasos: [
        "Informa al chofer de CEDIS en el momento.",
        "Envía mensaje por Teams a Erika Feliciano.",
        "Registra la devolución en sistema el mismo día con comentario: 'FALTANTE – dev el mismo día'.",
        "Adjunta foto del ticket o evidencia."
      ]
    },
    {
      titulo: "Me cobraron mercancía que no venía",
      pasos: [
        "Informa al chofer de CEDIS.",
        "Haz la devolución en sistema el mismo día con comentario: 'COBRADO SIN ENTREGAR – dev misma fecha'.",
        "Agrega foto del ticket o folio como evidencia."
      ]
    },
    {
      titulo: "No me cobraron mercancía que sí venía",
      pasos: [
        "Verifica que la mercancía haya sido solicitada.",
        "Levanta solicitud de cobro en sistema con comentario: 'FALTO COBRAR'.",
        "Informa al chofer."
      ]
    },
    {
      titulo: "Cantidad cobrada mayor a lo entregado",
      pasos: [
        "Informa al chofer y solicita foto de evidencia.",
        "Realiza la devolución en sistema el mismo día con comentario: 'CANTIDAD COBRADA > ENTREGADA'."
      ]
    },
    {
      titulo: "Cantidad cobrada menor a lo entregado",
      pasos: [
        "Informa al chofer.",
        "Levanta solicitud de cobro en sistema con comentario: 'FALTO COBRAR – diferencia >100 g/pzas'."
      ]
    },
    {
      titulo: "Producto cambiado respecto a lo solicitado",
      pasos: [
        "Notifica al chofer del cambio.",
        "Envía mensaje a Erika Feliciano por Teams.",
        "Realiza devolución con comentario: 'LLEGÓ CAMBIADO'.",
        "Adjunta foto del producto recibido."
      ]
    },
    {
      titulo: "Mercancía en mal estado al recibir",
      pasos: [
        "Informa al chofer de CEDIS.",
        "Envía evidencia fotográfica al grupo correspondiente (límite 24h).",
        "Registra devolución en sistema con comentario: 'MAL ESTADO DESDE RECEPCIÓN (<24h)'."
      ]
    },
    {
      titulo: "Mercancía en mal estado al abrir la caja",
      pasos: [
        "Reporta dentro de las 24h posteriores a la recepción.",
        "Envía evidencia al grupo correspondiente.",
        "Comentario: 'MAL ESTADO AL ABRIR (<24h)'."
      ]
    },
    {
      titulo: "No puedo darle entrada a mi folio",
      pasos: [
        "Verifica con CEDIS si ya fue ingresado el folio.",
        "Si persiste, contacta al área de Sistemas.",
        "Comentario: 'INCIDENCIA SISTEMA – entrada de folio'."
      ]
    },
    {
      titulo: "Folio pendiente por entrega sin traspaso",
      pasos: [
        "Confirma que la solicitud esté en sistema y haya conexión a internet.",
        "CEDIS generará el traspaso cuando aparezca la solicitud.",
        "Comentario: 'EN ESPERA DE TRASPASO CEDIS'."
      ]
    },
    {
      titulo: "Devolví producto y me regresaron el cargo",
      pasos: [
        "Revisa la política de devoluciones (puede no proceder).",
        "Haz aclaración en sistema con comentario: 'AJUSTE DEV – cargo revertido indebidamente'.",
        "Informa a Erika Feliciano si aplica."
      ]
    },
    {
      titulo: "No tengo internet para enviar pedido",
      pasos: [
        "Toma foto del ticket de solicitud y envíala a tu supervisor.",
        "Cuando regrese conexión, captura el pedido.",
        "Comentario: 'SIN INTERNET – pedido enviado a supervisor con evidencia'."
      ]
    },
    {
      titulo: "No tengo luz para enviar pedido",
      pasos: [
        "Haz el pedido en libreta (códigos, cantidades legibles).",
        "Envíalo al supervisor.",
        "Captúralo cuando vuelva el servicio.",
        "Comentario: 'SIN LUZ – pedido manual enviado a supervisor'."
      ]
    },
    {
      titulo: "PAN incompleto y cobrado",
      pasos: [
        "Informa al chofer de CEDIS.",
        "Comunícate con Panadería ext. #122.",
        "Si aplica devolución: 'PAN INCOMPLETO – dev misma fecha'."
      ]
    },
    {
      titulo: "El chofer no esperó revisión",
      pasos: [
        "Verifica faltantes.",
        "Si hay, informa por Teams a Erika Feliciano.",
        "Realiza devolución el mismo día.",
        "Comentario: 'CHOFER NO ESPERÓ – dev misma fecha'."
      ]
    },
    {
      titulo: "El chofer no se llevó la devolución",
      pasos: [
        "Guarda la devolución para el siguiente día.",
        "Si ya está en sistema, informa por Teams a Erika.",
        "Comentario: 'DEV EN SISTEMA – chofer no la recogió'."
      ]
    },
    {
      titulo: "Chofer descortés con personal o clientes",
      pasos: [
        "Reporta por Teams a Erika Feliciano con datos y evidencia.",
        "Comentario interno: 'REPORTE CONDUCTA – enviar a jefe directo del chofer CEDIS'."
      ]
    },
    {
      titulo: "No llegó todo el pedido o no se cargó",
      pasos: [
        "Informa al chofer para que contacte a CEDIS (cámara o abarrotes).",
        "Deja comentario: 'PEDIDO INCOMPLETO – CEDIS revisa carga'.",
        "Si aplica, realiza devoluciones correspondientes."
      ]
    },
    {
      titulo: "Entrega muy tarde",
      pasos: [
        "Informa por Teams a Erika Feliciano sobre el retraso (hora real).",
        "Comentario: 'RETRASO ENTREGA – informado a CEDIS'."
      ]
    },
    {
      titulo: "Chofer prometió reponer faltante y no lo trajo",
      pasos: [
        "No pactes reposiciones directas con el chofer.",
        "Reporta la situación a Erika Feliciano por Teams.",
        "Gestiona el faltante mediante devolución formal.",
        "Comentario: 'NO REPUSO – se gestiona según política'."
      ]
    }
  ],

  "Mantenimiento": [
    {
      titulo: "Refrigerador no enfría",
      pasos: [
        "Verifica conexión eléctrica y termostato.",
        "Asegúrate de que no haya obstrucciones en ventilaciones.",
        "Registra temperaturas (ambiente y del equipo).",
        "Si excede límites, solicita visita técnica."
      ]
    }
  ]
};
