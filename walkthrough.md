# Guia Paso a Paso: Resolucion del Reto UnCrackable Level 3

**Alumno:** [Tu Nombre]
**Materia:** Seguridad en Aplicaciones Moviles
**Objetivo:** Obtener el codigo secreto oculto en "UnCrackable Level 3" mediante ingenieria inversa y hacking dinamico.

---

## Indice
1. [Preparacion del Entorno](#1-preparaci%C3%B3n-del-entorno)
2. [Fase 1: Analisis Estatico (JADX)](#2-fase-1-an%C3%A1lisis-est%C3%A1tico-jadx)
3. [Fase 2: Bypass de Seguridad Inicial (Java)](#3-fase-2-bypass-de-seguridad-inicial-java)
4. [Fase 3: Engañando a la Libreria Nativa (strstr)](#4-fase-3-enga%C3%B1ando-a-la-librer%C3%ADa-nativa-strstr)
5. [Fase 4: El Hueso Duro (Anti-Tampering y pthread)](#5-fase-4-el-hueso-duro-anti-tampering-y-pthread)
6. [Fase 5: Extraccion y Descifrado de la Flag (XOR)](#6-fase-5-extracci%C3%B3n-y-descifrado-de-la-flag-xor)
7. [Anexo: Script de Bypass Final (Frida)](#anexo-script-de-bypass-final-frida)
8. [Conclusion](#8-conclusi%C3%B3n)

---

## 1. Preparacion del Entorno
Antes de empezar, es necesario configurar las herramientas de comunicacion e instrumentacion.

### 1.1. Conexion con el dispositivo
Primero verificamos que el emulador sea visible via ADB:
```bash
adb devices
```

### 1.2. Instalacion de Frida-Server
Para poder inyectar codigo, necesitamos el servidor de Frida corriendo en el Android (con permisos de root):
```bash
# Copiamos el binario al dispositivo
adb push frida-server-17.8.1-android-x86 /data/local/tmp/frida-server

# Damos permisos de ejecucion
adb shell chmod +x /data/local/tmp/frida-server

# Ejecutamos el servidor en segundo plano
adb shell "/data/local/tmp/frida-server &"
```

### 1.3. Verificacion de Frida
Comprobamos que Frida puede ver los procesos del movil:
```bash
frida-ps -U
```

---

## 2. Fase 1: Analisis Estatico (JADX)
Desopilamos el APK para buscar pistas en el codigo fuente.

1.  Abrimos la aplicacion con JADX: `jadx-gui uncrackable3.apk`.
2.  **Hallazgo 1**: En `MainActivity`, vemos que se carga `libfoo.so`.
3.  **Hallazgo 2**: Identificamos la clave XOR: `pizzapizzapizzapizzapizz`.
4.  **Hallazgo 3**: Vemos que la validacion ocurre en el metodo nativo `bar(byte[] input)`.

---

## 3. Fase 2: Bypass de Seguridad Inicial (Java)
Creamos un archivo llamado [bypass.js](file:///C:/Users/alvar/Desktop/jadx/bypass.js) con los hooks necesarios. Para lanzar la aplicacion ignorando las protecciones de Java, usamos el siguiente comando:

```bash
frida -U -f owasp.mstg.uncrackable3 -l bypass.js
```

**Codigo Java Hooked**:
*   Interceptamos `System.exit()` para evitar cierres.
*   Interceptamos `MainActivity.showDialog` para que no bloquee la UI.

---

## 4. Fase 4: El Hueso Duro (Anti-Tampering)
La libreria `libfoo.so` tiene protecciones avanzadas. Si detecta a Frida, crashea. Para evitarlo, bloqueamos la creacion de hilos de vigilancia.

**Instrucción**: El script [bypass.js](file:///C:/Users/alvar/Desktop/jadx/bypass.js) debe incluir el hook de `pthread_create` para detectar cuando `libfoo.so` intenta lanzar un hilo y devolver `0` (exito) sin ejecutarlo realmente.

---

## 5. Fase 5: Extraccion y Descifrado de la Flag (XOR)
Como no es posible leer la flag directamente por la ofuscacion, la extraemos del binario.

### 5.1. Extraer la libreria del movil
Primero localizamos donde esta instalada la app y descargamos el APK a nuestro PC:
```bash
# Encontrar la ruta del APK
adb shell pm path owasp.mstg.uncrackable3

# Descargar el APK (sustituye [ruta] por la salida del comando anterior)
adb pull /data/app/.../base.apk uncrackable3.apk
```

### 5.2. Ejecutar el Brute-Force XOR
He creado un script de Python ([brute_libfoo.py](file:///c:/Users/alvar/Desktop/jadx/brute_libfoo.py)) que abre el APK, extrae `libfoo.so` y busca secuencias de 24 bytes que al hacerles XOR con "pizza" den un resultado legible.

**Comando**:
```bash
python brute_libfoo.py
```

**Resultado obtenido**:
Al ejecutarlo, el script nos devuelve:
> **`making owasp great again`**

---

## Anexo: Script de Bypass Final (Frida)
Este es el archivo [bypass.js](file:///C:/Users/alvar/Desktop/jadx/bypass.js) completo que permite que la app funcione y nos permite realizar las pruebas.

```javascript
console.log("[*] Iniciando Bypass de UnCrackable3...");

// Hook de hilos para bloquear anti-tampering en libfoo.so
const pthread_create = Module.findGlobalExportByName(null, "pthread_create");
const pthread_create_orig = new NativeFunction(pthread_create, 'int', ['pointer', 'pointer', 'pointer', 'pointer']);

Interceptor.replace(pthread_create, new NativeCallback(function(thread, attr, routine, arg) {
    const module = Process.findModuleByAddress(routine);
    if (module && module.name.includes("libfoo.so")) {
        console.log("[!] Bloqueando hilo de vigilancia en libfoo.so");
        return 0; 
    }
    return pthread_create_orig(thread, attr, routine, arg);
}, 'int', ['pointer', 'pointer', 'pointer', 'pointer']));

// Bypass de detecciones strstr (Frida/Root)
const strstr = Module.findGlobalExportByName(null, "strstr");
Interceptor.attach(strstr, {
    onEnter: function (args) {
        const needle = args[1].readCString();
        if (needle && (needle.includes("frida") || needle.includes("xposed") || needle.includes("su"))) {
            this.found = true;
        }
    },
    onLeave: function (retval) {
        if (this.found) retval.replace(ptr(0));
    }
});

Java.perform(function () {
    // Evitar cierre por deteccion
    Java.use("java.lang.System").exit.implementation = function(code) {
        console.log("[!] System.exit bloqueado");
    };

    // Ocultar dialogos de error
    Java.use("sg.vantagepoint.uncrackable3.MainActivity").showDialog.implementation = function(str) {
        console.log("[+] Dialogo ocultado: " + str);
    };

    // Bypass UI
    Java.use("sg.vantagepoint.uncrackable3.CodeCheck").check_code.implementation = function(input) {
        return true; 
    };
});
```

---

## 8. Conclusion
Siguiendo estos pasos, hemos conseguido:
1.  Burlar todas las protecciones de entorno y anti-instrumentacion.
2.  Extraer el binario nativo.
3.  Descifrar el secreto mediante un ataque de fuerza bruta XOR basado en la clave encontrada en el codigo Java.

El secreto final es: **`making owasp great again`**.
