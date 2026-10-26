# Costos y límites

## Principio

Este documento define cómo se controlan los costos y los límites de los servicios. No fija precios, cuotas gratuitas ni capacidades concretas de proveedores: esos valores cambian y deben verificarse en la documentación oficial vigente al momento de contratar o desplegar. Cualquier cifra incorporada al presupuesto debe registrarse con fecha, proveedor, plan y fuente.

## Servicios y factores de costo

| Servicio | Factor de costo | Uso previsto | Riesgo |
| --- | --- | --- | --- |
| Supabase | Plan, almacenamiento, transferencia, invocaciones y funciones. | Auth, PostgreSQL, RLS, Edge Functions. | Crecimiento de datos y de historial de auditoría. |
| Proveedor de IA | Tokens de entrada y de salida, por modelo. | Interpretación y borrador del chatbot. | Reintentos, prompts largos y cambios de modelo. |
| Cloudflare | Plan y transferencia del sitio. | Publicación de artefactos estáticos. | Tráfico anómalo o artefactos pesados. |
| GitHub | Plan y minutos de Actions. | CI, pruebas y despliegue. | Workflows ineficientes o ejecuciones repetidas. |
| WhatsApp Business | No integrado en la primera versión. | Solo contexto manual. | Se evita el costo y la complejidad de la API. |

La primera versión no incorpora servicios de voz, analítica externa, colas, cachés ni bases vectoriales. Añadirlos requiere una decisión registrada y una estimación de costo.

## Modelo de costo de IA

El costo de un borrador se aproxima con:

```text
costo_por_borrador = (tokens_entrada × precio_entrada) + (tokens_salida × precio_salida)
costo_mensual      ≈ borradores_mes × costo_por_borrador × (1 + tasa_reintentos)
```

Consideraciones:

- La entrada incluye el texto del técnico, el catálogo de categorías y las instrucciones del adaptador.
- La salida incluye la propuesta estructurada y su justificación breve.
- Un reintento por error incrementa el costo; se limita el número de reintentos.
- El precio por token depende del modelo y del proveedor; se toma de la fuente oficial y se revisa al cambiar de modelo.
- La conversión de moneda, impuestos y mínimos de facturación deben incluirse en el presupuesto.

El registro manual no consume IA y su costo marginal es el de la base de datos y el almacenamiento.

## Límites de la primera versión

Los siguientes valores son propuestas configurables, no capacidades de un proveedor. Se validan en la fase 2:

| Límite | Valor propuesto | Motivo |
| --- | --- | --- |
| Longitud del texto enviado a IA | 4 000 caracteres | Suficiente para describir una incidencia y acotar tokens. |
| Tokens máximos de salida | 800 | La propuesta es estructurada y breve. |
| Solicitudes por técnico y día | 100 | Volumen esperado bajo; evita abuso. |
| Tiempo de espera por solicitud | 20 segundos | Permite responder o degradar a manual. |
| Reintentos automáticos | 1 | Evita duplicar costo y latencia. |
| Llamadas por borrador | 1 | Sin agentes ni cadenas en la fase 2. |
| Presupuesto mensual de IA | Definido por la institución | Se configura como alerta, no como supuesto. |

Estos límites se aplican en la Edge Function, no solo en la interfaz. Al alcanzarlos, el sistema informa y permite continuar manualmente.

## Controles de gasto

- **Tope de entrada y salida:** validar longitud antes de llamar al proveedor y limitar tokens de respuesta.
- **Una llamada por borrador:** sin reintentos automáticos encadenados ni herramientas en la fase 2.
- **Catálogo acotado:** enviar solo categorías vigentes con descripciones breves.
- **Sin historial largo:** no se reenvía la conversación completa en cada turno.
- **Límite por técnico:** cuota diaria y mensual por cuenta.
- **Alertas de presupuesto:** aviso al 50 %, 80 % y 100 % del monto acordado.
- **Interruptor de emergencia:** deshabilitar la IA sin afectar el registro manual.
- **Registro de consumo:** tokens, latencia, modelo y resultado por solicitud, sin datos personales.
- **Revisión mensual:** comparar consumo real con el presupuesto y ajustar límites.

## Costos ocultos y riesgos

| Riesgo | Efecto | Mitigación |
| --- | --- | --- |
| Plan gratuito con límites que cambian o proyecto pausado por inactividad. | Interrupción del servicio. | Verificar condiciones y considerar plan pago antes de producción. |
| Falta de acuerdo de nivel de servicio en planes gratuitos. | Sin garantía de disponibilidad. | Asumir el riesgo o contratar soporte según criticidad. |
| Transferencia de datos facturable. | Costo inesperado por reportes o exportaciones. | Paginación, filtros y límites de exportación. |
| Crecimiento de auditoría y adjuntos. | Aumento de almacenamiento. | Retención definida y minimización de datos. |
| Uso intensivo de IA por pruebas o abuso. | Costo variable elevado. | Cuotas, alertas y entorno de pruebas separado. |
| Cambio de precio o de modelo del proveedor. | Aumento del costo o pérdida de calidad. | Adaptador intercambiable y revisión periódica. |
| CI ejecutada de más. | Consumo de minutos. | Rutas filtradas, cache y ejecuciones agrupadas. |

No se asume que un plan gratuito sea permanente ni suficiente. La decisión de plan se toma antes de la fase 6 con datos de uso reales.

## Medición

Se registra por solicitud:

- Proveedor, modelo y versión del adaptador.
- Tokens de entrada y salida.
- Latencia y resultado (éxito, error, timeout).
- Identificador de correlación.
- Costo estimado según la tarifa vigente.

No se registran nombres, textos completos ni datos de contacto. Los reportes de consumo se agregan por día y por técnico.

## Presupuesto y aprobación

Antes de habilitar la IA en producción se debe aprobar:

1. Monto mensual máximo.
2. Responsable de revisar el consumo.
3. Procedimiento al alcanzar el límite.
4. Condiciones de tratamiento de datos del proveedor.
5. Plan de sustitución si el proveedor cambia sus condiciones.

Sin esa aprobación, la IA permanece deshabilitada y el registro manual sigue operativo.

## Pendientes

- Proveedor y modelo definitivos (DP-06).
- Tarifas vigentes y presupuesto mensual.
- Límites definitivos de entrada, salida y cuota.
- Condiciones de retención y residencia de datos del proveedor.
- Nivel de servicio aceptable para la institución.

Véanse [diseño de IA](ai-design.md) y [decisiones](decisions.md).
