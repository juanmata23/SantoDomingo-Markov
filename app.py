from flask import Flask, jsonify, request, render_template
from pathlib import Path
from collections import Counter
from datos import ESTADOS, RECORRIDOS, PERFILES, RESULTADOS
from modelo import (construir_matrices, simular_varios_usuarios, resumir,
                    identificar_estado_previo_al_abandono, generar_recomendacion,
                    construir_matriz_mejorada)

app = Flask(__name__)
CONTEOS, PROBABILIDADES = construir_matrices()

def parametros():
    d = request.get_json()
    if not isinstance(d, dict): raise ValueError('Envía un objeto JSON.')
    n, pasos, semilla = d.get('n',1000), d.get('steps',35), d.get('seed',42)
    for valor, minimo, maximo, nombre in [(n,1000,100000,'usuarios'),(pasos,5,100,'pasos'),(semilla,0,999999,'semilla')]:
        if type(valor) is not int or not minimo <= valor <= maximo:
            raise ValueError(f'Valor inválido para {nombre}: {minimo}–{maximo}.')
    distribucion = d.get('distribution')
    if distribucion is not None and (not isinstance(distribucion,dict) or set(distribucion)!=set(PERFILES)):
        raise ValueError('Distribución de perfiles inválida.')
    return d,n,pasos,semilla,distribucion

def analizar(usuarios):
    crit = identificar_estado_previo_al_abandono(usuarios)
    rutas = Counter(tuple(u['path']) for u in usuarios)
    return {'summary':resumir(usuarios),'critical':crit,
            'recommendation':generar_recomendacion(crit['index']),
            'byProfile':{p:resumir([u for u in usuarios if u['profile']==p]) for p in PERFILES},
            'uniqueRoutes':len(rutas),'topRoutes':[{'path':list(r),'count':c} for r,c in rutas.most_common(10)]}

@app.get('/')
def inicio():
    if (Path(app.root_path)/'templates'/'index.html').is_file():
        return render_template('index.html')
    return jsonify(status='ok', message='Backend listo. Interfaz pendiente.')

@app.get('/api/model')
def modelo():
    return jsonify(states=ESTADOS,routes=RECORRIDOS,profiles=PERFILES,labels=RESULTADOS,
                   counts={k:m.to_numpy().tolist() for k,m in CONTEOS.items()},
                   probabilities={k:m.to_numpy().tolist() for k,m in PROBABILIDADES.items()})

@app.post('/api/simulate')
def simular():
    try:
        _,n,pasos,semilla,dist=parametros()
        usuarios=simular_varios_usuarios(n,PROBABILIDADES,pasos,semilla,dist)
        return jsonify(**analizar(usuarios),users=usuarios)
    except (ValueError,TypeError,KeyError,OverflowError) as e:
        return jsonify(error=str(e)),400

@app.post('/api/improve')
def mejorar():
    try:
        d,n,pasos,semilla,dist=parametros()
        reduccion=d.get('reduction',.3)
        if type(reduccion) not in (int,float) or not 0<=reduccion<=1:
            raise ValueError('Reducción relativa inválida (0 a 1).')
        base=simular_varios_usuarios(n,PROBABILIDADES,pasos,semilla,dist)
        crit=identificar_estado_previo_al_abandono(base)
        i=crit['index']
        matrices={k:construir_matriz_mejorada(m,i,reduccion) for k,m in PROBABILIDADES.items()}
        mejor=simular_varios_usuarios(n,matrices,pasos,semilla,dist)
        return jsonify(before=analizar(base),after=analizar(mejor),reduction=reduccion,
                       transitions={k:{'before':float(m.iat[i,31]),'after':float(matrices[k].iat[i,31])} for k,m in PROBABILIDADES.items()} if i is not None else {})
    except (ValueError,TypeError,KeyError,OverflowError) as e:
        return jsonify(error=str(e)),400

if __name__=='__main__':
    app.run(host='127.0.0.1',port=5000,debug=False)
