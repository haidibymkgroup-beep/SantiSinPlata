// Puente con la lógica de negocio compartida (js/*.js): dinero, fechas, validaciones, reglas, almacenamiento.
// Se importa en este orden porque cada archivo registra su módulo en window.SSP.
import '../../js/money.js';
import '../../js/dates.js';
import '../../js/validators.js';
import '../../js/domain.js';
import '../../js/store.js';
import '../../js/fondo.js';
import '../../js/intro.js';

export const SSP = window.SSP;
export const { money, dates, validators, domain, store, fondo, intro } = SSP;
