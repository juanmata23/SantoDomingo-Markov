\# Los caminos de Santo Domingo



Simulador del comportamiento de visitantes mediante cadenas de Márkov, inspirado en el portal web de la Iglesia y Convento de Santo Domingo de Tunja.



\## Características



\- 34 estados de navegación.

\- 90 recorridos base únicos.

\- 3 perfiles de visitantes.

\- 4 matrices de conteos.

\- 4 matrices de probabilidades.

\- Simulación configurable de visitantes.

\- Identificación de estados críticos.

\- Comparación de escenarios de mejora.

\- Interfaz con estética barroca colonial.



\## Tecnologías



\- Python

\- Flask

\- NumPy

\- Pandas

\- HTML5

\- CSS3

\- JavaScript



\## Instalación y ejecución



```bash

uv venv --python 3.12

uv pip install -r requirements.txt

uv run python app.py

```



Abrir en el navegador: http://127.0.0.1:5000



\## Resultados de referencia



Simulación de 1.000 visitantes, 35 pasos máximos y semilla 42.



| Resultado | Inicial | Mejorado |

|---|---:|---:|

| Éxito | 72,1 % | 72,6 % |

| Abandono | 14,9 % | 14,4 % |

| Error | 9,3 % | 9,3 % |

| Seguimiento pendiente | 3,7 % | 3,7 % |



Estado crítico: S27 — Ayuda u orientación.



Los recorridos utilizados son hipotéticos y tienen fines académicos.



\## Contexto académico



Universidad Santo Tomás — Seccional Tunja.



Ingeniería de Sistemas.



Proyecto Integrador de Simulación — 2026.

