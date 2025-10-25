// src/public/js/solutions.js
// Edita libremente este archivo. No requiere base de datos.
// Las claves deben coincidir con el NOMBRE visible del departamento en el <select> (insensible a mayúsculas).

window.SOLUCIONES_FRECUENTES = {
  "Capital Humano": [
    {
      titulo: "No me llega mi correo de nóminas",
      pasos: [
        "Recuerda revisar que tus bandejas de Spam o Correo no deseado antes de levantar el ticket.",
        "Márcalo como 'No spam' para que te llegue correctamente a tu bandeja de entrada.",
        "Si ya lo revisaste y sigue sin llegar, levanta el ticket por favor."
      ]
    },
    {
      titulo: "Reposición tarjeta de Vales",
      pasos: [
        "Antes debes marcar a Sí Vale para reportar tu tarjeta: 55 58 14 93 93.",
        "Deben entregarte un número de folio que deberás incluir en el reporte.",
        "La nueva tarjeta te la hará llegar Capital Humano con tu jefe directo."
      ]
    }
  ],

  "Sistemas": [
    {
      titulo: "Pinpad no manda la señal de cobro",
      pasos: [
        "Reinicia la computadora y vuelve a probar.",
        "Si aún continúa sin mandar la señal, desconecta un momento el cable USB del pinpad y conéctalo nuevamente en la parte trasera del CPU."
      ]
    },
    {
      titulo: "No pasan los tickets de báscula",
      pasos: [
        "Reinicia la báscula desconectándola de la corriente eléctrica y vuelve a probar."
      ]
    },
    {
      titulo: "La báscula me marca precio manual",
      pasos: [
        "Teclea la penúltima tecla de la primera fila.",
        "Alterna entre precio manual e ingresar PLU."
      ]
    },
    {
      titulo: "El ticket de báscula no sale",
      pasos: [
        "Verifica el riel en la salida del papel.",
        "Asegúrate de que esté a la medida correcta del papel."
      ]
    },
    {
      titulo: "Me da error al facturar",
      pasos: [
        "Verifica la leyenda del tipo de error (nombre, dirección, etc.) y compárala con la constancia de situación fiscal del cliente.",
        "Si el error es el uso del CFDI, verifica con el cliente cuál necesita."
      ]
    }
  ],

  "CEDIS": [
    {
      titulo: "No puedo darle entrada a mi folio",
      pasos: [
        "Verifica con tus compañeros si no le dio entrada alguien más.",
        "Llama a CEDIS para confirmar el folio (Ext. 111)."
      ]
    }
  ],


  "Mantenimiento": [
    {
      titulo: "Refrigerador no enfría",
      pasos: [
        "Verifica conexión eléctrica y termostato.",
        "Revisa que no haya obstrucción en ventilaciones.",
        "Registra temperaturas (ambiente y equipo).",
        "Si excede límites → programa una visita técnica."
      ]
    }
  ]
};
