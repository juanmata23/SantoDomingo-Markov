"""Motor de simulación de Márkov, con matrices por perfil."""
from collections import Counter
import random
import numpy as np
import pandas as pd
from datos import ESTADOS, RECORRIDOS, PERFILES, ESTADOS_FINALES, RESULTADOS, clasificar

CODIGOS = [e['id'] for e in ESTADOS]

def construir_matriz_conteos(recorridos):
    matriz = pd.DataFrame(0, index=CODIGOS, columns=CODIGOS)
    for r in recorridos:
        for a,b in zip(r['path'], r['path'][1:]):
            matriz.iat[a,b] += 1
    return matriz

def construir_matriz_probabilidades(conteos, respaldo=None):
    p = conteos.astype(float).copy()
    for i in range(len(CODIGOS)):
        total = p.iloc[i].sum()
        if i in ESTADOS_FINALES:
            p.iloc[i] = 0
            p.iat[i,i] = 1
        elif total:
            p.iloc[i] /= total
        elif respaldo is not None:
            p.iloc[i] = respaldo.iloc[i]
        else:
            raise ValueError(f'Estado sin datos: S{i}')
    return p

def construir_matrices():
    c = {'General': construir_matriz_conteos(RECORRIDOS)}
    p = {'General': construir_matriz_probabilidades(c['General'])}
    for perfil in PERFILES:
        c[perfil] = construir_matriz_conteos([r for r in RECORRIDOS if r['profile']==perfil])
        p[perfil] = construir_matriz_probabilidades(c[perfil], p['General'])
    return c,p

def simular_usuario(matriz, max_pasos, rng, usuario, perfil):
    actual=0
    camino=[actual]
    for _ in range(max_pasos):
        if actual in ESTADOS_FINALES: break
        actual=rng.choices(range(len(CODIGOS)), weights=matriz[actual], k=1)[0]
        camino.append(actual)
    return dict(id=usuario, profile=perfil, path=camino, result=clasificar(actual), steps=len(camino)-1)

def simular_varios_usuarios(n_usuarios, matrices, max_pasos=35, semilla=42, distribucion=None):
    if type(n_usuarios) is not int or n_usuarios<1000: raise ValueError('Mínimo 1000 usuarios')
    if type(max_pasos) is not int or max_pasos<1: raise ValueError('Máximo de pasos inválido')
    pesos=[1/3]*3 if distribucion is None else [float(distribucion[p]) for p in PERFILES]
    if any(not np.isfinite(w) or w<0 for w in pesos) or not np.isclose(sum(pesos),1):
        raise ValueError('La distribución debe sumar 1')
    rng_perfil=random.Random(semilla)
    arrays={p:matrices[p].to_numpy() for p in PERFILES}
    usuarios=[]
    for i in range(1,n_usuarios+1):
        perfil=rng_perfil.choices(PERFILES,weights=pesos,k=1)[0]
        # Semilla independiente por usuario, comparable entre escenarios.
        rng=random.Random(rng_perfil.getrandbits(64))
        usuarios.append(simular_usuario(arrays[perfil],max_pasos,rng,i,perfil))
    return usuarios

def resumir(usuarios):
    n=len(usuarios)
    c=Counter(r['result'] for r in usuarios)
    return {'counts':{k:c[k] for k in RESULTADOS},'percent':{k:100*c[k]/n if n else 0 for k in RESULTADOS},'avg':sum(r['steps'] for r in usuarios)/n if n else 0,'total':n}

def identificar_resultado_mas_frecuente(usuarios):
    c=resumir(usuarios)['counts']
    return [k for k,v in c.items() if v==max(c.values()) and v>0]

def identificar_estado_critico_directo(matriz):
    candidatos=[i for i in range(len(CODIGOS)) if i not in ESTADOS_FINALES and matriz.iat[i,31]>0]
    return max(candidatos,key=lambda i:matriz.iat[i,31],default=None)

def identificar_estado_previo_al_abandono(usuarios):
    c=Counter(r['path'][-2] for r in usuarios if r['result']=='Abandono' and len(r['path'])>1)
    visitas=Counter(i for r in usuarios for i in r['path'][:-1])
    ranking=[{'index':i,'amount':v,'rate':v/visitas[i]} for i,v in sorted(c.items(),key=lambda x:(-x[1],x[0]))]
    return {'index':ranking[0]['index'] if ranking else None,'amount':ranking[0]['amount'] if ranking else 0,'ranking':ranking}

def generar_recomendacion(indice):
    if indice is None: return 'No se detectaron abandonos.'
    if indice in range(15,20): return 'Simplificar el contacto, aclarar campos y mostrar ayuda para continuar.'
    if indice in range(11,15): return 'Mostrar horarios, ubicación y acceso de manera clara.'
    if indice in (24,25,26,27): return 'Mejorar la búsqueda y ofrecer alternativas cuando no haya resultados.'
    return f'Facilitar la navegación desde {ESTADOS[indice]["name"]} con enlaces y acciones claras.'

def construir_matriz_mejorada(matriz, indice, reduccion):
    if not 0<=reduccion<=1: raise ValueError('Reducción relativa entre 0 y 1')
    copia=matriz.copy()
    if indice is None or indice in ESTADOS_FINALES: return copia
    fila=copia.iloc[indice].copy()
    vieja=fila.iloc[31]
    fila.iloc[31]=0
    alternativas=fila.sum()
    if alternativas>0:
        fila*=1+vieja*reduccion/alternativas
        fila.iloc[31]=vieja*(1-reduccion)
        copia.iloc[indice]=fila
    return copia

if __name__=='__main__':
    c,p=construir_matrices()
    for m in p.values(): assert np.allclose(m.sum(axis=1),1) and (m.to_numpy()>=0).all()
    u=simular_varios_usuarios(1000,p)
    assert u==simular_varios_usuarios(1000,p)
    assert all(r['steps']<=35 for r in u)
    s=resumir(u)
    assert sum(s['counts'].values())==1000
    crit=identificar_estado_previo_al_abandono(u)
    mejoradas={k:construir_matriz_mejorada(m,crit['index'],.3) for k,m in p.items()}
    assert all(np.allclose(m.sum(axis=1),1) for m in mejoradas.values())
    print('Matrices de conteos:',len(c),'| Matrices de probabilidades:',len(p))
    print('Usuarios:',len(u),'| Resultados:',s['counts'])
    print('Promedio de pasos:',round(s['avg'],2),'| Estado crítico:',crit['index'])
    print('Escenario mejorado:',resumir(simular_varios_usuarios(1000,mejoradas))['counts'])
    print('Validación del motor: correcta')
