console.log("[*] UnCrackable3 final bypass");

function hookStrstr() {
    const strstr = Module.findGlobalExportByName("strstr");
    if (!strstr) return;

    Interceptor.attach(strstr, {
        onEnter: function (args) {
            this.hide = false;
            try {
                const haystack = args[0].readCString();
                const needle = args[1].readCString();
                if (needle) {
                    const n = needle.toLowerCase();
                    if (n.indexOf("frida") !== -1 || n.indexOf("xposed") !== -1 || n.indexOf("su") !== -1) {
                        this.hide = true;
                    }
                }
            } catch (e) {}
        },
        onLeave: function (retval) {
            if (this.hide) {
                retval.replace(ptr(0));
            }
        }
    });
    console.log("[+] Hook strstr activo");
}

function hookPthreadCreate() {
    const pthread_create = Module.findGlobalExportByName("pthread_create");
    if (!pthread_create) return;

    const pthread_create_orig = new NativeFunction(pthread_create, 'int', ['pointer', 'pointer', 'pointer', 'pointer']);

    Interceptor.replace(pthread_create, new NativeCallback(function(thread, attr, start_routine, arg) {
        let block = false;
        let modName = "unknown";
        try {
            const module = Process.findModuleByAddress(start_routine);
            if (module) {
                modName = module.name;
                if (modName.indexOf("libfoo") !== -1 || modName.indexOf("base.odex") !== -1) {
                    block = true;
                }
            } else {
                block = true;
            }
        } catch(e) {}

        console.log("[DEBUG] pthread_create llamado con start_routine=" + start_routine + " (Modulo: " + modName + ") -> Bloqueado: " + block);

        if (block) {
            console.log("[!] Bloqueando pthread_create anti-tampering (start_routine: " + start_routine + ")");
            return 0;
        }

        return pthread_create_orig(thread, attr, start_routine, arg);
    }, 'int', ['pointer', 'pointer', 'pointer', 'pointer']));
    
    console.log("[+] Hook pthread_create activo");
}

function hookStrncmp() {
    const strncmp = Module.findGlobalExportByName("strncmp");
    if (!strncmp) return;

    Interceptor.attach(strncmp, {
        onEnter: function (args) {
            try {
                const s1 = args[0].readCString();
                const s2 = args[1].readCString();
                const num = args[2].toInt32();
                
                const module = Process.findModuleByAddress(this.returnAddress);
                if (module && module.name.indexOf("libfoo") !== -1) {
                    if (s1 && s2) {
                        console.log("\n[!!!] strncmp capturado desde libfoo.so (n="+num+")");
                        console.log("[-] String 1: " + s1);
                        console.log("[-] String 2: " + s2 + "\n");
                    }
                }
            } catch (e) {}
        }
    });
    console.log("[+] Hook strncmp (para extraer la flag) activo");
}

function hookBar() {
    try {
        const libfoo = Process.getModuleByName("libfoo.so");
        const barExport = libfoo.findExportByName("Java_sg_vantagepoint_uncrackable3_CodeCheck_bar");
        if (barExport) {
            Interceptor.attach(barExport, {
                onEnter: function (args) {
                    console.log("\n[!!!] Llamada a nativa CodeCheck.bar() detectada!");
                },
                onLeave: function(retval) {
                    console.log("[DEBUG] bar() retornó: " + retval);
                }
            });
            console.log("[+] Hook en CodeCheck.bar() activo");
        }
    } catch(e) {}
}

// Aplicar hooks nativos inmediatamente
console.log("[DEBUG] Executing native hooks synchronously...");
hookStrstr();
hookPthreadCreate();
hookStrncmp();

Java.perform(function () {
    console.log("[*] Hooks Java");

    const Debug = Java.use("android.os.Debug");
    Debug.isDebuggerConnected.implementation = function () {
        return false;
    };

    const System = Java.use("java.lang.System");
    System.exit.implementation = function (code) {
        console.log("[!] System.exit bloqueado (código: " + code + ")");
    };

    try {
        const MainActivity = Java.use("sg.vantagepoint.uncrackable3.MainActivity");
        MainActivity.showDialog.implementation = function (str) {
            console.log("[+] Dialogo bloqueado: " + str);
        };
        console.log("[+] MainActivity hooks activos");
    } catch (e) {}

    try {
        const CodeCheck = Java.use("sg.vantagepoint.uncrackable3.CodeCheck");
        CodeCheck.check_code.implementation = function (input) {
            console.log("\n[*] check_code input del usuario:", input);
            return true;
        };
        console.log("[+] check_code bypass activo");
    } catch (e) {
        console.log("[-] CodeCheck no encontrado");
    }
});

function extractSecret() {
    try {
        const libfoo = Process.getModuleByName("libfoo.so");
        console.log("\n[+] Iniciando escaneo automático de rangos en libfoo.so (Base: " + libfoo.base + ")....");
        
        const xorkey = "pizzapizzapizzapizzapizz";
        let found = false;
        
        const ranges = libfoo.enumerateRanges('r--').concat(libfoo.enumerateRanges('rw-'));
        for (let r = 0; r < ranges.length; r++) {
            const range = ranges[r];
            const buffer = new Uint8Array(range.base.readByteArray(range.size));
            for (let i = 0; i < range.size - 24; i++) {
                let isPrintable = true;
                let possibleFlag = "";
                for (let j = 0; j < 24; j++) {
                    const decrypted = buffer[i + j] ^ xorkey.charCodeAt(j);
                    if (decrypted < 32 || decrypted > 126) {
                        isPrintable = false;
                        break;
                    }
                    possibleFlag += String.fromCharCode(decrypted);
                }
                
                if (isPrintable && possibleFlag.length === 24 && possibleFlag !== xorkey) {
                    console.log("\n[!!!] ⭐ SECRET FLAG ENCONTRADA ⭐ [!!!]");
                    console.log("[-] Rango Base: " + range.base + " Offset: " + i);
                    console.log("[-] Secreto Decodificado: " + possibleFlag + "\n");
                    found = true;
                }
            }
        }
        
        if (!found) {
            console.log("[-] No se encontró ninguna flag válida en este intento. Reintentando en 3s...");
            setTimeout(extractSecret, 3000);
        } else {
            console.log("[+] Escaneo Finalizado.");
        }
        
    } catch(e) {
        console.log("[-] Error en extractSecret: " + e.message);
        setTimeout(extractSecret, 2000);
    }
}

// Llamar automáticamente sin que el usuario tenga que interactuar
setTimeout(extractSecret, 4000);